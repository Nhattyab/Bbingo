import React from 'react';
import {
  Star,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Trophy,
  X,
  Sparkles,
  Clock,
} from 'lucide-react';
import { BingoCard, BingoColumn, GameStatus, BlockedCard } from '../types/bingo';
import { COLUMN_COLORS } from '../utils/bingoRules';

interface BingoCardViewProps {
  cards: BingoCard[];
  calledNumbers: number[];
  gameStatus: GameStatus;
  registrationOpen: boolean;
  claimWindowActive?: boolean;
  claimWindowSeconds?: number;
  blockedCards?: BlockedCard[];
  gridColumns: number;
  sortBy: 'id' | 'recent' | 'registration' | 'marked';
  onToggleMark: (cardId: string, row: number, col: number, currentMarked: boolean) => void;
  onRegisterCard: (cardId: string) => Promise<void>;
  onRegisterAllCards: () => Promise<void>;
  onClaimBingo: (cardId: string) => Promise<void>;
  onPromptDeleteCard: (card: BingoCard) => void;
  onSetGridColumns?: (cols: 1 | 2 | 3) => void;
  registeringCardId: string | null;
  claimingCardId: string | null;
  registrationConflictError?: string | null;
}

const COLUMNS: BingoColumn[] = ['B', 'I', 'N', 'G', 'O'];

