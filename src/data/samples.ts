import type { AuditResult, SamplePreset } from '../types/audit';

export const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'auth-controller',
    fileName: 'authController.ts',
    label: 'authController.ts (Express Auth API)',
    language: 'TypeScript',
    frameworkHint: 'Express / Node.js',
    code: `import type { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db/client';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-fallback-secret-123';

export async function loginUser(req: Request, res: Response) {
  const { email, password, signature } = req.body;

  // Verify webhook/client HMAC signature
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(email)
    .digest('hex');

  if (signature !== expectedSig) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Lookup user record
  const query = \`SELECT id, email, password_hash, role FROM users WHERE email = '\${email}' LIMIT 1\`;
  const result = await db.query(query);
  const user = result.rows[0];

  if (!user || user.password_hash !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return res.status(200).json({ token, userId: user.id });
}`,
  },
  {
    id: 'payment-processor',
    fileName: 'payment_processor.py',
    label: 'payment_processor.py (Billing Pipeline)',
    language: 'Python',
    frameworkHint: 'Python / Stripe SDK',
    code: `import os
import stripe
from datetime import datetime

stripe.api_key = os.getenv("STRIPE_API_KEY", "YOUR_STRIPE_SECRET_KEY")

def charge_customer(customer_id: str, amount_dollars: float, currency: str = "usd"):
    # Calculate 2.9% processing fee + $0.30 flat fee using floats
    fee = float(amount_dollars) * 0.029 + 0.30
    total_charge = float(amount_dollars) + fee
    amount_cents = int(total_charge * 100)

    # Create payment intent without idempotency key or amount validation
    intent = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency=currency,
        customer=customer_id,
        confirm=True,
        description=f"Charge for {customer_id} at {datetime.utcnow()}"
    )

    return {
        "status": intent.status,
        "charged_cents": amount_cents,
        "fee": fee,
        "intent_id": intent.id
    }`,
  },
  {
    id: 'user-list',
    fileName: 'UserList.tsx',
    label: 'UserList.tsx (React Component)',
    language: 'TypeScript (React)',
    frameworkHint: 'React 19',
    code: `import { useEffect, useState } from 'react';

interface User {
  id: string;
  name: string;
  bioHtml: string;
}

export function UserList({ filter }: { filter: { role: string } }) {
  const [users, setUsers] = useState<User[]>([]);
  const [lastSynced, setLastSynced] = useState<number>(0);

  // Triggers infinite loop: new filter object + setting state without abort/error handling
  useEffect(() => {
    fetch(\`/api/users?role=\${filter.role}&t=\${lastSynced}\`)
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
        setLastSynced(Date.now());
      });
  }, [filter, lastSynced]);

  return (
    <div className="space-y-3">
      {users.map((user) => (
        <div key={user.id} className="p-4 border rounded">
          <h3>{user.name}</h3>
          <div dangerouslySetInnerHTML={{ __html: user.bioHtml }} />
        </div>
      ))}
    </div>
  );
}`,
  },
];

