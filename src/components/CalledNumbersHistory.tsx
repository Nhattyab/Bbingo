import React from 'react';
import { BingoBall } from '../types/bingo';
import { COLUMN_COLORS } from '../utils/bingoRules';
import { Radio } from 'lucide-react';

interface CalledNumbersHistoryProps {
  calledNumbers: BingoBall[];
  selectedNumber: number | null;
  onSelectBall?: (ball: BingoBall) => void;
}

export const CalledNumbersHistory: React.FC<CalledNumbersHistoryProps> = ({
  calledNumbers,
  selectedNumber,
  onSelectBall,
}) => {
  // Reverse order: latest first
  const reversed = [...calledNumbers].reverse();

  if (calledNumbers.length === 0) {
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-xs border border-slate-200/80 p-2 sm:p-2.5 flex items-center justify-between text-[11px] sm:text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
          <span className="font-semibold text-slate-700">Called Numbers:</span>
          <span>Waiting for host to call the first number...</span>
        </div>
      </div>
    );
  }

  const latestBall = reversed[0];

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-xs border border-slate-200/80 p-2 sm:p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-bold text-slate-900">Called Numbers</span>
          <span className="font-mono text-[9px] sm:text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-full font-semibold">
            {calledNumbers.length} Called
          </span>
        </div>

        {latestBall && (
          <div className="flex items-center gap-1 text-[11px] sm:text-xs">
            <span className="text-slate-500 font-medium">Latest:</span>
            <span className="font-black text-[11px] sm:text-xs px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-950 shadow-2xs animate-pulse font-mono">
              {latestBall.letter}-{latestBall.number}
            </span>
          </div>
        )}
      </div>

      {/* Horizontal Scrollable Ball Stream */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
        {reversed.map((ball, idx) => {
          const colColor = COLUMN_COLORS[ball.letter];
          const isLatest = idx === 0;
          const isSelected = selectedNumber === ball.number;

          return (
            <button
              key={`${ball.number}-${ball.sequence}`}
              type="button"
              onClick={() => onSelectBall?.(ball)}
              className={`shrink-0 w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                isLatest
                  ? 'bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 font-black shadow-md ring-2 ring-amber-300 scale-102'
                  : isSelected
                  ? 'bg-indigo-600 text-white font-black shadow-md ring-2 ring-indigo-400 scale-102'
                  : `${colColor.bg} text-white shadow-xs hover:scale-102`
              }`}
            >
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-tighter opacity-90 leading-none">
                {ball.letter}
              </span>
              <span className="text-xs sm:text-sm font-extrabold leading-none mt-0.5 font-mono">
                {ball.number}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
