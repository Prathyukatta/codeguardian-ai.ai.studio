import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const AUDIT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    language: { type: Type.STRING },
    detectedFramework: { type: Type.STRING },
    metrics: {
      type: Type.OBJECT,
      properties: {
        healthScore: { type: Type.INTEGER },
        securityGrade: { type: Type.STRING },
        maintainabilityScore: { type: Type.INTEGER },
        estimatedCoverage: { type: Type.INTEGER },
      },
      required: [
        'healthScore',
        'securityGrade',
        'maintainabilityScore',
        'estimatedCoverage',
      ],
    },
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          severity: { type: Type.STRING },
          category: { type: Type.STRING },
          cweOrRule: { type: Type.STRING },
          lineStart: { type: Type.INTEGER },
          lineEnd: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
          originalCode: { type: Type.STRING },
          patchedCode: { type: Type.STRING },
        },
        required: [
          'id',
          'title',
          'severity',
          'category',
          'cweOrRule',
          'lineStart',
          'lineEnd',
          'explanation',
          'originalCode',
          'patchedCode',
        ],
      },
    },
    fullPatchedCode: { type: Type.STRING },
    testSuite: {
      type: Type.OBJECT,
      properties: {
        fileName: { type: Type.STRING },
        framework: { type: Type.STRING },
        fullTestCode: { type: Type.STRING },
        testCases: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              type: { type: Type.STRING },
              description: { type: Type.STRING },
              passesOnOriginal: { type: Type.BOOLEAN },
              passesOnPatched: { type: Type.BOOLEAN },
              executionMs: { type: Type.INTEGER },
            },
            required: [
              'id',
              'name',
              'type',
              'description',
              'passesOnOriginal',
              'passesOnPatched',
              'executionMs',
            ],
          },
        },
      },
      required: ['fileName', 'framework', 'fullTestCode', 'testCases'],
    },
  },
  required: [
    'language',
    'detectedFramework',
    'metrics',
    'issues',
    'fullPatchedCode',
    'testSuite',
  ],
};

const TEST_SUITE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    fileName: { type: Type.STRING },
    framework: { type: Type.STRING },
    fullTestCode: { type: Type.STRING },
    testCases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          type: { type: Type.STRING },
          description: { type: Type.STRING },
          passesOnOriginal: { type: Type.BOOLEAN },
          passesOnPatched: { type: Type.BOOLEAN },
          executionMs: { type: Type.INTEGER },
        },
        required: [
          'id',
          'name',
          'type',
          'description',
          'passesOnOriginal',
          'passesOnPatched',
          'executionMs',
        ],
      },
    },
  },
  required: ['fileName', 'framework', 'fullTestCode', 'testCases'],
};

async function callGeminiWithFallback(
  ai: GoogleGenAI,
  contents: string,
  systemInstruction: string,
  responseSchema: Record<string, unknown>
): Promise<{ text: string; modelUsed: string }> {
  const models = ['gemini-2.5-pro', 'gemini-2.5-flash'];
  let lastError: unknown = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
      if (response.text && response.text.trim()) {
        return { text: response.text, modelUsed: model };
      }
      throw new Error(`Model ${model} returned empty output.`);
    } catch (err) {
      lastError = err;
      console.warn(`[CodeGuardian] Model ${model} failed, trying fallback:`, err);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All Gemini models failed to complete the request.');
}

