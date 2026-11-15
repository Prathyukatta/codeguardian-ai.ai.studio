import type { AuditIssue, AuditMetrics, Severity } from '../types/audit';

export function detectLanguageFromFileName(fileName: string, code: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
      return 'TypeScript';
    case 'tsx':
      return 'TypeScript (React)';
    case 'js':
      return 'JavaScript';
    case 'jsx':
      return 'JavaScript (React)';
    case 'py':
      return 'Python';
    case 'go':
      return 'Go';
    case 'java':
      return 'Java';
    case 'sql':
      return 'SQL';
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'hpp':
    case 'h':
      return 'C++';
    default:
      break;
  }

  if (code.includes('def ') && code.includes('import ')) return 'Python';
  if (code.includes('package main') && code.includes('func ')) return 'Go';
  if (code.includes('public class ') || code.includes('System.out')) return 'Java';
  if (/\bSELECT\b[\s\S]*\bFROM\b/i.test(code)) return 'SQL';
  if (code.includes('useState(') || code.includes('dangerouslySetInnerHTML')) return 'TypeScript (React)';
  return 'TypeScript';
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  Critical: 24,
  High: 15,
  Medium: 9,
  Low: 4,
};

export function recalculateMetrics(
  baseMetrics: AuditMetrics,
  issues: AuditIssue[],
  appliedIssueIds: string[]
): AuditMetrics {
  if (issues.length === 0) return baseMetrics;

  const appliedSet = new Set(appliedIssueIds);
  const remainingIssues = issues.filter((issue) => !appliedSet.has(issue.id));

  if (remainingIssues.length === 0) {
    return {
      healthScore: Math.max(96, baseMetrics.healthScore),
      securityGrade: 'A',
      maintainabilityScore: Math.max(94, baseMetrics.maintainabilityScore),
      estimatedCoverage: baseMetrics.estimatedCoverage,
    };
  }

  const totalWeight = issues.reduce((acc, i) => acc + SEVERITY_WEIGHT[i.severity], 0);
  const resolvedWeight = issues
    .filter((i) => appliedSet.has(i.id))
    .reduce((acc, i) => acc + SEVERITY_WEIGHT[i.severity], 0);

  const progress = totalWeight > 0 ? resolvedWeight / totalWeight : 0;
  const targetHealth = Math.max(96, baseMetrics.healthScore);
  const healthScore = Math.round(
    baseMetrics.healthScore + (targetHealth - baseMetrics.healthScore) * progress
  );

  const targetMaint = Math.max(92, baseMetrics.maintainabilityScore);
  const maintainabilityScore = Math.round(
    baseMetrics.maintainabilityScore +
      (targetMaint - baseMetrics.maintainabilityScore) * progress
  );

  // Recalculate security grade from remaining Security issues
  const remainingSecurity = remainingIssues.filter((i) => i.category === 'Security');
  const hasCriticalSec = remainingSecurity.some((i) => i.severity === 'Critical');
  const hasHighSec = remainingSecurity.some((i) => i.severity === 'High');
  const hasMedSec = remainingSecurity.some((i) => i.severity === 'Medium');

  let securityGrade = baseMetrics.securityGrade;
  if (remainingSecurity.length === 0) {
    securityGrade = 'A';
  } else if (appliedSet.size > 0) {
    if (hasCriticalSec) securityGrade = 'F';
    else if (hasHighSec) securityGrade = remainingSecurity.length > 1 ? 'D' : 'C';
    else if (hasMedSec) securityGrade = 'B';
    else securityGrade = 'A';
  }

  return {
    healthScore,
    securityGrade,
    maintainabilityScore,
    estimatedCoverage: baseMetrics.estimatedCoverage,
  };
}

export function applyPatchToCode(
  currentCode: string,
  issue: AuditIssue
): { updatedCode: string; applied: boolean } {
  const normalizedCurrent = currentCode.replace(/\r\n/g, '\n');
  const normalizedOrig = issue.originalCode.replace(/\r\n/g, '\n');

  if (normalizedOrig.trim() && normalizedCurrent.includes(normalizedOrig)) {
    return {
      updatedCode: normalizedCurrent.replace(normalizedOrig, issue.patchedCode),
      applied: true,
    };
  }

  // Fallback: try trimmed line match around lineStart..lineEnd
  const currentLines = normalizedCurrent.split('\n');
  const origLines = normalizedOrig.split('\n').map((l) => l.trim()).filter(Boolean);

  if (origLines.length > 0) {
    for (let start = 0; start <= currentLines.length - origLines.length; start++) {
      let matched = true;
      for (let offset = 0; offset < origLines.length; offset++) {
        if (currentLines[start + offset].trim() !== origLines[offset]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        const before = currentLines.slice(0, start);
        const after = currentLines.slice(start + origLines.length);
        return {
          updatedCode: [...before, issue.patchedCode, ...after].join('\n'),
          applied: true,
        };
      }
    }
  }

  // Last resort: line range replacement if valid
  if (
    issue.lineStart >= 1 &&
    issue.lineEnd >= issue.lineStart &&
    issue.lineEnd <= currentLines.length
  ) {
    const before = currentLines.slice(0, issue.lineStart - 1);
    const after = currentLines.slice(issue.lineEnd);
    return {
      updatedCode: [...before, issue.patchedCode, ...after].join('\n'),
      applied: true,
    };
  }

  return { updatedCode: currentCode, applied: false };
}
