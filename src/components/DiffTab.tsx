import React, { useMemo } from 'react';
import { CheckCheck, Copy, Download } from 'lucide-react';
import { computeLineDiff } from '../utils/diff';

interface DiffTabProps {
  fileName: string;
  originalCode: string;
  fullPatchedCode: string;
  allFixed: boolean;
  onApplyAllFixes: () => void;
  onCopyText: (text: string, label: string) => void;
  onDownloadFile: (fileName: string, content: string) => void;
}

export const DiffTab: React.FC<DiffTabProps> = ({
  fileName,
  originalCode,
  fullPatchedCode,
  allFixed,
  onApplyAllFixes,
  onCopyText,
  onDownloadFile,
}) => {
  const diffLines = useMemo(
    () => computeLineDiff(originalCode, fullPatchedCode),
    [originalCode, fullPatchedCode]
  );

  const additions = useMemo(
    () => diffLines.filter((d) => d.type === 'add').length,
    [diffLines]
  );
  const deletions = useMemo(
    () => diffLines.filter((d) => d.type === 'remove').length,
    [diffLines]
  );

  const patchedFileName = useMemo(() => {
    const dotIdx = fileName.lastIndexOf('.');
    if (dotIdx === -1) return `${fileName}.patched`;
    return `${fileName.slice(0, dotIdx)}.patched${fileName.slice(dotIdx)}`;
  }, [fileName]);

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Action Header */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <span className="text-[#F9FAFB] font-medium">{fileName}</span>
          <span aria-hidden="true" className="text-[#6B7280]">
            ·
          </span>
          <span className="text-[#4edea3]">+{additions} additions</span>
          <span className="text-[#ffb4ab]">-{deletions} deletions</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={allFixed}
            onClick={onApplyAllFixes}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              allFixed
                ? 'bg-[#10B981]/15 text-[#4edea3] border border-[#10B981]/30 cursor-default'
                : 'bg-[#6366F1] hover:bg-[#4f46e5] text-white cursor-pointer'
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>{allFixed ? 'Applied to Editor' : 'Apply All Fixes'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onCopyText(fullPatchedCode, 'Patched code copied to clipboard')
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#dfe2ee] bg-[#1c2028] hover:bg-[#262a33] border border-[#1E293B] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <span>Copy Patched Code</span>
          </button>

          <button
            type="button"
            onClick={() => onDownloadFile(patchedFileName, fullPatchedCode)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#dfe2ee] bg-[#1c2028] hover:bg-[#262a33] border border-[#1E293B] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#9CA3AF]" />
            <span>Download Patched File</span>
          </button>
        </div>
      </div>

      {/* Unified Line-by-Line Diff Table */}
      <div className="bg-[#0B0F17] border border-[#1E293B] rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-[#111827] border-b border-[#1E293B] flex items-center justify-between text-[11px] font-mono text-[#9CA3AF]">
          <span>Baseline Submitted vs. Guardian Patched Output</span>
          <span>Unified Diff</span>
        </div>

        <div className="overflow-x-auto py-2 font-mono text-[12px] leading-5">
          {diffLines.map((line, idx) => {
            const rowClass =
              line.type === 'add'
                ? 'bg-[#10B981]/12 text-[#6ffbbe]'
                : line.type === 'remove'
                ? 'bg-[#EF4444]/12 text-[#ffb4ab]'
                : 'text-[#c7c4d7] hover:bg-[#181c24]/60';

            const prefix =
              line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';

            const prefixColor =
              line.type === 'add'
                ? 'text-[#10B981]'
                : line.type === 'remove'
                ? 'text-[#EF4444]'
                : 'text-[#6B7280]';

            return (
              <div key={idx} className={`flex px-2 ${rowClass}`}>
                <span className="w-10 shrink-0 select-none text-right pr-2 text-[#6B7280] tabular-nums">
                  {line.oldLineNumber ?? ''}
                </span>
                <span className="w-10 shrink-0 select-none text-right pr-3 text-[#6B7280] tabular-nums border-r border-[#1E293B]/70">
                  {line.newLineNumber ?? ''}
                </span>
                <span className={`w-6 shrink-0 select-none text-center ${prefixColor}`}>
                  {prefix}
                </span>
                <span className="whitespace-pre pr-4">{line.content || ' '}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