function addLineNumbers(code: string): string {
  return code
    .split('\n')
    .map((line, index) => `${index + 1}: ${line}`)
    .join('\n');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/audit', async (req: Request, res: Response) => {
    try {
      const { code, fileName, language, auditFocus, testFramework } = req.body ?? {};
      if (typeof code !== 'string' || !code.trim()) {
        res.status(400).json({ error: 'Source code is required for auditing.' });
        return;
      }

      const ai = getAiClient();
      const focusList =
        Array.isArray(auditFocus) && auditFocus.length > 0
          ? auditFocus.join(', ')
          : 'Security, Bugs, Performance, Clean Code';
      const chosenFramework =
        typeof testFramework === 'string' && testFramework.trim()
          ? testFramework
          : 'Auto-Detect';

      const systemInstruction = `You are a Principal Security Engineer & Staff SDET performing a rigorous static/semantic code review and automated test synthesis.
Analyze the submitted source code strictly within the requested audit focus categories: ${focusList}.
Return strictly valid JSON matching the provided schema:
- severity MUST be one of: "Critical", "High", "Medium", "Low".
- category MUST be one of: "Security", "Bugs", "Performance", "Clean Code".
- securityGrade MUST be a single letter grade: "A", "B", "C", "D", or "F".
- healthScore, maintainabilityScore, estimatedCoverage MUST be integers 0-100.
- lineStart and lineEnd MUST match the 1-indexed line numbers provided in the numbered listing.
- originalCode MUST be an exact, verbatim multi-line or single-line substring from the user's code (without line number prefixes) so it can be replaced cleanly.
- patchedCode MUST be the drop-in fixed replacement for originalCode.
- fullPatchedCode MUST be the complete, clean, production-ready version of the entire file with every identified issue resolved.
- testSuite.testCases[].type MUST be one of: "Happy Path", "Edge Case", "Security", "Error Handling".
- If Test Framework is "Auto-Detect", choose the most idiomatic framework for the language (e.g., Vitest/Jest for TS/JS, Pytest for Python, Go Test for Go, JUnit 5 for Java); otherwise strictly generate tests for "${chosenFramework}".
- Set passesOnOriginal to false for Security/Edge Case/Error Handling tests that expose bugs in the original unpatched code, and passesOnPatched to true once the patched code fixes them.`;

      const numberedCode = addLineNumbers(code);
      const userPrompt = `File Name: ${fileName || 'untitled.ts'}
Language Hint: ${language || 'Auto-Detect'}
Requested Audit Focus: ${focusList}
Requested Test Framework: ${chosenFramework}

Numbered Source Code (1-indexed lines):
\`\`\`
${numberedCode}
\`\`\``;

      const { text, modelUsed } = await callGeminiWithFallback(
        ai,
        userPrompt,
        systemInstruction,
        AUDIT_RESPONSE_SCHEMA
      );

      const parsed = JSON.parse(text);
      res.json({ auditResult: parsed, modelUsed });
    } catch (error) {
      console.error('[CodeGuardian] /api/audit error:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to run Guardian audit.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/refine-tests', async (req: Request, res: Response) => {
    try {
      const { code, fileName, language, currentTestSuite, instruction } =
        req.body ?? {};
      if (
        typeof code !== 'string' ||
        typeof instruction !== 'string' ||
        !instruction.trim()
      ) {
        res.status(400).json({
          error: 'Source code and refinement instruction are required.',
        });
        return;
      }

      const ai = getAiClient();
      const systemInstruction = `You are a Staff SDET refining an existing unit test suite.
Preserve existing valid tests and append or enhance the suite to satisfy the developer's refinement request.
Return strictly valid JSON matching the testSuite schema:
- testCases[].type MUST be one of: "Happy Path", "Edge Case", "Security", "Error Handling".
- fullTestCode MUST be complete, runnable, idiomatic test code including imports and all test cases.`;

      const userPrompt = `File Name: ${fileName || 'untitled.ts'}
Language: ${language || 'TypeScript'}
Current Test Framework: ${currentTestSuite?.framework || 'Vitest'}
Refinement Request: ${instruction}

Source Code Under Test:
\`\`\`
${code}
\`\`\`

Existing Test Suite:
\`\`\`
${currentTestSuite?.fullTestCode || ''}
\`\`\``;

      const { text, modelUsed } = await callGeminiWithFallback(
        ai,
        userPrompt,
        systemInstruction,
        TEST_SUITE_RESPONSE_SCHEMA
      );

      const parsed = JSON.parse(text);
      res.json({ testSuite: parsed, modelUsed });
    } catch (error) {
      console.error('[CodeGuardian] /api/refine-tests error:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to refine test suite.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CodeGuardian AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
