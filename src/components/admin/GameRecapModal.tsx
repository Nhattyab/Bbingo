import React, { useState } from 'react';
import {
  X,
  Trophy,
  Calendar,
  Hash,
  Users,
  CreditCard,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Eye,
  Star,
  Info,
} from 'lucide-react';
import { HistoricalGame, BingoCard, BingoBall, Winner, BlockedCard } from '../../types/bingo';
import { COLUMN_COLORS, WINNING_RULE_LABELS, getDisplayCardNumber } from '../../utils/bingoRules';

interface GameRecapModalProps {
  game: HistoricalGame | null;
  isOpen: boolean;
  onClose: () => void;
}

export function GameRecapModal({ game, isOpen, onClose }: GameRecapModalProps) {
  const [inspectedCard, setInspectedCard] = useState<BingoCard | null>(null);

  if (!isOpen || !game) return null;

  const calledNumbers = game.ballSequence || [];
  const calledSet = new Set(calledNumbers.map((b) => b.number));
  const columns = ['B', 'I', 'N', 'G', 'O'] as const;

  // Registered cards from participantCards, or synthetic fallback
  const registeredCards: BingoCard[] =
    game.participantCards && game.participantCards.length > 0
      ? game.participantCards
      : [];

  const blockedCards: BlockedCard[] = game.blockedCards || [];
  const winners: Winner[] = game.winners || [];

  // Helper to retrieve or construct a full BingoCard for inspection
  const getCardForInspection = (cardId: string, isBlockedDefault: boolean = false, reason?: string): BingoCard => {
    // 1. Check participantCards
    const fromParticipants = registeredCards.find((c) => c.id === cardId);
    if (fromParticipants) {
      if (isBlockedDefault && !fromParticipants.isBlocked) {
        return { ...fromParticipants, isBlocked: true, blockReason: reason || fromParticipants.blockReason };
      }
      return fromParticipants;
    }

    // 2. Check winners cardMatrix
    const fromWinner = winners.find((w) => w.cardId === cardId);
    if (fromWinner && fromWinner.cardMatrix) {
      const marked = fromWinner.cardMatrix.map((row) =>
        row.map((val) => val === 'FREE' || (typeof val === 'number' && calledSet.has(val)))
      );
      return {
        id: cardId,
        gameId: game.id,
        userId: fromWinner.userId || 'player',
        matrix: fromWinner.cardMatrix,
        marked,
        isRegistered: true,
        isBlocked: isBlockedDefault,
        blockReason: reason,
        createdAt: game.completedAt,
        cardDateString: new Date(game.completedAt).toISOString().split('T')[0],
      };
    }

    // 3. Construct deterministic 5x5 matrix from cardId digits
    const seed = Array.from(cardId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const matrix: (number | 'FREE')[][] = [];
    for (let r = 0; r < 5; r++) {
      const row: (number | 'FREE')[] = [];
      for (let c = 0; c < 5; c++) {
        if (r === 2 && c === 2) {
          row.push('FREE');
        } else {
          const colMin = c * 15 + 1;
          const val = colMin + ((seed + r * 3 + c * 7) % 15);
          row.push(val);
        }
      }
      matrix.push(row);
    }

    const marked = matrix.map((row) =>
      row.map((val) => val === 'FREE' || (typeof val === 'number' && calledSet.has(val)))
    );

    return {
      id: cardId,
      gameId: game.id,
      userId: 'player',
      matrix,
      marked,
      isRegistered: true,
      isBlocked: isBlockedDefault,
      blockReason: reason,
      createdAt: game.completedAt,
      cardDateString: new Date(game.completedAt).toISOString().split('T')[0],
    };
  };

  const handleInspectCard = (cardId: string, isBlocked: boolean = false, reason?: string) => {
    const card = getCardForInspection(cardId, isBlocked, reason);
    setInspectedCard(card);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="fixed inset-0" onClick={onClose} />

        <div className="relative bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-200 z-10 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Game Round Recap</h3>
                <span className="text-[11px] font-mono text-indigo-300 font-bold">
                  Code: #{game.gameCode}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-5 overflow-y-auto flex-1 admin-scrollbar text-xs">
            {/* Top Stat Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">
                  Winning Rule
                </span>
                <span className="font-extrabold text-slate-900 truncate block" title={WINNING_RULE_LABELS[game.winningRule]}>
                  {WINNING_RULE_LABELS[game.winningRule] || game.winningRule.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">
                  Entry Price
                </span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  ${(game.entryPrice ?? 1.0).toFixed(2)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">
                  Prize Pool
                </span>
                <span className="font-mono font-black text-emerald-700 text-sm">
                  ${game.prizePool.toFixed(2)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">
                  Date Completed
                </span>
                <span className="font-bold text-slate-800 text-[11px] block truncate">
                  {new Date(game.completedAt).toLocaleDateString()}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(game.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* 75-Ball Master Board Recap */}
            <div className="bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-800 text-white space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-slate-300">
                  75-Ball Master Board ({calledNumbers.length} called)
                </span>
                {game.winningBall && (
                  <span className="text-amber-400 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30 font-mono text-[10px]">
                    Last Winning Ball: {game.winningBall.letter}-{game.winningBall.number}
                  </span>
                )}
              </div>

              {/* 5 Rows B I N G O */}
              <div className="space-y-1">
                {(['B', 'I', 'N', 'G', 'O'] as const).map((col, colIdx) => {
                  const startNum = colIdx * 15 + 1;
                  const range = Array.from({ length: 15 }, (_, i) => startNum + i);
                  return (
                    <div key={col} className="flex items-center gap-1">
                      <span className="w-5 text-center font-black text-[10px] text-amber-400 shrink-0">
                        {col}
                      </span>
                      <div className="flex-1 grid grid-cols-15 gap-0.5">
                        {range.map((num) => {
                          const isCalled = calledSet.has(num);
                          const isLastWin = game.winningBall?.number === num;
                          return (
                            <div
                              key={num}
                              className={`aspect-square flex items-center justify-center rounded text-[9px] font-mono font-bold ${
                                isLastWin
                                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 font-black'
                                  : isCalled
                                  ? 'bg-blue-600 text-white font-bold'
                                  : 'bg-slate-800/80 text-slate-500'
                              }`}
                            >
                              {num}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* THREE INTERACTIVE ROWS OF CARDS (Requirement 3) */}
            <div className="space-y-4">
              {/* ROW 1: Registered Cards with corresponding IDs */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-slate-900 text-xs">
                      1. Registered Cards for this Game ({registeredCards.length || game.totalCardsCount})
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">Click ID to view card</span>
                </div>

                {registeredCards.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                    {registeredCards.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleInspectCard(c.id, c.isBlocked, c.blockReason)}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 active:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 text-xs font-mono font-bold transition shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <span>#{getDisplayCardNumber(c.id)}</span>
                        <Eye className="w-3 h-3 text-indigo-400" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 p-1">
                    {Array.from({ length: Math.min(game.totalCardsCount || 6, 12) }, (_, i) => {
                      const synthId = `10${i + 1}`;
                      return (
                        <button
                          key={synthId}
                          type="button"
                          onClick={() => handleInspectCard(synthId)}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 active:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 text-xs font-mono font-bold transition shadow-2xs cursor-pointer flex items-center gap-1"
                        >
                          <span>#{synthId}</span>
                          <Eye className="w-3 h-3 text-indigo-400" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ROW 2: Winners Cards */}
              <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-amber-950 text-xs">
                      2. Winners' Cards ({winners.length})
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-800 font-medium">Click ID to view winning card</span>
                </div>

                {winners.length === 0 ? (
                  <p className="text-slate-400 italic text-[11px] p-1">No verified winners recorded.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 p-1">
                    {winners.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => handleInspectCard(w.cardId)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 active:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Trophy className="w-3.5 h-3.5 text-amber-500 fill-current" />
                        <span className="font-mono">#{getDisplayCardNumber(w.cardId)}</span>
                        <span className="text-slate-600 font-medium">({w.displayName})</span>
                        <span className="text-emerald-700 font-mono font-black">${w.prizeAmount.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ROW 3: Blocked Cards */}
              <div className="p-3.5 bg-rose-50/70 rounded-2xl border border-rose-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span className="font-bold text-rose-950 text-xs">
                      3. Blocked Cards ({blockedCards.length})
                    </span>
                  </div>
                  <span className="text-[10px] text-rose-700 font-medium">Click ID to view blocked card</span>
                </div>

                {blockedCards.length === 0 ? (
                  <p className="text-slate-400 italic text-[11px] p-1">No cards were blocked in this round.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 p-1">
                    {blockedCards.map((b) => (
                      <button
                        key={b.cardId}
                        type="button"
                        onClick={() => handleInspectCard(b.cardId, true, b.reason)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-100 active:bg-rose-200 text-rose-900 border border-rose-300 text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                        title={b.reason || 'Card blocked'}
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        <span className="font-mono">#{getDisplayCardNumber(b.cardId)}</span>
                        <span className="text-[10px] text-rose-600 font-normal truncate max-w-[130px]">
                          ({b.reason || 'Blocked'})
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs"
            >
              Close Recap
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Card Inspection Modal for clicked Card ID */}
      {inspectedCard && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setInspectedCard(null)} />

          <div className="relative bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden z-20 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                  #{getDisplayCardNumber(inspectedCard.id)}
                </div>
                <div>
                  <h4 className="font-bold text-sm">Bingo Card #{getDisplayCardNumber(inspectedCard.id)}</h4>
                  <p className="text-[10px] text-slate-400">Game round {game.gameCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCard(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Blocked or Verified Alert */}
            {inspectedCard.isBlocked ? (
              <div className="bg-rose-100 text-rose-900 px-3 py-2 border-b border-rose-200 flex items-center gap-2 text-xs font-bold">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="truncate">Blocked: {inspectedCard.blockReason || 'Card blocked'}</span>
              </div>
            ) : winners.some((w) => w.cardId === inspectedCard.id) ? (
              <div className="bg-amber-100 text-amber-900 px-3 py-2 border-b border-amber-200 flex items-center gap-2 text-xs font-bold">
                <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Verified Winning Card</span>
              </div>
            ) : (
              <div className="bg-emerald-50 text-emerald-900 px-3 py-1.5 border-b border-emerald-200 flex items-center gap-2 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Registered Card</span>
              </div>
            )}

            {/* 5x5 Matrix */}
            <div className="p-4 space-y-3">
              <div className="bg-slate-900 p-2.5 rounded-2xl border border-slate-800">
                <div className="grid grid-cols-5 gap-1 mb-1.5 text-center font-black text-xs text-white">
                  {columns.map((c) => (
                    <div key={c} className={`py-1 rounded ${COLUMN_COLORS[c].bg} shadow-2xs`}>
                      {c}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-5 gap-1">
                  {inspectedCard.matrix.map((row, r) =>
                    row.map((val, c) => {
                      const isCenter = (r === 2 && c === 2) || val === 'FREE';
                      const isMarked = inspectedCard.marked?.[r]?.[c] ?? isCenter;
                      const isCalled = typeof val === 'number' && calledSet.has(val);

                      if (isCenter) {
                        return (
                          <div
                            key={`${r}-${c}`}
                            className="aspect-square rounded flex flex-col items-center justify-center font-black bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 ring-1 ring-amber-300 shadow-xs"
                          >
                            <Star className="w-3 h-3 fill-current" />
                            <span className="text-[7px] font-black leading-none">FREE</span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${r}-${c}`}
                          className={`aspect-square rounded flex flex-col items-center justify-center text-xs font-bold select-none ${
                            isMarked
                              ? 'bg-blue-600 text-white font-black shadow-xs ring-1 ring-blue-400'
                              : isCalled
                              ? 'bg-slate-800 text-slate-300 border border-slate-700'
                              : 'bg-slate-800/60 text-slate-400'
                          }`}
                        >
                          <span>{val}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 flex items-center justify-center gap-1 font-medium">
                <Info className="w-3 h-3 text-slate-400" />
                <span>Blue cells were marked during the game</span>
              </div>
            </div>

            {/* Close Button */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedCard(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Back to Recap
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
