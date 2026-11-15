export interface DiffLine {
  type: 'context' | 'add' | 'remove';
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
}

export function computeLineDiff(original: string, patched: string): DiffLine[] {
  const a = original.split('\n');
  const b = patched.split('\n');
  const m = a.length;
  const n = b.length;

  // LCS DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let oldLn = 1;
  let newLn = 1;

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({
        type: 'context',
        oldLineNumber: oldLn++,
        newLineNumber: newLn++,
        content: a[i],
      });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({
        type: 'remove',
        oldLineNumber: oldLn++,
        newLineNumber: null,
        content: a[i],
      });
      i++;
    } else {
      result.push({
        type: 'add',
        oldLineNumber: null,
        newLineNumber: newLn++,
        content: b[j],
      });
      j++;
    }
  }

  while (i < m) {
    result.push({
      type: 'remove',
      oldLineNumber: oldLn++,
      newLineNumber: null,
      content: a[i++],
    });
  }

  while (j < n) {
    result.push({
      type: 'add',
      oldLineNumber: null,
      newLineNumber: newLn++,
      content: b[j++],
    });
  }

  return result;
}

export interface TokenSpan {
  text: string;
  className: string;
}

const KEYWORDS = new Set([
  'import', 'from', 'export', 'default', 'function', 'async', 'await', 'const', 'let', 'var',
  'return', 'if', 'else', 'try', 'catch', 'finally', 'throw', 'new', 'type', 'interface',
  'class', 'extends', 'implements', 'for', 'while', 'switch', 'case', 'break', 'continue',
  'def', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'is', 'with', 'as', 'pass',
  'raise', 'SELECT', 'FROM', 'WHERE', 'LIMIT', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'JOIN', 'ON', 'package', 'func', 'struct', 'defer', 'go', 'public', 'private',
  'void', 'static', 'final', 'true', 'false', 'null', 'undefined', 'typeof', 'instanceof',
]);

const BUILTINS = new Set([
  'Promise', 'Buffer', 'Error', 'Response', 'Request', 'String', 'Number', 'Boolean',
  'Array', 'Object', 'Date', 'Math', 'JSON', 'console', 'process', 'crypto', 'jwt',
  'useEffect', 'useState', 'useRef', 'useMemo', 'useCallback', 'fetch', 'expect',
  'describe', 'it', 'test', 'vi', 'jest', 'pytest', 'str', 'int', 'float', 'dict', 'list',
]);

const TOKEN_REGEX =
  /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/|`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/gm;

export function tokenizeLine(line: string): TokenSpan[] {
  const spans: TokenSpan[] = [];
  let lastIndex = 0;

  TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_REGEX.exec(line)) !== null) {
    if (match.index > lastIndex) {
      spans.push({
        text: line.slice(lastIndex, match.index),
        className: 'text-[#dfe2ee]',
      });
    }

    const token = match[0];
    let className = 'text-[#dfe2ee]';

    if (token.startsWith('//') || token.startsWith('#') || token.startsWith('/*')) {
      className = 'text-[#6B7280] italic';
    } else if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
      className = 'text-[#4edea3]';
    } else if (/^\d/.test(token)) {
      className = 'text-[#ffb783]';
    } else if (KEYWORDS.has(token)) {
      className = 'text-[#c0c1ff] font-medium';
    } else if (BUILTINS.has(token)) {
      className = 'text-[#38BDF8]';
    }

    spans.push({ text: token, className });
    lastIndex = TOKEN_REGEX.lastIndex;
  }

  if (lastIndex < line.length) {
    spans.push({
      text: line.slice(lastIndex),
      className: 'text-[#dfe2ee]',
    });
  }

  if (spans.length === 0) {
    spans.push({ text: ' ', className: 'text-[#dfe2ee]' });
  }

  return spans;
}