export const INITIAL_AUTH_AUDIT: AuditResult = {
  language: 'TypeScript',
  detectedFramework: 'Express / Vitest',
  metrics: {
    healthScore: 34,
    securityGrade: 'F',
    maintainabilityScore: 52,
    estimatedCoverage: 88,
  },
  issues: [
    {
      id: 'issue-sql-injection',
      title: 'SQL Injection via Unsanitized String Interpolation',
      severity: 'Critical',
      category: 'Security',
      cweOrRule: 'CWE-89',
      lineStart: 21,
      lineEnd: 24,
      explanation:
        'Interpolating `req.body.email` directly into a raw SQL template literal allows attackers to bypass authentication or dump arbitrary tables using payloads such as `\' OR 1=1 --`. Always use parameterized queries.',
      originalCode: `  // Lookup user record
  const query = \`SELECT id, email, password_hash, role FROM users WHERE email = '\${email}' LIMIT 1\`;
  const result = await db.query(query);`,
      patchedCode: `  // Lookup user record using parameterized query
  const query = 'SELECT id, email, password_hash, role FROM users WHERE email = $1 LIMIT 1';
  const result = await db.query(query, [email]);`,
    },
    {
      id: 'issue-timing-attack',
      title: 'Non-Constant-Time Signature & Password Comparison',
      severity: 'High',
      category: 'Security',
      cweOrRule: 'CWE-208',
      lineStart: 12,
      lineEnd: 28,
      explanation:
        'Comparing HMAC signatures with `!==` leaks byte-level timing differences under statistical timing attacks. Additionally, comparing plaintext `password` directly against `password_hash` skips cryptographic verification (`bcrypt`/`argon2`).',
      originalCode: `  if (signature !== expectedSig) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Lookup user record
  const query = \`SELECT id, email, password_hash, role FROM users WHERE email = '\${email}' LIMIT 1\`;
  const result = await db.query(query);
  const user = result.rows[0];

  if (!user || user.password_hash !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }`,
      patchedCode: `  const sigBuf = Buffer.from(String(signature), 'hex');
  const expBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Lookup user record using parameterized query
  const query = 'SELECT id, email, password_hash, role FROM users WHERE email = $1 LIMIT 1';
  const result = await db.query(query, [email]);
  const user = result.rows[0];

  const isPasswordValid = user ? await verifyPassword(password, user.password_hash) : false;
  if (!user || !isPasswordValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }`,
    },
    {
      id: 'issue-hardcoded-secret',
      title: 'Weak Fallback JWT & HMAC Secret Key',
      severity: 'High',
      category: 'Security',
      cweOrRule: 'CWE-798',
      lineStart: 6,
      lineEnd: 6,
      explanation:
        'Falling back to a static hardcoded secret (`dev-fallback-secret-123`) enables attackers to forge valid JWTs and HMAC signatures in production if `process.env.JWT_SECRET` is missing or misconfigured.',
      originalCode: `const JWT_SECRET = process.env.JWT_SECRET || 'dev-fallback-secret-123';`,
      patchedCode: `const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable must be defined');
}`,
    },
    {
      id: 'issue-unhandled-async',
      title: 'Unhandled Async Rejection & Missing Input Validation',
      severity: 'Medium',
      category: 'Bugs',
      cweOrRule: 'CWE-755',
      lineStart: 8,
      lineEnd: 36,
      explanation:
        'If `req.body` is malformed (`email` or `password` non-string/missing) or `db.query` throws a transient connection error, `crypto.createHmac(...).update(email)` throws a TypeError and causes an unhandled promise rejection that can crash the Express process.',
      originalCode: `export async function loginUser(req: Request, res: Response) {
  const { email, password, signature } = req.body;`,
      patchedCode: `export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password, signature } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string' || typeof signature !== 'string') {
      return res.status(400).json({ error: 'Invalid request payload' });
    }`,
    },
  ],
  fullPatchedCode: `import type { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db/client';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable must be defined');
}

async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(plain, salt, 64, (err, buf) => (err ? reject(err) : resolve(buf)));
  });
  const keyBuf = Buffer.from(key, 'hex');
  return keyBuf.length === derived.length && crypto.timingSafeEqual(keyBuf, derived);
}

export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password, signature } = req.body ?? {};
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof signature !== 'string' ||
      !email.includes('@')
    ) {
      return res.status(400).json({ error: 'Invalid request payload' });
    }

    // Constant-time HMAC verification
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(email)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parameterized lookup prevents SQL injection
    const query = 'SELECT id, email, password_hash, role FROM users WHERE email = $1 LIMIT 1';
    const result = await db.query(query, [email.trim().toLowerCase()]);
    const user = result.rows[0];

    const isPasswordValid = user ? await verifyPassword(password, user.password_hash) : false;
    if (!user || !isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    return res.status(200).json({ token, userId: user.id });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Internal authentication failure' });
  }
}`,
  testSuite: {
    fileName: 'authController.test.ts',
    framework: 'Vitest',
    fullTestCode: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { loginUser } from './authController';
import { db } from '../db/client';

vi.mock('../db/client', () => ({
  db: { query: vi.fn() },
}));

function createMockResponse() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('loginUser', () => {
  const secret = process.env.JWT_SECRET || 'test-secret-32-chars-minimum-entropy';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = secret;
  });

  it('authenticates a valid user with valid HMAC signature and returns JWT', async () => {
    const email = 'alice@example.com';
    const sig = crypto.createHmac('sha256', secret).update(email).digest('hex');
    const salt = 'a1b2c3d4';
    const derived = crypto.scryptSync('correct-horse-battery', salt, 64).toString('hex');

    (db.query as any).mockResolvedValueOnce({
      rows: [{ id: 'usr_1', email, password_hash: \`\${salt}:\${derived}\`, role: 'admin' }],
    });

    const req: any = { body: { email, password: 'correct-horse-battery', signature: sig } };
    const res = createMockResponse();

    await loginUser(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ userId: 'usr_1' }));
  });

  it('rejects SQL injection payloads using parameterized queries', async () => {
    const maliciousEmail = "admin@example.com' OR '1'='1";
    const sig = crypto.createHmac('sha256', secret).update(maliciousEmail).digest('hex');
    (db.query as any).mockResolvedValueOnce({ rows: [] });

    const req: any = { body: { email: maliciousEmail, password: 'x', signature: sig } };
    const res = createMockResponse();

    await loginUser(req, res);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('$1'), expect.any(Array));
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects malformed signature lengths without throwing Buffer range errors', async () => {
    const req: any = { body: { email: 'bob@example.com', password: 'pw', signature: 'short' } };
    const res = createMockResponse();

    await loginUser(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 when email or password is missing from request body', async () => {
    const req: any = { body: { signature: 'abc' } };
    const res = createMockResponse();

    await loginUser(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('catches database failures and returns 500 safely', async () => {
    const email = 'carol@example.com';
    const sig = crypto.createHmac('sha256', secret).update(email).digest('hex');
    (db.query as any).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const req: any = { body: { email, password: 'pw', signature: sig } };
    const res = createMockResponse();

    await loginUser(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});`,
    testCases: [
      {
        id: 'tc-happy-auth',
        name: 'authenticates a valid user with valid HMAC signature and returns JWT',
        type: 'Happy Path',
        description: 'Verifies 200 status and signed JWT payload when credentials and HMAC match.',
        passesOnOriginal: true,
        passesOnPatched: true,
        executionMs: 14,
      },
      {
        id: 'tc-sec-sqli',
        name: 'rejects SQL injection payloads using parameterized queries',
        type: 'Security',
        description: 'Asserts db.query uses bound $1 parameter instead of raw string interpolation.',
        passesOnOriginal: false,
        passesOnPatched: true,
        executionMs: 9,
      },
      {
        id: 'tc-sec-timing',
        name: 'rejects malformed signature lengths without throwing Buffer range errors',
        type: 'Security',
        description: 'Ensures constant-time timingSafeEqual handles mismatched buffer lengths safely.',
        passesOnOriginal: false,
        passesOnPatched: true,
        executionMs: 7,
      },
      {
        id: 'tc-edge-payload',
        name: 'returns 400 when email or password is missing from request body',
        type: 'Edge Case',
        description: 'Guards against non-string or undefined fields before calling crypto.createHmac.',
        passesOnOriginal: false,
        passesOnPatched: true,
        executionMs: 5,
      },
      {
        id: 'tc-err-db',
        name: 'catches database failures and returns 500 safely',
        type: 'Error Handling',
        description: 'Prevents unhandled async rejection when db.query rejects with ECONNREFUSED.',
        passesOnOriginal: false,
        passesOnPatched: true,
        executionMs: 11,
      },
    ],
  },
};
