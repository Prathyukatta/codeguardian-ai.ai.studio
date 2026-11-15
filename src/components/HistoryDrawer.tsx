import React from 'react';
import { Clock, RotateCcw, Trash2, X } from 'lucide-react';
import type { HistoryEntry } from '../types/audit';

interface HistoryDrawerProps {
  open: boolean;
  entries: HistoryEntry[];
  activeEntryId: string | null;
  onClose: () => void;
  onRestore: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

function getScoreBadgeClass(score: number): string {
  if (score >= 85) return 'bg-[#10B981]/15 text-[#4edea3] border-[#10B981]/30';
  if (score >= 65) return 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30';
  return 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30';
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  open,
  entries,
  activeEntryId,
  onClose,
  onRestore,
  onDelete,
  onClearAll,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
      />

      {/* Slide-over Panel */}
      <aside className="relative z-10 w-full max-w-md bg-[#111827] border-l border-[#1E293B] h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#c0c1ff]" />
            <h2 className="text-sm font-semibold text-[#F9FAFB]">
              Audit Scan History
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-[#9CA3AF] hover:text-[#EF4444] px-2 py-1 rounded transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close history drawer"
              className="p-1.5 text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-[#1c2028] rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {entries.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-sm font-medium text-[#dfe2ee]">
                No saved scans yet
              </p>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Completed Guardian audits are automatically persisted locally so you can restore any session.
              </p>
            </div>
          ) : (
            entries.map((entry) => {
              const isActive = entry.id === activeEntryId;
              const date = new Date(entry.timestamp);
              const formatted = date.toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={entry.id}
                  onClick={() => onRestore(entry)}
                  className={`group p-3.5 rounded-lg border transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#6366F1]/10 border-[#6366F1]'
                      : 'bg-[#0B0F17] border-[#1E293B] hover:border-[#334155]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-semibold text-[#F9FAFB] truncate">
                        {entry.fileName}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                        <span>{entry.language}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatted}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded border tabular-nums ${getScoreBadgeClass(
                          entry.auditResult.metrics.healthScore
                        )}`}
                      >
                        {entry.auditResult.metrics.healthScore}/100
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(entry.id);
                        }}
                        title="Delete scan"
                        className="p-1 text-[#6B7280] hover:text-[#EF4444] rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-[#9CA3AF] tabular-nums">
                    <span>
                      Grade {entry.auditResult.metrics.securityGrade} ·{' '}
                      {entry.auditResult.issues.length} findings
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#c0c1ff] opacity-80 group-hover:opacity-100">
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
};
