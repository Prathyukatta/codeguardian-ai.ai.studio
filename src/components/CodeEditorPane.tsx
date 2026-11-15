import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  FileCode2,
  FolderOpen,
  Trash2,
  Shield,
  Bug,
  Zap,
  Sparkles,
} from 'lucide-react';
import type {
  AuditFocus,
  AuditIssue,
  SamplePreset,
  Severity,
  TestFramework,
} from '../types/audit';
import { tokenizeLine } from '../utils/diff';

interface CodeEditorPaneProps {
  fileName: string;
  code: string;
  language: string;
  detectedFramework: string;
  samples: SamplePreset[];
  auditFocus: AuditFocus[];
  testFramework: TestFramework;
  issues: AuditIssue[];
  appliedIssueIds: string[];
  selectedIssueId: string | null;
  highlightLineRange: { start: number; end: number } | null;
  onCodeChange: (nextCode: string) => void;
  onSelectSample: (sample: SamplePreset) => void;
  onUploadFile: (fileName: string, content: string) => void;
  onLanguageChange: (language: string) => void;
  onClearCode: () => void;
  onToggleFocus: (focus: AuditFocus) => void;
  onTestFrameworkChange: (fw: TestFramework) => void;
  onSelectIssueFromGutter: (issueId: string) => void;
}

const LANGUAGES = [
  'TypeScript',
  'TypeScript (React)',
  'JavaScript',
  'JavaScript (React)',
  'Python',
  'Go',
  'Java',
  'SQL',
  'C++',
];

const TEST_FRAMEWORKS: TestFramework[] = [
  'Auto-Detect',
  'Jest',
  'Vitest',
  'Pytest',
  'JUnit 5',
  'Go Test',
];

const FOCUS_OPTIONS: { id: AuditFocus; label: string; icon: React.ReactNode }[] = [
  { id: 'Security', label: 'Security', icon: <Shield className="w-3.5 h-3.5" /> },
  { id: 'Bugs', label: 'Bugs', icon: <Bug className="w-3.5 h-3.5" /> },
  { id: 'Performance', label: 'Performance', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'Clean Code', label: 'Clean Code', icon: <Sparkles className="w-3.5 h-3.5" /> },
];

const SEVERITY_PRIORITY: Record<Severity, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const SEVERITY_DOT_COLOR: Record<Severity, string> = {
  Critical: 'bg-[#EF4444]',
  High: 'bg-[#F97316]',
  Medium: 'bg-[#F59E0B]',
  Low: 'bg-[#38BDF8]',
};

