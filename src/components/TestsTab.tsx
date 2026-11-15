import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Play,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { AuditIssue, TestCase, TestSuite } from '../types/audit';
import { tokenizeLine } from '../utils/diff';

interface TestsTabProps {
  testSuite: TestSuite;
  estimatedCoverage: number;
  issues: AuditIssue[];
  appliedIssueIds: string[];
  hasRunTests: boolean;
  isRunningTests: boolean;
  isRefiningTests: boolean;
  onRunTests: () => void;
  onRefineTests: (prompt: string) => void;
  onCopyText: (text: string, label: string) => void;
  onDownloadFile: (fileName: string, content: string) => void;
}

export const TestsTab: React.FC<TestsTabProps> = ({
  testSuite,
  estimatedCoverage,
  issues,
  appliedIssueIds,
  hasRunTests,
  isRunningTests,
  isRefiningTests,
  onRunTests,
  onRefineTests,
  onCopyText,
  onDownloadFile,
}) => {
  const [refineInput, setRefineInput] = useState('');

  const allFixed =
    issues.length === 0 || appliedIssueIds.length >= issues.length;

  const getCaseResult = (tc: TestCase): 'pass' | 'fail' | 'idle' => {
    if (!hasRunTests) return 'idle';
    if (allFixed) return tc.passesOnPatched ? 'pass' : 'fail';
    // If any security/bug fix is still unapplied, security & edge cases reflect current code state
    return tc.passesOnOriginal ? 'pass' : 'fail';
  };

  const passedCount = testSuite.testCases.filter(
    (tc) => getCaseResult(tc) === 'pass'
  ).length;
  const failedCount = testSuite.testCases.filter(
    (tc) => getCaseResult(tc) === 'fail'
  ).length;
  const totalTimeMs = testSuite.testCases.reduce(
    (acc, tc) => acc + tc.executionMs,
    0
  );

  const handleRefineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = refineInput.trim();
    if (!trimmed || isRefiningTests) return;
    onRefineTests(trimmed);
    setRefineInput('');
  };

  const codeLines = testSuite.fullTestCode.split('\n');

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
        {/* Test Suite Summary Card */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                <span className="font-mono font-semibold text-[#c0c1ff]">
                  {testSuite.framework}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{testSuite.fileName}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {testSuite.testCases.length} test cases
                </span>
              </div>

              <div className="mt-2.5 flex items-center gap-3">
                <div className="w-40 h-2 bg-[#0B0F17] border border-[#1E293B] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#10B981] transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, estimatedCoverage))}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-[#dfe2ee] tabular-nums">
                  {estimatedCoverage}% est. coverage
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={isRunningTests}
              onClick={onRunTests}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md bg-[#10B981] hover:bg-[#059669] disabled:opacity-60 text-[#002113] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isRunningTests ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Running Suite...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Test Suite</span>
                </>
              )}
            </button>
          </div>

          {hasRunTests && !isRunningTests && (
            <div className="mt-3 pt-3 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
              <div className="flex items-center gap-4">
                <span className="text-[#10B981] font-medium">
                  {passedCount} passed
                </span>
                {failedCount > 0 && (
                  <span className="text-[#EF4444] font-medium">
                    {failedCount} failed (unpatched code)
                  </span>
                )}
              </div>
              <span className="text-[#9CA3AF]">
                Completed in {totalTimeMs} ms
              </span>
            </div>
          )}
        </div>

        {/* Individual Test Cases List */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[#9CA3AF]">
            Generated Test Cases
          </h3>
          <div className="bg-[#111827] border border-[#1E293B] rounded-lg divide-y divide-[#1E293B]">
            {testSuite.testCases.map((tc) => {
              const status = getCaseResult(tc);
              return (
                <div
                  key={tc.id}
                  className="p-3.5 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-medium text-[#F9FAFB]">
                        {tc.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
                      <span className="font-mono text-[#c0c1ff]">{tc.type}</span>
                      <span aria-hidden="true">·</span>
                      <span>{tc.description}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] tabular-nums">
                    <span className="text-[#6B7280]">{tc.executionMs} ms</span>
                    {status === 'pass' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#10B981]/15 text-[#4edea3] border border-[#10B981]/30 font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>PASS</span>
                      </span>
                    )}
                    {status === 'fail' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 font-semibold">
                        <XCircle className="w-3 h-3" />
                        <span>FAIL</span>
                      </span>
                    )}
                    {status === 'idle' && (
                      <span className="px-2 py-0.5 rounded bg-[#1c2028] text-[#9CA3AF] border border-[#1E293B]">
                        READY
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Full Test Code Block */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-lg overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#181c24] border-b border-[#1E293B]">
            <span className="font-mono text-xs font-medium text-[#dfe2ee]">
              {testSuite.fileName}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onCopyText(testSuite.fullTestCode, 'Test suite copied to clipboard')
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#dfe2ee] bg-[#1c2028] hover:bg-[#262a33] border border-[#1E293B] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>Copy Tests</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onDownloadFile(testSuite.fileName, testSuite.fullTestCode)
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#dfe2ee] bg-[#1c2028] hover:bg-[#262a33] border border-[#1E293B] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span>Download Test File</span>
              </button>
            </div>
          </div>

          <div className="bg-[#0B0F17] overflow-x-auto py-3 font-mono text-[12px] leading-5">
            {codeLines.map((line, idx) => (
              <div key={idx} className="flex px-4 hover:bg-[#181c24]/60">
                <span className="w-9 shrink-0 select-none text-right pr-3 text-[#6B7280] tabular-nums">
                  {idx + 1}
                </span>
                <span className="whitespace-pre">
                  {tokenizeLine(line).map((tok, tIdx) => (
                    <span key={tIdx} className={tok.className}>
                      {tok.text}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Refine Tests Quick Input Bar */}
      <form
        onSubmit={handleRefineSubmit}
        className="p-3 bg-[#111827] border-t border-[#1E293B] flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={refineInput}
          onChange={(e) => setRefineInput(e.target.value)}
          disabled={isRefiningTests}
          placeholder="Refine tests (e.g., Add fuzzing tests for null payloads and malformed tokens)..."
          className="flex-1 min-w-0 px-3 py-2 text-xs text-[#F9FAFB] placeholder:text-[#6B7280] bg-[#0B0F17] border border-[#1E293B] rounded-md focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
        />
        <button
          type="submit"
          disabled={!refineInput.trim() || isRefiningTests}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#6366F1] hover:bg-[#4f46e5] disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isRefiningTests ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Refining...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Refine Tests</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
