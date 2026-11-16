import React, { useState, useMemo } from 'react';
import { History, Eye, Download, Search, Calendar, Trophy, Hash, Filter, RotateCcw, CreditCard, Users } from 'lucide-react';
import { HistoricalGame } from '../../types/bingo';
import { WINNING_RULE_LABELS } from '../../utils/bingoRules';

interface GameHistoryTabProps {
  history: HistoricalGame[];
  onViewRecap: (game: HistoricalGame) => void;
}

export function GameHistoryTab({ history, onViewRecap }: GameHistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days'>('all');

  const applyPreset = (preset: 'all' | 'today' | '7days' | '30days') => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === '7days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setFromDate(past.toISOString().split('T')[0]);
      setToDate(todayStr);
    } else if (preset === '30days') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setFromDate(past.toISOString().split('T')[0]);
      setToDate(todayStr);
    }
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setFromDate('');
    setToDate('');
    setDatePreset('all');
  };

  const filteredHistory = useMemo(() => {
    return [...history]
      .filter((g) => {
        // Search filter
        const ruleLabel = WINNING_RULE_LABELS[g.winningRule] || g.winningRule;
        const searchLower = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !searchLower ||
          g.gameCode.toLowerCase().includes(searchLower) ||
          ruleLabel.toLowerCase().includes(searchLower) ||
          g.winners.some((w) => w.displayName.toLowerCase().includes(searchLower));

        if (!matchesSearch) return false;

        // Date range filter
        if (fromDate) {
          const fromTimestamp = new Date(fromDate + 'T00:00:00').getTime();
          if (g.completedAt < fromTimestamp) return false;
        }

        if (toDate) {
          const toTimestamp = new Date(toDate + 'T23:59:59.999').getTime();
          if (g.completedAt > toTimestamp) return false;
        }

        return true;
      })
      .sort((a, b) => b.completedAt - a.completedAt);
  }, [history, searchTerm, fromDate, toDate]);

  const hasActiveFilters = Boolean(searchTerm || fromDate || toDate);

  const exportCSV = () => {
    const headers = [
      'Game Code',
      'Winning Rule',
      'Date Completed',
      'Entry Price',
      'Registered Cards',
      'Registered Players',
      'Balls Called',
      'Winners',
      'Prize Pool',
    ];
    const rows = filteredHistory.map((g) => [
      g.gameCode,
      `"${(WINNING_RULE_LABELS[g.winningRule] || g.winningRule).replace(/"/g, '""')}"`,
      new Date(g.completedAt).toISOString(),
      (g.entryPrice ?? 1.0).toFixed(2),
      g.totalCardsCount ?? 0,
      g.registeredPlayersCount ?? 0,
      g.ballsCalledCount,
      `"${g.winners.map((w) => w.displayName).join(', ')}"`,
      g.prizePool.toFixed(2),
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bingo_game_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Game History & Reports</h2>
          <p className="text-xs text-slate-500">
            Archived game rounds, winning rules, entry fees, registered cards, and auditable ball histories
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={filteredHistory.length === 0}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition shadow-xs shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Filter and Date Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by game code, winning rule, or winner name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 shrink-0">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border ${
                  datePreset === p.id && (!fromDate || p.id !== 'all')
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Filter (From - To) Mechanism */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-700 text-xs">Date Filter:</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <span className="text-[11px] text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setDatePreset('all');
                }}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <span className="text-[11px] text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setDatePreset('all');
                }}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition text-[11px] font-bold cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>

          <div className="ml-auto text-slate-500 text-[11px] font-medium">
            Showing <strong className="text-slate-800">{filteredHistory.length}</strong> of{' '}
            {history.length} games
          </div>
        </div>

        {/* Games Table */}
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No game records match your criteria</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search terms or expanding the date filter.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-3 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-3.5">Game Code</th>
                  <th className="py-3 px-3.5">Winning Rule</th>
                  <th className="py-3 px-3.5">Date Completed</th>
                  <th className="py-3 px-3.5">Cards & Players</th>
                  <th className="py-3 px-3.5">Entry Price</th>
                  <th className="py-3 px-3.5">Balls Drawn</th>
                  <th className="py-3 px-3.5">Winner(s)</th>
                  <th className="py-3 px-3.5">Prize Pool</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map((g) => {
                  const ruleLabel = WINNING_RULE_LABELS[g.winningRule] || g.winningRule.replace(/_/g, ' ');
                  const entryPrice = g.entryPrice ?? 1.0;
                  const cardsCount = g.totalCardsCount ?? 0;
                  const playersCount = g.registeredPlayersCount ?? 0;

                  return (
                    <tr key={g.id} className="hover:bg-slate-50/70 transition">
                      {/* Game Code */}
                      <td className="py-3.5 px-3.5">
                        <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 tracking-tight">
                          {g.gameCode}
                        </span>
                      </td>

                      {/* Rule Only (Replaced Title & Rule column) */}
                      <td className="py-3.5 px-3.5">
                        <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
                          {ruleLabel}
                        </span>
                      </td>

                      {/* Date Completed */}
                      <td className="py-3.5 px-3.5 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(g.completedAt).toLocaleDateString()}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(g.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      {/* Number of Registered Cards and Players */}
                      <td className="py-3.5 px-3.5 text-slate-700 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <Hash className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{cardsCount} {cardsCount === 1 ? 'card' : 'cards'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 font-medium mt-0.5">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span>{playersCount} {playersCount === 1 ? 'player' : 'players'}</span>
                        </div>
                      </td>

                      {/* Entry Price */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-emerald-600" />
                          <span>${entryPrice.toFixed(2)}</span>
                        </span>
                      </td>

                      {/* Balls Drawn */}
                      <td className="py-3.5 px-3.5 text-slate-600 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-800">
                          {g.ballsCalledCount}
                        </span>{' '}
                        <span className="text-[10px] text-slate-400">/ 75</span>
                      </td>

                      {/* Winners */}
                      <td className="py-3.5 px-3.5">
                        {g.winners.length === 0 ? (
                          <span className="text-slate-400 italic">No winners</span>
                        ) : (
                          <div className="space-y-1">
                            {g.winners.map((w) => (
                              <div key={w.id} className="flex items-center gap-1.5 text-emerald-700 font-bold">
                                <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="truncate max-w-[120px]">{w.displayName}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Prize Pool */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap">
                        <span className="font-mono font-black text-emerald-700 text-xs">
                          ${g.prizePool.toFixed(2)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onViewRecap(g)}
                          className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition shadow-2xs active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Recap</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
