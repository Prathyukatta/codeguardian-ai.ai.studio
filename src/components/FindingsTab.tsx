import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCheck,
  Copy,
  Info,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import type {
  AuditIssue,
  AuditMetrics,
  Severity,
} from '../types/audit';

interface FindingsTabProps {
  metrics: AuditMetrics;
  issues: AuditIssue[];
  appliedIssueIds: string[];
  selectedIssueId: string | null;
  onSelectIssue: (issue: AuditIssue) => void;
  onApplyFix: (issue: AuditIssue) => void;
  onApplyAllFixes: () => void;
  onCopyText: (text: string, label: string) => void;
}

const SEVERITY_FILTERS: Array<'All' | Severity> = [
  'All',
  'Critical',
  'High',
  'Medium',
  'Low',
];

function getSeverityStyle(severity: Severity) {
  switch (severity) {
    case 'Critical':
      return {
        badge: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
        icon: <AlertOctagon className="w-3.5 h-3.5" />,
      };
    case 'High':
      return {
        badge: 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30',
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
      };
    case 'Medium':
      return {
        badge: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      };
    case 'Low':
      return {
        badge: 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30',
        icon: <Info className="w-3.5 h-3.5" />,
      };
  }
}

function getScoreColor(score: number): string {
  if (score >= 85) return 'text-[#10B981]';
  if (score >= 65) return 'text-[#F59E0B]';
  return 'text-[#EF4444]';
}

function getGradeColor(grade: string): string {
  const g = grade.toUpperCase();
  if (g.startsWith('A')) return 'text-[#10B981]';
  if (g.startsWith('B')) return 'text-[#38BDF8]';
  if (g.startsWith('C')) return 'text-[#F59E0B]';
  return 'text-[#EF4444]';
}

