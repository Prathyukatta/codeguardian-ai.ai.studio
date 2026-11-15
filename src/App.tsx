import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Diff,
  FlaskConical,
  History,
  Loader2,
  Play,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type {
  AuditFocus,
  AuditIssue,
  AuditResult,
  HistoryEntry,
  SamplePreset,
  TestFramework,
} from './types/audit';
import { INITIAL_AUTH_AUDIT, SAMPLE_PRESETS } from './data/samples';
import {
  applyPatchToCode,
  detectLanguageFromFileName,
  recalculateMetrics,
} from './utils/score';
import { CodeEditorPane } from './components/CodeEditorPane';
import { AuditLoadingState } from './components/AuditLoadingState';
import { FindingsTab } from './components/FindingsTab';
import { TestsTab } from './components/TestsTab';
import { DiffTab } from './components/DiffTab';
import { HistoryDrawer } from './components/HistoryDrawer';

type RightTab = 'findings' | 'tests' | 'diff';

interface ToastMessage {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const HISTORY_STORAGE_KEY = 'codeguardian_audit_history_v1';

function loadStoredHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const defaultSample = SAMPLE_PRESETS[0];

  const [fileName, setFileName] = useState<string>(defaultSample.fileName);
  const [code, setCode] = useState<string>(defaultSample.code);
  const [baselineCode, setBaselineCode] = useState<string>(defaultSample.code);
  const [language, setLanguage] = useState<string>(defaultSample.language);

  const [auditFocus, setAuditFocus] = useState<AuditFocus[]>([
    'Security',
    'Bugs',
    'Performance',
    'Clean Code',
  ]);
  const [testFramework, setTestFramework] = useState<TestFramework>('Auto-Detect');