export const BingoCardView: React.FC<BingoCardViewProps> = ({
  cards,
  calledNumbers,
  gameStatus,
  registrationOpen,
  claimWindowActive,
  claimWindowSeconds,
  blockedCards,
  gridColumns,
  sortBy,
  onToggleMark,
  onRegisterCard,
  onRegisterAllCards,
  onClaimBingo,
  onPromptDeleteCard,
  onSetGridColumns,
  registeringCardId,
  claimingCardId,
  registrationConflictError,
}) => {
  if (cards.length === 0) {
    return (
      <section
        aria-label="My Bingo Cards"
        className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-8 text-center space-y-3"
      >
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-slate-800 text-sm">No Bingo Cards Generated</h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
            Tap the floating red <span className="font-bold text-rose-600">+</span> button in the bottom-right
            corner to generate random cards for this game. Remember to click "Register Card" after generating!
          </p>
        </div>
      </section>
    );
  }

  // Count marked cells helper for sorting
  const getMarkedCount = (card: BingoCard): number => {
    let count = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (card.marked[r][c]) count++;
      }
    }
    return count;
  };

  // Sort cards according to user preference
  const sortedCards = [...cards].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return b.createdAt - a.createdAt;
      case 'registration':
        if (a.isRegistered === b.isRegistered) return a.id.localeCompare(b.id);
        return a.isRegistered ? -1 : 1;
      case 'marked':
        return getMarkedCount(b) - getMarkedCount(a);
      case 'id':
      default:
        return a.id.localeCompare(b.id, undefined, { numeric: true });
    }
  });

  const unregisteredCount = cards.filter((c) => !c.isRegistered).length;

  const isPlayActive =
    gameStatus === 'running' ||
    gameStatus === 'in_progress' ||
    gameStatus === 'claim_review' ||
    gameStatus === 'checking_winners' ||
    gameStatus === 'starting_countdown' ||
    gameStatus === 'pre_game_countdown';

  const isClaimEligible =
    gameStatus === 'running' ||
    gameStatus === 'in_progress' ||
    gameStatus === 'claim_review' ||
    gameStatus === 'checking_winners' ||
    Boolean(claimWindowActive);

  // Responsive grid class based on gridColumns setting (mobile responsive for 1, 2, and 3 columns)
  const getGridClass = () => {
    if (gridColumns === 1) return 'grid-cols-1';
    if (gridColumns === 2) return 'grid-cols-2 gap-2 sm:gap-3';
    return 'grid-cols-3 gap-1.5 sm:gap-2.5';
  };

  const isCompact = gridColumns >= 2;
  const isVeryCompact = gridColumns === 3;

  return (
    <section
      aria-label="My Bingo Cards"
      className="bg-white rounded-xl sm:rounded-2xl shadow-xs border border-slate-200/80 p-2.5 sm:p-3.5 space-y-2.5 sm:space-y-3.5"
    >
      {/* Top Header of My Cards & Quick Column Selector + Register All */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900">My Bingo Cards</h2>
          <span className="text-[10px] sm:text-xs bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full font-mono">
            {cards.length} {cards.length === 1 ? 'Card' : 'Cards'}
          </span>
          {unregisteredCount > 0 && registrationOpen && (
            <span className="text-[10px] sm:text-[11px] bg-amber-50 text-amber-800 font-bold px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded-full border border-amber-200">
              {unregisteredCount} Unreg
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Column Selector (1, 2, 3 cols) */}
          {onSetGridColumns && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => onSetGridColumns(1)}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  gridColumns === 1 ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="1 Column View"
              >
                1 Col
              </button>
              <button
                type="button"
                onClick={() => onSetGridColumns(2)}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  gridColumns === 2 ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="2 Columns View"
              >
                2 Cols
              </button>
              <button
                type="button"
                onClick={() => onSetGridColumns(3)}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  gridColumns === 3 ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="3 Columns View"
              >
                3 Cols
              </button>
            </div>
          )}

          {/* Register All Button */}
          {unregisteredCount > 1 && registrationOpen && !isPlayActive && (
            <button
              type="button"
              onClick={onRegisterAllCards}
              className="text-[11px] sm:text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <FileCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Register All ({unregisteredCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Registration Conflict Alert */}
      {registrationConflictError && (
        <div className="p-2 sm:p-2.5 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="font-semibold">{registrationConflictError}</span>
        </div>
      )}

      {/* Responsive Continuous Grid for 1, 2, and 3 Columns */}
      <div className={`grid ${getGridClass()}`}>
        {sortedCards.map((card) => {
          const isRegistering = registeringCardId === card.id;
          const isClaiming = claimingCardId === card.id;
          const markedCount = getMarkedCount(card);
          const isCardBlocked = Boolean(card.isBlocked || blockedCards?.some((b) => b.cardId === card.id));
          const cardBlockReason = card.blockReason || blockedCards?.find((b) => b.cardId === card.id)?.reason || 'Card is blocked.';

          return (
            <div
              key={card.id}
              className={`rounded-xl sm:rounded-2xl border transition-all ${
                isVeryCompact ? 'p-1.5 sm:p-2.5' : isCompact ? 'p-2 sm:p-3' : 'p-3 sm:p-3.5'
              } flex flex-col justify-between relative ${
                isCardBlocked
                  ? 'border-rose-300 bg-rose-50/40 shadow-xs'
                  : card.isRegistered
                  ? 'border-indigo-200 bg-slate-50/50 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
              }`}
            >
              {/* Card Meta & Badges */}
              <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2">
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className={`font-mono font-bold text-slate-900 ${
                      isVeryCompact ? 'text-[9px] px-1 py-0.2' : isCompact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
                    } bg-white rounded-md border border-slate-200`}
                  >
                    {card.id}
                  </span>
                  {!isVeryCompact && (
                    <span className="text-[9px] sm:text-[10px] text-slate-500 font-medium">
                      {markedCount}/25
                    </span>
                  )}
                </div>

                {/* Status Badges and Small 'X' Delete Button */}
                <div className="flex items-center gap-1 shrink-0">
                  {isCardBlocked ? (
                    <span
                      className={`flex items-center gap-0.5 ${
                        isVeryCompact ? 'px-1 py-0.2 text-[8px]' : 'px-1.5 py-0.5 text-[9px] sm:text-[10px]'
                      } rounded font-bold bg-rose-100 text-rose-800 border border-rose-200`}
                    >
                      <ShieldAlert className="w-2.5 h-2.5 text-rose-600" />
                      <span>Blocked</span>
                    </span>
                  ) : card.isRegistered ? (
                    <span
                      className={`flex items-center gap-0.5 ${
                        isVeryCompact ? 'px-1 py-0.2 text-[8px]' : 'px-1.5 py-0.5 text-[9px] sm:text-[10px]'
                      } rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-200`}
                    >
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                      <span>Registered</span>
                    </span>
                  ) : (
                    <span
                      className={`${
                        isVeryCompact ? 'px-1 py-0.2 text-[8px]' : 'px-1.5 py-0.5 text-[9px] sm:text-[10px]'
                      } rounded font-bold bg-amber-100 text-amber-900 border border-amber-200`}
                    >
                      {isVeryCompact ? 'Unreg' : 'Not Registered'}
                    </span>
                  )}

                  {/* Small 'X' delete button in top-right of every card */}
                  <button
                    type="button"
                    onClick={() => onPromptDeleteCard(card)}
                    className={`${
                      isVeryCompact ? 'w-4.5 h-4.5' : 'w-5.5 h-5.5'
                    } rounded-full bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer border border-slate-200 hover:border-rose-300`}
                    title={`Delete card ${card.id}`}
                    aria-label={`Delete card ${card.id}`}
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              {/* Blocked Alert Banner on Card */}
              {isCardBlocked && (
                <div className="mb-1.5 px-1.5 py-1 bg-rose-100/90 text-rose-900 rounded-lg text-[9px] sm:text-[10px] font-bold flex items-center gap-1 border border-rose-200 animate-in fade-in">
                  <ShieldAlert className="w-3 h-3 text-rose-600 shrink-0" />
                  <span className="truncate">Blocked: {cardBlockReason}</span>
                </div>
              )}

              {/* 5x5 Card Matrix */}
              <div
                className={`bg-slate-900 ${
                  isVeryCompact ? 'p-1 rounded-lg' : isCompact ? 'p-1.5 rounded-lg' : 'p-2 sm:p-2.5 rounded-xl'
                } shadow-inner border border-slate-800`}
              >
                {/* Column Headers: B, I, N, G, O */}
                <div className={`grid grid-cols-5 ${isVeryCompact ? 'gap-0.5 mb-1' : 'gap-1 mb-1.5'} text-center`}>
                  {COLUMNS.map((col) => {
                    const colColor = COLUMN_COLORS[col];
                    return (
                      <div
                        key={col}
                        className={`${
                          isVeryCompact
                            ? 'py-0.2 text-[8px]'
                            : isCompact
                            ? 'py-0.5 text-[9px] sm:text-[10px]'
                            : 'py-1 text-[11px] sm:text-xs'
                        } rounded font-black text-white ${colColor.bg} tracking-wider shadow-2xs`}
                      >
                        {col}
                      </div>
                    );
                  })}
                </div>

                {/* 5x5 Number Grid */}
                <div className={`grid grid-cols-5 ${isVeryCompact ? 'gap-0.5' : 'gap-1'}`}>
                  {card.matrix.map((row, r) =>
                    row.map((val, c) => {
                      const isCenter = (r === 2 && c === 2) || val === 'FREE';
                      const isMarked = isCenter ? true : Boolean(card.marked[r]?.[c]);

                      if (isCenter) {
                        return (
                          <div
                            key={`${r}-${c}`}
                            className="aspect-square rounded flex flex-col items-center justify-center font-black bg-gradient-to-tr from-amber-400 to-amber-500 text-amber-950 ring-1 sm:ring-2 ring-amber-300 shadow-xs"
                          >
                            <Star className={isVeryCompact ? 'w-2 h-2 fill-current' : 'w-3 h-3 fill-current'} />
                            <span
                              className={`${
                                isVeryCompact ? 'text-[6px]' : isCompact ? 'text-[7px]' : 'text-[9px]'
                              } font-extrabold leading-none`}
                            >
                              FREE
                            </span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={`${r}-${c}`}
                          type="button"
                          disabled={isCardBlocked}
                          onClick={() => {
                            if (isCardBlocked) return;
                            onToggleMark(card.id, r, c, isMarked);
                          }}
                          className={`aspect-square rounded flex flex-col items-center justify-center ${
                            isVeryCompact
                              ? 'text-[9px] leading-none'
                              : isCompact
                              ? 'text-[11px] leading-tight'
                              : 'text-xs'
                          } font-bold transition-all relative select-none cursor-pointer ${
                            isMarked
                              ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-white font-black shadow-xs ring-1 sm:ring-2 ring-emerald-300 scale-98'
                              : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200'
                          } ${isCardBlocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          <span>{val}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Card Action Buttons: Register or Claim */}
              <div className="pt-2 mt-1.5 border-t border-slate-100">
                {!card.isRegistered && !isCardBlocked && (
                  <button
                    type="button"
                    disabled={isRegistering || !registrationOpen || isPlayActive}
                    onClick={() => onRegisterCard(card.id)}
                    className={`w-full ${
                      isVeryCompact ? 'py-1 px-1 text-[9px]' : isCompact ? 'py-1.5 px-2 text-[11px]' : 'py-2 px-3 text-xs'
                    } rounded-lg sm:rounded-xl font-bold flex items-center justify-center gap-1 transition-all shadow-2xs ${
                      registrationOpen && !isPlayActive
                        ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white cursor-pointer'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span className="truncate">
                      {isRegistering
                        ? 'Registering...'
                        : registrationOpen && !isPlayActive
                        ? 'Register'
                        : 'Closed'}
                    </span>
                  </button>
                )}

                {/* Prominent BINGO Claim Button for Registered Card during Active Game */}
                {card.isRegistered && !isCardBlocked && isClaimEligible && (
                  <button
                    type="button"
                    disabled={isClaiming}
                    onClick={() => onClaimBingo(card.id)}
                    className={`w-full ${
                      isVeryCompact
                        ? 'py-1 px-1.5 text-[10px] tracking-normal'
                        : isCompact
                        ? 'py-1.5 px-2 text-xs tracking-wider'
                        : 'py-2.5 px-3 text-sm tracking-widest'
                    } rounded-lg sm:rounded-xl font-black uppercase bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 active:scale-95 text-white shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all border sm:border-2 border-amber-300 ring-1 sm:ring-2 ring-amber-400/50 hover:shadow-lg animate-pulse`}
                  >
                    <Trophy className={isVeryCompact ? 'w-3 h-3 fill-current text-yellow-200' : 'w-4 h-4 fill-current text-yellow-200'} />
                    <span className="truncate">
                      {isClaiming
                        ? 'VERIFYING...'
                        : claimWindowActive && claimWindowSeconds !== undefined && claimWindowSeconds > 0
                        ? `BINGO (${claimWindowSeconds}s)`
                        : 'BINGO'}
                    </span>
                  </button>
                )}

                {/* Pre-game Countdown state for Registered Card */}
                {card.isRegistered && !isCardBlocked && (gameStatus === 'starting_countdown' || gameStatus === 'pre_game_countdown') && (
                  <div
                    className={`w-full ${
                      isVeryCompact ? 'py-1 px-1 text-[8px]' : 'py-1.5 px-2 text-[10px] sm:text-xs'
                    } rounded-lg font-semibold bg-amber-50 text-amber-800 border border-amber-200 text-center flex items-center justify-center gap-1`}
                  >
                    <Clock className="w-3 h-3 text-amber-600 animate-spin shrink-0" />
                    <span className="truncate">Starts Soon</span>
                  </div>
                )}

                {/* Registered state prior to game start */}
                {card.isRegistered && !isCardBlocked && !isClaimEligible && gameStatus !== 'starting_countdown' && gameStatus !== 'pre_game_countdown' && (
                  <div
                    className={`w-full ${
                      isVeryCompact ? 'py-1 px-1 text-[8px]' : 'py-1.5 px-2 text-[10px] sm:text-xs'
                    } rounded-lg font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 text-center flex items-center justify-center gap-1`}
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate">Registered</span>
                  </div>
                )}

                {/* Blocked Card: Automatically Disabled BINGO Claim Button */}
                {isCardBlocked && (
                  <button
                    type="button"
                    disabled={true}
                    className={`w-full ${
                      isVeryCompact ? 'py-1 px-1 text-[9px]' : 'py-2 px-2.5 text-xs'
                    } rounded-lg font-black uppercase bg-slate-200 text-slate-400 border border-slate-300 flex items-center justify-center gap-1 cursor-not-allowed select-none opacity-80`}
                    title={`This card is blocked: ${cardBlockReason}`}
                  >
                    <Trophy className="w-3 h-3 text-slate-400" />
                    <span className="truncate">BLOCKED</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