export const FindingsTab: React.FC<FindingsTabProps> = ({
  metrics,
  issues,
  appliedIssueIds,
  selectedIssueId,
  onSelectIssue,
  onApplyFix,
  onApplyAllFixes,
  onCopyText,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'All' | Severity>('All');
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const appliedSet = useMemo(() => new Set(appliedIssueIds), [appliedIssueIds]);

  const counts = useMemo(() => {
    const map: Record<'All' | Severity, number> = {
      All: issues.length,
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    };
    for (const issue of issues) {
      map[issue.severity]++;
    }
    return map;
  }, [issues]);

  const filteredIssues = useMemo(() => {
    if (severityFilter === 'All') return issues;
    return issues.filter((i) => i.severity === severityFilter);
  }, [issues, severityFilter]);

  const remainingCount = issues.filter((i) => !appliedSet.has(i.id)).length;
  const allApplied = issues.length > 0 && remainingCount === 0;

  // Scroll selected issue card into view when triggered from editor gutter dot
  useEffect(() => {
    if (!selectedIssueId) return;
    const el = cardRefs.current[selectedIssueId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedIssueId]);

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* 4 Executive Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-3.5">
          <div className="text-xs text-[#9CA3AF] font-medium">Code Health Score</div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span className={`text-2xl font-bold font-mono ${getScoreColor(metrics.healthScore)}`}>
              {metrics.healthScore}
            </span>
            <span className="text-xs font-mono text-[#6B7280]">/ 100</span>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-3.5">
          <div className="text-xs text-[#9CA3AF] font-medium">Security Grade</div>
          <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
            <span className={`text-2xl font-bold font-mono ${getGradeColor(metrics.securityGrade)}`}>
              {metrics.securityGrade}
            </span>
            <span className="text-xs text-[#6B7280]">
              Maint. {metrics.maintainabilityScore}%
            </span>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-3.5">
          <div className="text-xs text-[#9CA3AF] font-medium">Issues Found</div>
          <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-bold font-mono text-[#F9FAFB]">
              {remainingCount}
            </span>
            <span className="text-xs text-[#6B7280]">
              of {issues.length} open
            </span>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-3.5">
          <div className="text-xs text-[#9CA3AF] font-medium">Est. Test Coverage</div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-bold font-mono text-[#10B981]">
              {metrics.estimatedCoverage}%
            </span>
            <span className="text-xs text-[#6B7280]">target</span>
          </div>
        </div>
      </div>

      {/* Filter Bar + Apply All Fixes */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-[#1E293B]">
        <div className="flex items-center gap-1 flex-wrap pb-2">
          {SEVERITY_FILTERS.map((sev) => {
            const active = severityFilter === sev;
            return (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  active
                    ? 'bg-[#6366F1] text-white'
                    : 'bg-[#111827] text-[#9CA3AF] hover:text-[#F9FAFB] border border-[#1E293B]'
                }`}
              >
                {sev} ({counts[sev]})
              </button>
            );
          })}
        </div>

        <div className="pb-2">
          <button
            type="button"
            disabled={allApplied || issues.length === 0}
            onClick={onApplyAllFixes}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              allApplied
                ? 'bg-[#10B981]/15 text-[#4edea3] border border-[#10B981]/30 cursor-default'
                : 'bg-[#10B981] hover:bg-[#059669] text-[#002113] font-semibold cursor-pointer'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>{allApplied ? 'All Fixes Applied' : 'Apply All Fixes'}</span>
          </button>
        </div>
      </div>

      {/* Issue Cards List */}
      {filteredIssues.length === 0 ? (
        <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-8 text-center">
          <p className="text-sm font-medium text-[#F9FAFB]">
            No findings match the &ldquo;{severityFilter}&rdquo; filter.
          </p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Switch filters or run a fresh Guardian audit to inspect additional categories.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIssues.map((issue) => {
            const isApplied = appliedSet.has(issue.id);
            const isSelected = selectedIssueId === issue.id;
            const sevStyle = getSeverityStyle(issue.severity);
            const origLines = issue.originalCode.split('\n');
            const patchLines = issue.patchedCode.split('\n');

            return (
              <article
                key={issue.id}
                ref={(el) => {
                  cardRefs.current[issue.id] = el as HTMLDivElement | null;
                }}
                onClick={() => onSelectIssue(issue)}
                className={`bg-[#111827] border rounded-lg p-4 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#6366F1] ring-1 ring-[#6366F1]/40'
                    : 'border-[#1E293B] hover:border-[#334155]'
                }`}
              >
                {/* Top Metadata Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-semibold rounded border ${sevStyle.badge}`}
                    >
                      {sevStyle.icon}
                      <span>{issue.severity}</span>
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF] font-mono">
                      <span>{issue.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{issue.cweOrRule}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#c0c1ff] tabular-nums">
                        {issue.lineStart === issue.lineEnd
                          ? `Line ${issue.lineStart}`
                          : `Lines ${issue.lineStart}–${issue.lineEnd}`}
                      </span>
                    </div>
                  </div>

                  {isApplied && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-[#10B981]/15 text-[#4edea3] border border-[#10B981]/30">
                      <Check className="w-3 h-3" />
                      <span>Applied</span>
                    </span>
                  )}
                </div>

                {/* Title & Explanation */}
                <h4 className="text-sm font-semibold text-[#F9FAFB] leading-snug">
                  {issue.title}
                </h4>
                <p className="mt-1.5 text-xs text-[#9CA3AF] leading-relaxed">
                  {issue.explanation}
                </p>

                {/* Inline Red/Green Diff Preview */}
                <div className="mt-3 rounded-md overflow-hidden border border-[#1E293B] bg-[#0B0F17] font-mono text-[12px] leading-5">
                  <div className="overflow-x-auto">
                    {origLines.map((line, idx) => (
                      <div
                        key={`orig-${idx}`}
                        className="flex px-3 py-0.5 bg-[#EF4444]/10 text-[#ffb4ab] whitespace-pre"
                      >
                        <span className="w-5 shrink-0 select-none text-[#EF4444]">
                          -
                        </span>
                        <span>{line || ' '}</span>
                      </div>
                    ))}
                    {patchLines.map((line, idx) => (
                      <div
                        key={`patch-${idx}`}
                        className="flex px-3 py-0.5 bg-[#10B981]/10 text-[#6ffbbe] whitespace-pre"
                      >
                        <span className="w-5 shrink-0 select-none text-[#10B981]">
                          +
                        </span>
                        <span>{line || ' '}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Actions */}
                <div
                  className="mt-3.5 flex items-center justify-end gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onCopyText(issue.patchedCode, 'Patch copied to clipboard')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#dfe2ee] bg-[#1c2028] hover:bg-[#262a33] border border-[#1E293B] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    <span>Copy Patch</span>
                  </button>

                  <button
                    type="button"
                    disabled={isApplied}
                    onClick={() => onApplyFix(issue)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isApplied
                        ? 'bg-[#10B981]/15 text-[#4edea3] border border-[#10B981]/30 cursor-default'
                        : 'bg-[#6366F1] hover:bg-[#4f46e5] text-white cursor-pointer'
                    }`}
                  >
                    {isApplied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Applied</span>
                      </>
                    ) : (
                      <>
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Apply Fix</span>
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