export const CodeEditorPane: React.FC<CodeEditorPaneProps> = ({
  fileName,
  code,
  language,
  detectedFramework,
  samples,
  auditFocus,
  testFramework,
  issues,
  appliedIssueIds,
  selectedIssueId,
  highlightLineRange,
  onCodeChange,
  onSelectSample,
  onUploadFile,
  onLanguageChange,
  onClearCode,
  onToggleFocus,
  onTestFrameworkChange,
  onSelectIssueFromGutter,
}) => {
  const [sampleMenuOpen, setSampleMenuOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sampleDropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => code.split('\n'), [code]);

  // Close sample dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        sampleDropdownRef.current &&
        !sampleDropdownRef.current.contains(e.target as Node)
      ) {
        setSampleMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll to highlighted line range when selected from right pane
  useEffect(() => {
    if (!highlightLineRange || !textareaRef.current) return;
    const lineHeight = 24; // 1.5rem = 24px
    const targetTop = Math.max(0, (highlightLineRange.start - 4) * lineHeight);
    textareaRef.current.scrollTo({ top: targetTop, behavior: 'smooth' });
  }, [highlightLineRange]);

  const appliedSet = useMemo(() => new Set(appliedIssueIds), [appliedIssueIds]);

  // Map line number -> highest severity unapplied issue on that line
  const lineIssueMap = useMemo(() => {
    const map = new Map<number, AuditIssue>();
    for (const issue of issues) {
      if (appliedSet.has(issue.id)) continue;
      const start = Math.max(1, issue.lineStart);
      const end = Math.max(start, issue.lineEnd);
      for (let ln = start; ln <= end; ln++) {
        const existing = map.get(ln);
        if (
          !existing ||
          SEVERITY_PRIORITY[issue.severity] > SEVERITY_PRIORITY[existing.severity]
        ) {
          map.set(ln, issue);
        }
      }
    }
    return map;
  }, [issues, appliedSet]);

  const selectedIssue = useMemo(
    () => issues.find((i) => i.id === selectedIssueId) ?? null,
    [issues, selectedIssueId]
  );

  const syncScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  };

  const updateCursor = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart ?? 0;
    const before = code.slice(0, pos);
    const split = before.split('\n');
    setCursorPos({
      line: split.length,
      col: split[split.length - 1].length + 1,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = code.slice(0, start) + '  ' + code.slice(end);
      onCodeChange(next);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
          updateCursor();
        }
      });
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUploadFile(file.name, reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <section className="flex flex-col h-full min-h-0 bg-[#0B0F17] border-b lg:border-b-0 lg:border-r border-[#1E293B]">
      {/* Editor Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#111827] border-b border-[#1E293B]">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Load Sample Dropdown */}
          <div className="relative" ref={sampleDropdownRef}>
            <button
              type="button"
              onClick={() => setSampleMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#dfe2ee] bg-[#1c2028] hover:bg-[#262a33] border border-[#1E293B] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileCode2 className="w-3.5 h-3.5 text-[#c0c1ff]" />
              <span>Load Sample</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF]" />
            </button>

            {sampleMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-72 bg-[#111827] border border-[#1E293B] rounded-lg shadow-xl z-30 py-1">
                {samples.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => {
                      onSelectSample(sample);
                      setSampleMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors flex flex-col gap-0.5 cursor-pointer ${
                      sample.fileName === fileName
                        ? 'bg-[#6366F1]/15 text-white'
                        : 'text-[#dfe2ee] hover:bg-[#1c2028]'
                    }`}
                  >
                    <span className="font-mono font-medium text-[#F9FAFB]">
                      {sample.fileName}
                    </span>
                    <span className="text-[11px] text-[#9CA3AF]">
                      {sample.language} · {sample.frameworkHint}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upload File Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".ts,.tsx,.js,.jsx,.py,.go,.java,.sql,.cpp,.c,.h,.hpp"
            onChange={handleFileInput}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#dfe2ee] bg-[#1c2028] hover:bg-[#262a33] border border-[#1E293B] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <span>Upload File</span>
          </button>

          {/* Language Selector */}
          <select
            aria-label="Source language"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium text-[#dfe2ee] bg-[#1c2028] border border-[#1E293B] rounded-md focus:outline-none focus:ring-1 focus:ring-[#6366F1] cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang} className="bg-[#111827] text-[#F9FAFB]">
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline font-mono text-xs text-[#9CA3AF] truncate max-w-[160px]">
            {fileName}
          </span>
          <button
            type="button"
            onClick={onClearCode}
            title="Clear editor"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-[#1c2028] border border-transparent hover:border-[#1E293B] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Synchronized Line-Numbered Editable Code Area */}
      <div className="relative flex-1 min-h-[280px] flex overflow-hidden bg-[#0B0F17]">
        {/* Line Number & Severity Dot Gutter */}
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="w-14 shrink-0 overflow-hidden bg-[#0a0e16] border-r border-[#1E293B] py-3 select-none font-mono text-[13px] leading-6"
        >
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const flaggedIssue = lineIssueMap.get(lineNum);
            const isSelectedLine =
              selectedIssue &&
              !appliedSet.has(selectedIssue.id) &&
              lineNum >= selectedIssue.lineStart &&
              lineNum <= selectedIssue.lineEnd;

            return (
              <div
                key={lineNum}
                className={`h-6 px-2 flex items-center justify-between ${
                  isSelectedLine ? 'bg-[#6366F1]/20 text-[#F9FAFB]' : 'text-[#6B7280]'
                }`}
              >
                <span className="w-3 flex items-center justify-center">
                  {flaggedIssue && (
                    <button
                      type="button"
                      onClick={() => onSelectIssueFromGutter(flaggedIssue.id)}
                      title={`${flaggedIssue.severity}: ${flaggedIssue.title} (Click to inspect)`}
                      className={`w-2 h-2 rounded-full ${
                        SEVERITY_DOT_COLOR[flaggedIssue.severity]
                      } hover:scale-125 transition-transform cursor-pointer`}
                    />
                  )}
                </span>
                <span className="tabular-nums text-[12px]">{lineNum}</span>
              </div>
            );
          })}
        </div>

        {/* Overlay Editor: Highlighted Mirror + Transparent Textarea */}
        <div className="relative flex-1 min-w-0 h-full overflow-hidden">
          <pre
            ref={preRef}
            aria-hidden="true"
            className="absolute inset-0 m-0 py-3 px-4 font-mono text-[13px] leading-6 overflow-hidden pointer-events-none whitespace-pre"
          >
            {lines.map((lineText, idx) => {
              const lineNum = idx + 1;
              const flaggedIssue = lineIssueMap.get(lineNum);
              const isSelectedRange =
                highlightLineRange &&
                lineNum >= highlightLineRange.start &&
                lineNum <= highlightLineRange.end;

              let rowBg = '';
              if (isSelectedRange) {
                rowBg = 'bg-[#6366F1]/18';
              } else if (flaggedIssue) {
                if (
                  flaggedIssue.severity === 'Critical' ||
                  flaggedIssue.severity === 'High'
                ) {
                  rowBg = 'bg-[#EF4444]/10';
                } else {
                  rowBg = 'bg-[#F59E0B]/10';
                }
              }

              const tokens = tokenizeLine(lineText);

              return (
                <div key={lineNum} className={`h-6 -mx-4 px-4 ${rowBg}`}>
                  {tokens.map((tok, tIdx) => (
                    <span key={tIdx} className={tok.className}>
                      {tok.text}
                    </span>
                  ))}
                </div>
              );
            })}
          </pre>

          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            onKeyUp={updateCursor}
            onClick={updateCursor}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            placeholder="Paste or upload source code to audit..."
            className="relative z-10 w-full h-full resize-none bg-transparent text-transparent caret-[#F9FAFB] py-3 px-4 font-mono text-[13px] leading-6 focus:outline-none overflow-auto whitespace-pre selection:bg-[#6366F1]/35 placeholder:text-[#6B7280]"
          />
        </div>
      </div>

      {/* Scan Configuration Strip */}
      <div className="px-4 py-2.5 bg-[#111827] border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium text-[#9CA3AF] mr-1">
            Audit Focus:
          </span>
          {FOCUS_OPTIONS.map((opt) => {
            const active = auditFocus.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onToggleFocus(opt.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#c0c1ff]'
                    : 'bg-[#181c24] border-[#1E293B] text-[#9CA3AF] hover:text-[#dfe2ee] hover:border-[#334155]'
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="test-framework-select"
            className="text-[11px] font-medium text-[#9CA3AF] whitespace-nowrap"
          >
            Test Framework:
          </label>
          <select
            id="test-framework-select"
            value={testFramework}
            onChange={(e) => onTestFrameworkChange(e.target.value as TestFramework)}
            className="px-2.5 py-1 text-xs font-medium text-[#dfe2ee] bg-[#181c24] border border-[#1E293B] rounded-md focus:outline-none focus:ring-1 focus:ring-[#6366F1] cursor-pointer"
          >
            {TEST_FRAMEWORKS.map((fw) => (
              <option key={fw} value={fw} className="bg-[#111827] text-[#F9FAFB]">
                {fw}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Editor Status Bar (Real Editor Telemetry Only) */}
      <div className="px-4 py-1.5 bg-[#0a0e16] border-t border-[#1E293B] flex items-center justify-between text-[11px] font-mono text-[#9CA3AF]">
        <div className="flex items-center gap-3 tabular-nums">
          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {lines.length} {lines.length === 1 ? 'line' : 'lines'} · {code.length} chars
          </span>
        </div>
        <div className="flex items-center gap-2 truncate">
          <span>{language}</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#c0c1ff] truncate">{detectedFramework}</span>
        </div>
      </div>
    </section>
  );
};
