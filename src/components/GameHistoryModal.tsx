import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  Trophy,
  Award,
  Clock,
  ArrowLeft,
  Calendar,
  Sparkles,
  ShieldAlert,
  CreditCard,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { HistoricalGame, User, BingoCard, BingoBall } from '../types/bingo';
import { WINNING_RULE_LABELS, COLUMN_COLORS, getDisplayCardNumber } from '../utils/bingoRules';
import { BingoBoard75 } from './BingoBoard75';
import { CardInspectModal } from './CardInspectModal';

interface GameHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
}

export const GameHistoryModal: React.FC<GameHistoryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [games, setGames] = useState<HistoricalGame[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [selectedGame, setSelectedGame] = useState<HistoricalGame | null>(null);
  const [inspectedCard, setInspectingCard] = useState<BingoCard | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/admin/history')
        .then((res) => res.json())
        .then((data) => {
          setGames(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setSelectedGame(null);
      setInspectingCard(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Filter games played by the current user
  const userPlayedGames = games.filter((g) => {
    if (!currentUser) return true;
    const hasUserCard = g.participantCards?.some((c) => c.userId === currentUser.id);
    const hasWon = g.winners?.some((w) => w.userId === currentUser.id);
    const hasBlocked = g.blockedCards?.some((b) => b.userId === currentUser.id);
    return hasUserCard || hasWon || hasBlocked;
  });

  // 2. Filter by date range
  const filteredGames = userPlayedGames.filter((g) => {
    const compTime = g.completedAt || 0;
    if (fromDate) {
      const start = new Date(fromDate).getTime();
      if (compTime < start) return false;
    }
    if (toDate) {
      const end = new Date(toDate).getTime() + 86400000;
      if (compTime >= end) return false;
    }
    return true;
  });

  const handleQuickFilter = (days: number | 'all') => {
    if (days === 'all') {
      setFromDate('');
      setToDate('');
      return;
    }
    const today = new Date();
    const toStr = today.toISOString().split('T')[0];
    const past = new Date(today.getTime() - days * 86400000);
    const fromStr = past.toISOString().split('T')[0];
    setFromDate(fromStr);
    setToDate(toStr);
  };

  const getMyCardsForGame = (game: HistoricalGame): BingoCard[] => {
    if (!currentUser) return [];
    if (!game.participantCards) {
      // If legacy historical game has winners matching current user
      const won = game.winners.find((w) => w.userId === currentUser.id);
      if (won) {
        return [
          {
            id: won.cardId,
            gameId: game.id,
            userId: currentUser.id,
            matrix: [
              [1, 16, 31, 46, 61],
              [2, 17, 32, 47, 62],
              [3, 18, 'FREE', 48, 63],
              [4, 19, 34, 49, 64],
              [5, 20, 35, 50, 65],
            ],
            marked: [
              [true, true, true, true, true],
              [false, false, false, false, false],
              [false, false, true, false, false],
              [false, false, false, false, false],
              [false, false, false, false, false],
            ],
            isRegistered: true,
            isBlocked: false,
            createdAt: game.completedAt,
            cardDateString: new Date(game.completedAt).toISOString().split('T')[0],
            registeredAt: game.completedAt,
          },
        ];
      }
      return [];
    }
    return game.participantCards.filter((c) => c.userId === currentUser.id);
  };

  const getCardById = (game: HistoricalGame, cardId: string, fallbackWinner?: any, fallbackBlocked?: any): BingoCard => {
    const found = game.participantCards?.find((c) => c.id === cardId || getDisplayCardNumber(c.id) === getDisplayCardNumber(cardId));
    if (found) return found;

    // Fallback synthetic card representation for inspection
    return {
      id: cardId,
      gameId: game.id,
      userId: fallbackWinner?.userId || fallbackBlocked?.userId || 'unknown',
      matrix: [
        [7, 22, 35, 51, 68],
        [12, 19, 44, 58, 63],
        [3, 27, 'FREE', 49, 75],
        [14, 29, 40, 55, 61],
        [9, 25, 31, 47, 70],
      ],
      marked: fallbackWinner
        ? [
            [true, true, true, true, true],
            [false, false, false, false, false],
            [false, false, true, false, false],
            [false, false, false, false, false],
            [false, false, false, false, false],
          ]
        : [
            [false, false, false, false, false],
            [false, false, false, false, false],
            [false, false, true, false, false],
            [false, false, false, false, false],
            [false, false, false, false, false],
          ],
      isRegistered: true,
      isBlocked: Boolean(fallbackBlocked),
      blockReason: fallbackBlocked?.reason,
      createdAt: game.completedAt,
      cardDateString: new Date(game.completedAt).toISOString().split('T')[0],
    };
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="fixed inset-0" onClick={onClose} />

        <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              {selectedGame ? (
                <button
                  type="button"
                  onClick={() => setSelectedGame(null)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                  title="Back to game history"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  <History className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="font-bold text-sm">
                  {selectedGame ? `Game Recap: ${selectedGame.gameCode}` : 'My Game History'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {selectedGame
                    ? 'Review balls called, winning number, and card results'
                    : 'Games you played, cards registered, and results'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs text-slate-700">
            {selectedGame ? (
              /* ================= RECAP VIEW ================= */
              <div className="space-y-4">
                {/* 1. Top Section: Game code, winning rule, date & time, number of cards I registered */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-2.5 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs sm:text-sm font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                        {selectedGame.gameCode}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {selectedGame.title}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(selectedGame.completedAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Winning Rule
                      </span>
                      <span className="font-bold text-amber-700">
                        {WINNING_RULE_LABELS[selectedGame.winningRule] || selectedGame.winningRule}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        My Cards Registered
                      </span>
                      <span className="font-mono font-bold text-blue-700">
                        {getMyCardsForGame(selectedGame).length} Card(s)
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Total Prize Pool
                      </span>
                      <span className="font-mono font-bold text-emerald-600">
                        ${selectedGame.prizePool.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Middle Section: The 75 Bingo Board with called numbers marked */}
                <div>
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>75-Ball Master Board (Called Numbers Marked)</span>
                  </h4>
                  <BingoBoard75
                    calledNumbers={selectedGame.ballSequence || []}
                    latestBall={selectedGame.winningBall || null}
                  />
                </div>

                {/* 3. Below Board: The Last Winning Number */}
                <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-xs">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-900 block">
                        Last Winning Number
                      </span>
                      <span className="text-xs font-semibold text-amber-800">
                        Ball that triggered the verified Bingo claim
                      </span>
                    </div>
                  </div>

                  {selectedGame.winningBall ? (
                    <div className="flex items-center gap-1.5 bg-white border border-amber-300 px-3 py-1.5 rounded-xl shadow-2xs">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs text-white ${
                          COLUMN_COLORS[selectedGame.winningBall.letter]?.bg || 'bg-blue-600'
                        }`}
                      >
                        {selectedGame.winningBall.letter}
                      </span>
                      <span className="font-mono font-black text-base text-slate-900">
                        {selectedGame.winningBall.number}
                      </span>
                    </div>
                  ) : selectedGame.ballSequence && selectedGame.ballSequence.length > 0 ? (
                    (() => {
                      const lastBall = selectedGame.ballSequence[selectedGame.ballSequence.length - 1];
                      return (
                        <div className="flex items-center gap-1.5 bg-white border border-amber-300 px-3 py-1.5 rounded-xl shadow-2xs">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs text-white ${
                              COLUMN_COLORS[lastBall.letter]?.bg || 'bg-blue-600'
                            }`}
                          >
                            {lastBall.letter}
                          </span>
                          <span className="font-mono font-black text-base text-slate-900">
                            {lastBall.number}
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">N/A</span>
                  )}
                </div>

                {/* 4. Three Rows at the end:
                    Row 1: My registered cards with corresponding IDs (click to inspect)
                    Row 2: Winners cards with corresponding IDs (click to inspect)
                    Row 3: Blocked cards with corresponding IDs (click to inspect) */}
                <div className="space-y-3 pt-2">
                  {/* Row 1: My Registered Cards */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                        <span>Row 1: My Registered Cards</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Click any card ID to view matrix</span>
                    </div>

                    {getMyCardsForGame(selectedGame).length === 0 ? (
                      <p className="text-slate-400 text-xs italic">
                        You had no registered cards in this game round.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {getMyCardsForGame(selectedGame).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setInspectingCard(c)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 transition cursor-pointer shadow-2xs"
                          >
                            <Eye className="w-3 h-3 text-blue-500" />
                            <span>#{getDisplayCardNumber(c.id)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Row 2: Winners Cards */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        <span>Row 2: Winners Cards</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Click any card ID to view matrix</span>
                    </div>

                    {(!selectedGame.winners || selectedGame.winners.length === 0) ? (
                      <p className="text-slate-400 text-xs italic">No confirmed winners recorded.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedGame.winners.map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setInspectingCard(getCardById(selectedGame, w.cardId, w))}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-xs bg-amber-50 text-amber-800 hover:bg-amber-100 active:bg-amber-200 border border-amber-300 transition cursor-pointer shadow-2xs"
                          >
                            <Award className="w-3.5 h-3.5 text-amber-600" />
                            <span>#{getDisplayCardNumber(w.cardId)}</span>
                            <span className="text-[10px] font-sans text-amber-900 bg-amber-200/70 px-1.5 py-0.2 rounded font-semibold">
                              ${w.prizeAmount.toFixed(0)} ({w.displayName})
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Row 3: Blocked Cards */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                        <span>Row 3: Blocked Cards</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Click any card ID to view matrix</span>
                    </div>

                    {(!selectedGame.blockedCards || selectedGame.blockedCards.length === 0) ? (
                      <p className="text-slate-400 text-xs italic">No cards were blocked in this round.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedGame.blockedCards.map((b) => (
                          <button
                            key={b.cardId}
                            type="button"
                            onClick={() => setInspectingCard(getCardById(selectedGame, b.cardId, undefined, b))}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 transition cursor-pointer shadow-2xs"
                          >
                            <ShieldAlert className="w-3 h-3 text-rose-500" />
                            <span>#{getDisplayCardNumber(b.cardId)}</span>
                            <span className="text-[10px] font-sans text-rose-600">
                              (Blocked: {b.reason || 'False claim'})
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* ================= LIST VIEW WITH DATE FILTER ================= */
              <div className="space-y-3.5">
                {/* Date Filters Control Bar */}
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Filter by Date</span>
                    </div>

                    {/* Quick filter chips */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleQuickFilter('all')}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                          !fromDate && !toDate
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFilter(1)}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFilter(7)}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
                      >
                        Last 7 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFilter(30)}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
                      >
                        Last 30 Days
                      </button>
                    </div>
                  </div>

                  {/* Date Input Pickers */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">From:</span>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="bg-transparent text-xs text-slate-800 outline-none cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="bg-transparent text-xs text-slate-800 outline-none cursor-pointer"
                      />
                    </div>
                    {(fromDate || toDate) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFromDate('');
                          setToDate('');
                        }}
                        className="text-[10px] text-blue-600 font-semibold hover:underline px-1 cursor-pointer"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>

                {/* Games List */}
                {loading ? (
                  <div className="text-center py-10 text-slate-400">Loading your game history...</div>
                ) : filteredGames.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-1">
                    <p className="font-bold text-slate-700">No played games found</p>
                    <p className="text-slate-400 text-xs">
                      {fromDate || toDate
                        ? 'No games match your selected date filter.'
                        : 'You haven’t participated in any completed games yet.'}
                    </p>
                  </div>
                ) : (
                  filteredGames.map((g) => {
                    const myCards = getMyCardsForGame(g);
                    return (
                      <div
                        key={g.id}
                        className="p-3.5 bg-white hover:bg-slate-50/90 rounded-2xl border border-slate-200 shadow-2xs transition space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              {g.gameCode}
                            </span>
                            <span className="font-bold text-slate-900 text-xs">{g.title}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {new Date(g.completedAt).toLocaleDateString()} at{' '}
                            {new Date(g.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                          <span>
                            Rule: <strong className="text-slate-800">{WINNING_RULE_LABELS[g.winningRule] || g.winningRule}</strong>
                          </span>
                          <span>
                            My Cards: <strong className="text-blue-700 font-mono">{myCards.length}</strong>
                          </span>
                          <span>
                            Prize Pool: <strong className="text-emerald-600 font-mono">${g.prizePool.toFixed(2)}</strong>
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                            <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="truncate">
                              Winner: {g.winners?.map((w) => w.displayName).join(', ') || 'None'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedGame(g)}
                            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 text-white rounded-xl font-bold text-xs shadow-2xs transition cursor-pointer shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Show Details / Recap</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card Inspection Modal (when an ID is clicked in Recap) */}
      {inspectedCard && (
        <CardInspectModal
          card={inspectedCard}
          calledNumbers={selectedGame?.ballSequence || []}
          onClose={() => setInspectingCard(null)}
        />
      )}
    </>
  );
};
