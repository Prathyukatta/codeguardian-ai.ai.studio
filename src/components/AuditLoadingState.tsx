import React, { useEffect, useState } from 'react';
import { Check, Loader2, ShieldCheck } from 'lucide-react';

const STEPS = [
  'Parsing AST & Control Flow...',
  'Scanning Security & Edge Cases...',
  'Synthesizing Test Suite...',
];

export const AuditLoadingState: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setActiveStep(1), 1400);
    const timer2 = setTimeout(() => setActiveStep(2), 3000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Progress Card */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-lg p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-md bg-[#6366F1]/15 border border-[#6366F1]/40 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#c0c1ff]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F9FAFB]">
              Guardian Deep Audit Running
            </h3>
            <p className="text-xs text-[#9CA3AF]">
              Analyzing security vectors, control flow, and test assertions
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {STEPS.map((label, idx) => {
            const done = idx < activeStep;
            const current = idx === activeStep;
            return (
              <div
                key={label}
                className={`flex items-center gap-3 px-3 py-2 rounded-md border text-xs font-mono transition-colors ${
                  current
                    ? 'bg-[#6366F1]/10 border-[#6366F1]/50 text-[#F9FAFB]'
                    : done
                    ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#4edea3]'
                    : 'bg-[#0B0F17] border-[#1E293B] text-[#6B7280]'
                }`}
              >
                {done ? (
                  <Check className="w-4 h-4 text-[#10B981] shrink-0" />
                ) : current ? (
                  <Loader2 className="w-4 h-4 text-[#c0c1ff] animate-spin shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-[#334155] shrink-0" />
                )}
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skeleton Executive Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="bg-[#111827] border border-[#1E293B] rounded-lg p-3.5 space-y-2 animate-pulse"
          >
            <div className="h-3 w-20 bg-[#1E293B] rounded" />
            <div className="h-6 w-12 bg-[#262a33] rounded" />
          </div>
        ))}
      </div>

      {/* Skeleton Finding Cards */}
      <div className="space-y-3">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="bg-[#111827] border border-[#1E293B] rounded-lg p-4 space-y-3 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-48 bg-[#262a33] rounded" />
              <div className="h-5 w-16 bg-[#1E293B] rounded" />
            </div>
            <div className="h-3 w-full bg-[#1E293B] rounded" />
            <div className="h-3 w-4/5 bg-[#1E293B] rounded" />
            <div className="h-20 w-full bg-[#0B0F17] border border-[#1E293B] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};
