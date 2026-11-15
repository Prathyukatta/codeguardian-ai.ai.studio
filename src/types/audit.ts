export type AuditFocus = 'Security' | 'Bugs' | 'Performance' | 'Clean Code';

export type TestFramework =
  | 'Auto-Detect'
  | 'Jest'
  | 'Vitest'
  | 'Pytest'
  | 'JUnit 5'
  | 'Go Test';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export type IssueCategory = 'Security' | 'Bugs' | 'Performance' | 'Clean Code';

export type TestCaseType =
  | 'Happy Path'
  | 'Edge Case'
  | 'Security'
  | 'Error Handling';

export interface AuditMetrics {
  healthScore: number;
  securityGrade: string;
  maintainabilityScore: number;
  estimatedCoverage: number;
}

export interface AuditIssue {
  id: string;
  title: string;
  severity: Severity;
  category: IssueCategory;
  cweOrRule: string;
  lineStart: number;
  lineEnd: number;
  explanation: string;
  originalCode: string;
  patchedCode: string;
}

export interface TestCase {
  id: string;
  name: string;
  type: TestCaseType;
  description: string;
  passesOnOriginal: boolean;
  passesOnPatched: boolean;
  executionMs: number;
}

export interface TestSuite {
  fileName: string;
  framework: string;
  fullTestCode: string;
  testCases: TestCase[];
}

export interface AuditResult {
  language: string;
  detectedFramework: string;
  metrics: AuditMetrics;
  issues: AuditIssue[];
  fullPatchedCode: string;
  testSuite: TestSuite;
}

export interface SamplePreset {
  id: string;
  fileName: string;
  label: string;
  language: string;
  frameworkHint: string;
  code: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  fileName: string;
  language: string;
  baselineCode: string;
  currentCode: string;
  appliedIssueIds: string[];
  auditResult: AuditResult;
}