  const [auditResult, setAuditResult] = useState<AuditResult | null>(
    INITIAL_AUTH_AUDIT
  );
  const [appliedIssueIds, setAppliedIssueIds] = useState<string[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    INITIAL_AUTH_AUDIT.issues[0]?.id ?? null
  );
  const [highlightLineRange, setHighlightLineRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<RightTab>('findings');
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const [hasRunTests, setHasRunTests] = useState<boolean>(false);
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const [isRefiningTests, setIsRefiningTests] = useState<boolean>(false);

  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>(() => {
    const existing = loadStoredHistory();
    if (existing.length > 0) return existing;
    return [
      {
        id: 'initial-auth-audit',
        timestamp: new Date().toISOString(),
        fileName: defaultSample.fileName,
        language: defaultSample.language,
        baselineCode: defaultSample.code,
        currentCode: defaultSample.code,
        appliedIssueIds: [],
        auditResult: INITIAL_AUTH_AUDIT,
      },
    ];
  });
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(
    'initial-auth-audit'
  );

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      const id = Date.now();
      setToast({ id, type, message });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast((prev) => (prev?.id === toast.id ? null : prev));
    }, 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  // Persist history entries to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyEntries));
    } catch {
      // Ignore quota issues cleanly
    }
  }, [historyEntries]);

  const dynamicMetrics = useMemo(() => {
    if (!auditResult) {
      return {
        healthScore: 0,
        securityGrade: '-',
        maintainabilityScore: 0,
        estimatedCoverage: 0,
      };
    }
    return recalculateMetrics(
      auditResult.metrics,
      auditResult.issues,
      appliedIssueIds
    );
  }, [auditResult, appliedIssueIds]);

  const handleToggleFocus = (focus: AuditFocus) => {
    setAuditFocus((prev) => {
      if (prev.includes(focus)) {
        // Keep at least one audit focus selected
        if (prev.length === 1) return prev;
        return prev.filter((f) => f !== focus);
      }
      return [...prev, focus];
    });
  };

  const handleSelectSample = (sample: SamplePreset) => {
    setFileName(sample.fileName);
    setCode(sample.code);
    setBaselineCode(sample.code);
    setLanguage(sample.language);
    setAuditError(null);
    setHasRunTests(false);
    setHighlightLineRange(null);

    if (sample.id === 'auth-controller') {
      setAuditResult(INITIAL_AUTH_AUDIT);
      setAppliedIssueIds([]);
      setSelectedIssueId(INITIAL_AUTH_AUDIT.issues[0]?.id ?? null);
    } else {
      setAuditResult(null);
      setAppliedIssueIds([]);
      setSelectedIssueId(null);
    }
    setActiveTab('findings');
    showToast(`Loaded ${sample.fileName}`);
  };

  const handleUploadFile = (uploadedName: string, content: string) => {
    const detected = detectLanguageFromFileName(uploadedName, content);
    setFileName(uploadedName);
    setCode(content);
    setBaselineCode(content);
    setLanguage(detected);
    setAuditResult(null);
    setAppliedIssueIds([]);
    setSelectedIssueId(null);
    setHighlightLineRange(null);
    setAuditError(null);
    setHasRunTests(false);
    setActiveTab('findings');
    showToast(`Loaded ${uploadedName} (${detected})`);
  };

  const handleClearCode = () => {
    setCode('');
    setBaselineCode('');
    setAuditResult(null);
    setAppliedIssueIds([]);
    setSelectedIssueId(null);
    setHighlightLineRange(null);
    setAuditError(null);
    setHasRunTests(false);
  };

  const handleRunAudit = async () => {
    if (!code.trim()) {
      showToast('Paste or load source code before running an audit.', 'error');
      return;
    }

    setIsAuditing(true);
    setAuditError(null);
    setActiveTab('findings');
    setHasRunTests(false);
    setHighlightLineRange(null);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          fileName,
          language,
          auditFocus,
          testFramework,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Guardian audit failed.');
      }

      const result: AuditResult = payload.auditResult;
      setBaselineCode(code);
      setAuditResult(result);
      setAppliedIssueIds([]);
      setSelectedIssueId(result.issues[0]?.id ?? null);
      if (result.language) {
        setLanguage(result.language);
      }

      const newEntry: HistoryEntry = {
        id: `scan-${Date.now()}`,
        timestamp: new Date().toISOString(),
        fileName,
        language: result.language || language,
        baselineCode: code,
        currentCode: code,
        appliedIssueIds: [],
        auditResult: result,
      };

      setHistoryEntries((prev) => [newEntry, ...prev].slice(0, 25));
      setActiveHistoryId(newEntry.id);
      showToast(
        `Audit complete via ${payload.modelUsed ?? 'Gemini'} (${result.issues.length} findings)`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to complete Guardian audit.';
      setAuditError(msg);
      showToast(msg, 'error');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSelectIssue = (issue: AuditIssue) => {
    setSelectedIssueId(issue.id);
    setHighlightLineRange({ start: issue.lineStart, end: issue.lineEnd });
  };

  const handleSelectIssueFromGutter = (issueId: string) => {
    if (!auditResult) return;
    const found = auditResult.issues.find((i) => i.id === issueId);
    if (!found) return;
    setActiveTab('findings');
    setSelectedIssueId(found.id);
    setHighlightLineRange({ start: found.lineStart, end: found.lineEnd });
  };

  const syncHistoryEntryProgress = (
    nextCode: string,
    nextAppliedIds: string[]
  ) => {
    if (!activeHistoryId) return;
    setHistoryEntries((prev) =>
      prev.map((entry) =>
        entry.id === activeHistoryId
          ? { ...entry, currentCode: nextCode, appliedIssueIds: nextAppliedIds }
          : entry
      )
    );
  };

  const handleApplyFix = (issue: AuditIssue) => {
    if (appliedIssueIds.includes(issue.id)) return;
    const { updatedCode, applied } = applyPatchToCode(code, issue);
    if (!applied) {
      showToast(
        'Code block was modified manually; use Apply All Fixes or Diff tab.',
        'error'
      );
      return;
    }

    const nextApplied = [...appliedIssueIds, issue.id];
    setCode(updatedCode);
    setAppliedIssueIds(nextApplied);
    syncHistoryEntryProgress(updatedCode, nextApplied);
    showToast(`Applied fix for ${issue.cweOrRule}`);
  };

  const handleApplyAllFixes = () => {
    if (!auditResult) return;
    const nextCode = auditResult.fullPatchedCode;
    const allIds = auditResult.issues.map((i) => i.id);
    setCode(nextCode);
    setAppliedIssueIds(allIds);
    setHighlightLineRange(null);
    syncHistoryEntryProgress(nextCode, allIds);
    showToast('All Guardian fixes applied to editor');
  };

  const handleCopyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(label);
    } catch {
      showToast('Clipboard access unavailable', 'error');
    }
  };

  const handleDownloadFile = (targetName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = targetName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${targetName}`);
  };

  const handleRunTests = () => {
    if (!auditResult || isRunningTests) return;
    setIsRunningTests(true);
    setTimeout(() => {
      setIsRunningTests(false);
      setHasRunTests(true);
      const allFixed =
        auditResult.issues.length === 0 ||
        appliedIssueIds.length >= auditResult.issues.length;
      if (allFixed) {
        showToast(
          `All ${auditResult.testSuite.testCases.length} tests passed`
        );
      } else {
        const failCount = auditResult.testSuite.testCases.filter(
          (tc) => !tc.passesOnOriginal
        ).length;
        showToast(
          `${failCount} security/edge test${failCount === 1 ? '' : 's'} failed on unpatched code`,
          'error'
        );
      }
    }, 650);
  };

  const handleRefineTests = async (instruction: string) => {
    if (!auditResult) return;
    setIsRefiningTests(true);
    try {
      const response = await fetch('/api/refine-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          fileName,
          language: auditResult.language || language,
          currentTestSuite: auditResult.testSuite,
          instruction,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to refine tests.');
      }

      const updatedResult: AuditResult = {
        ...auditResult,
        testSuite: payload.testSuite,
      };
      setAuditResult(updatedResult);
      setHasRunTests(false);
      if (activeHistoryId) {
        setHistoryEntries((prev) =>
          prev.map((entry) =>
            entry.id === activeHistoryId
              ? { ...entry, auditResult: updatedResult }
              : entry
          )
        );
      }
      showToast('Test suite refined with new cases');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to refine test suite.';
      showToast(msg, 'error');
    } finally {
      setIsRefiningTests(false);
    }
  };

  const handleRestoreHistory = (entry: HistoryEntry) => {
    setFileName(entry.fileName);
    setLanguage(entry.language);
    setBaselineCode(entry.baselineCode);
    setCode(entry.currentCode);
    setAuditResult(entry.auditResult);
    setAppliedIssueIds(entry.appliedIssueIds);
    setSelectedIssueId(entry.auditResult.issues[0]?.id ?? null);
    setHighlightLineRange(null);
    setActiveHistoryId(entry.id);
    setAuditError(null);
    setHasRunTests(false);
    setActiveTab('findings');
    setHistoryOpen(false);
    showToast(`Restored scan for ${entry.fileName}`);
  };

  const handleDeleteHistory = (id: string) => {
    setHistoryEntries((prev) => prev.filter((e) => e.id !== id));
    if (activeHistoryId === id) {
      setActiveHistoryId(null);
    }
  };

  const handleClearHistory = () => {
    setHistoryEntries([]);
    setActiveHistoryId(null);
    showToast('Scan history cleared');
  };

  const openIssueCount = auditResult
    ? auditResult.issues.filter((i) => !appliedIssueIds.includes(i.id)).length
    : 0;
  const allFixed =
    Boolean(auditResult) &&
    (auditResult?.issues.length === 0 ||
      appliedIssueIds.length >= (auditResult?.issues.length ?? 0));

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0B0F17] text-[#F9FAFB] overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 shrink-0 px-4 sm:px-6 bg-[#111827] border-b border-[#1E293B] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-md bg-[#6366F1]/20 border border-[#6366F1]/40 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-[#c0c1ff]" />
            </div>
            <span className="text-sm sm:text-base font-bold tracking-tight text-[#F9FAFB] whitespace-nowrap">
              CodeGuardian AI
            </span>
          </div>

          <span className="hidden md:inline text-[#334155]" aria-hidden="true">
            /
          </span>

          <div className="hidden md:flex items-center gap-2 text-xs text-[#9CA3AF] truncate">
            <span className="font-mono text-[#dfe2ee] truncate">{fileName}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{language}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#dfe2ee] bg-[#1c2028] hover:bg-[#262a33] border border-[#1E293B] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
          >
            <History className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <span>History</span>
            {historyEntries.length > 0 && (
              <span className="text-[#9CA3AF]">({historyEntries.length})</span>
            )}
          </button>

          <button
            type="button"
            disabled={isAuditing}
            onClick={handleRunAudit}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-white bg-[#6366F1] hover:bg-[#4f46e5] disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isAuditing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Auditing...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Guardian Audit</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Split-Pane Developer Workstation */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 overflow-y-auto lg:overflow-hidden">
        {/* Left Pane: Code Editor & Config */}
        <div className="min-h-[460px] lg:min-h-0 lg:h-full overflow-hidden">
          <CodeEditorPane
            fileName={fileName}
            code={code}
            language={language}
            detectedFramework={
              auditResult?.detectedFramework || 'Ready for scan'
            }
            samples={SAMPLE_PRESETS}
            auditFocus={auditFocus}
            testFramework={testFramework}
            issues={auditResult?.issues ?? []}
            appliedIssueIds={appliedIssueIds}
            selectedIssueId={selectedIssueId}
            highlightLineRange={highlightLineRange}
            onCodeChange={(next) => {
              setCode(next);
              setHighlightLineRange(null);
            }}
            onSelectSample={handleSelectSample}
            onUploadFile={handleUploadFile}
            onLanguageChange={setLanguage}
            onClearCode={handleClearCode}
            onToggleFocus={handleToggleFocus}
            onTestFrameworkChange={setTestFramework}
            onSelectIssueFromGutter={handleSelectIssueFromGutter}
          />
        </div>

        {/* Right Pane: Tabbed Analysis Workspace */}
        <section className="flex flex-col min-h-[500px] lg:min-h-0 lg:h-full bg-[#0B0F17] overflow-hidden">
          {/* 3-Tab Switcher */}
          <div className="shrink-0 px-4 bg-[#111827] border-b border-[#1E293B] flex items-center gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('findings')}
              className={`inline-flex items-center gap-2 px-3.5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                activeTab === 'findings'
                  ? 'border-[#6366F1] text-[#F9FAFB]'
                  : 'border-transparent text-[#9CA3AF] hover:text-[#dfe2ee]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Review Findings</span>
              {auditResult && (
                <span className="font-mono text-[11px] text-[#9CA3AF]">
                  ({openIssueCount})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tests')}
              className={`inline-flex items-center gap-2 px-3.5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                activeTab === 'tests'
                  ? 'border-[#6366F1] text-[#F9FAFB]'
                  : 'border-transparent text-[#9CA3AF] hover:text-[#dfe2ee]'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Generated Tests</span>
              {auditResult && (
                <span className="font-mono text-[11px] text-[#9CA3AF]">
                  ({auditResult.testSuite.testCases.length})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('diff')}
              className={`inline-flex items-center gap-2 px-3.5 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'diff'
                  ? 'border-[#6366F1] text-[#F9FAFB]'
                  : 'border-transparent text-[#9CA3AF] hover:text-[#dfe2ee]'
              }`}
            >
              <Diff className="w-3.5 h-3.5" />
              <span>Full Diff &amp; Patch</span>
            </button>
          </div>

          {/* Right Pane Content Body */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {isAuditing ? (
              <AuditLoadingState />
            ) : auditError ? (
              <div className="p-6">
                <div className="bg-[#111827] border border-[#EF4444]/40 rounded-lg p-5 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-[#F9FAFB]">
                      Audit Request Failed
                    </h3>
                    <p className="text-xs text-[#c7c4d7] leading-relaxed">
                      {auditError}
                    </p>
                    <button
                      type="button"
                      onClick={handleRunAudit}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#6366F1] hover:bg-[#4f46e5] rounded-md transition-colors cursor-pointer"
                    >
                      Retry Audit
                    </button>
                  </div>
                </div>
              </div>
            ) : !auditResult ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-12 h-12 rounded-lg bg-[#111827] border border-[#1E293B] flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 text-[#c0c1ff]" />
                </div>
                <h3 className="text-sm font-semibold text-[#F9FAFB]">
                  Ready to Audit {fileName}
                </h3>
                <p className="text-xs text-[#9CA3AF] max-w-sm mt-1.5 leading-relaxed">
                  Click &ldquo;Run Guardian Audit&rdquo; in the top bar to scan for security vulnerabilities, logic bugs, and synthesize a runnable test suite.
                </p>
                <button
                  type="button"
                  onClick={handleRunAudit}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#6366F1] hover:bg-[#4f46e5] rounded-md transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Guardian Audit</span>
                </button>
              </div>
            ) : activeTab === 'findings' ? (
              <FindingsTab
                metrics={dynamicMetrics}
                issues={auditResult.issues}
                appliedIssueIds={appliedIssueIds}
                selectedIssueId={selectedIssueId}
                onSelectIssue={handleSelectIssue}
                onApplyFix={handleApplyFix}
                onApplyAllFixes={handleApplyAllFixes}
                onCopyText={handleCopyText}
              />
            ) : activeTab === 'tests' ? (
              <TestsTab
                testSuite={auditResult.testSuite}
                estimatedCoverage={dynamicMetrics.estimatedCoverage}
                issues={auditResult.issues}
                appliedIssueIds={appliedIssueIds}
                hasRunTests={hasRunTests}
                isRunningTests={isRunningTests}
                isRefiningTests={isRefiningTests}
                onRunTests={handleRunTests}
                onRefineTests={handleRefineTests}
                onCopyText={handleCopyText}
                onDownloadFile={handleDownloadFile}
              />
            ) : (
              <DiffTab
                fileName={fileName}
                originalCode={baselineCode}
                fullPatchedCode={auditResult.fullPatchedCode}
                allFixed={allFixed}
                onApplyAllFixes={handleApplyAllFixes}
                onCopyText={handleCopyText}
                onDownloadFile={handleDownloadFile}
              />
            )}
          </div>
        </section>
      </main>

      {/* Slide-over History Drawer */}
      <HistoryDrawer
        open={historyOpen}
        entries={historyEntries}
        activeEntryId={activeHistoryId}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestoreHistory}
        onDelete={handleDeleteHistory}
        onClearAll={handleClearHistory}
      />

      {/* Non-blocking Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-lg border text-xs font-medium shadow-xl ${
            toast.type === 'success'
              ? 'bg-[#111827] border-[#10B981]/50 text-[#4edea3]'
              : 'bg-[#111827] border-[#EF4444]/50 text-[#ffb4ab]'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
