import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Trophy,
  Ticket,
  Clock,
  Sparkles,
  Copy,
  Check,
  Lock,
  Users,
  ShieldAlert,
  Award,
  Eye,
  HelpCircle,
  X,
  Ban,
} from 'lucide-react';
import { BingoBall, GameSession, Winner, BlockedCard, WinningPattern } from '../types/bingo';
import { WINNING_RULE_NAMES, getDisplayCardNumber } from '../utils/bingoRules';
import { BingoBoard75 } from './BingoBoard75';

interface CollapsibleGameInfoProps {
  game: GameSession | null;
  calledNumbers: BingoBall[];
  latestBall: BingoBall | null;
  countdownSeconds?: number;
  completionSeconds?: number;
  onNumberClick?: (number: number) => void;
  isHost?: boolean;
  onSelectWinnerCard: (winner: Winner) => void;
  onSelectBlockedCardId: (cardId: string) => void;
}

export const CollapsibleGameInfo: React.FC<CollapsibleGameInfoProps> = ({
  game,
  calledNumbers,
  latestBall,
  countdownSeconds,
  completionSeconds,
  onNumberClick,
  isHost,
  onSelectWinnerCard,
  onSelectBlockedCardId,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showPatternHintModal, setShowPatternHintModal] = useState<boolean>(false);
  const [showBlockedModal, setShowBlockedModal] = useState<boolean>(false);

  // Auto-expand during game_completed so winning cards are immediately visible to players
  React.useEffect(() => {
    if (game?.status === 'game_completed' && game.winners && game.winners.length > 0) {
      setIsExpanded(true);
    }
  }, [game?.status, game?.winners?.length]);

  if (!game) {
    return (
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-slate-100 rounded w-1/2"></div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'next_game':
      case 'setup':
        // User Requirement 9: When game is set up, status must be Next Game
        return { label: 'Next Game', bg: 'bg-slate-100 text-slate-700 border-slate-300' };
      case 'registration_open':
        return { label: 'Registration Open', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'registration_closed':
        return { label: 'Registration Closed', bg: 'bg-amber-50 text-amber-800 border-amber-300' };
      case 'starting_countdown':
      case 'pre_game_countdown':
        return {
          label: countdownSeconds && countdownSeconds > 0 ? `Starting in ${countdownSeconds}s` : 'Starting Soon',
          bg: 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse font-black',
        };
      case 'running':
      case 'in_progress':
        return { label: 'In Progress', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'paused':
        return { label: 'Paused', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'stopped':
        return { label: 'Stopped', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'claim_review':
      case 'checking_winners':
        return { label: 'Checking Winning Cards', bg: 'bg-purple-100 text-purple-900 border-purple-300 animate-pulse font-bold' };
      case 'game_completed':
      case 'winner_confirmed':
      case 'completed':
        return {
          label: completionSeconds && completionSeconds > 0 ? `Game Completed (${completionSeconds}s)` : 'Game Completed (30s)',
          bg: 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold',
        };
      case 'cancelled':
        return { label: 'Cancelled', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { label: status.replace(/_/g, ' '), bg: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  const statusInfo = getStatusBadge(game.status);
  const activeRule = game.activeWinningRule || 'not_set';
  const ruleName = activeRule === 'not_set' ? 'Not Set' : WINNING_RULE_NAMES[activeRule] || activeRule;

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(game.gameCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const blockedList: BlockedCard[] = game.blockedCards || [];
  const winnersList: Winner[] = game.winners || [];

  return (
    <>
      <section
        aria-label="Game Information"
        className="bg-white rounded-2xl shadow-xs border border-slate-200/80 transition-all duration-300 overflow-hidden"
      >
        {/* Header bar of the game card - Championship title removed */}
        <div className="relative p-2.5 sm:p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 pr-20 sm:pr-24">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-black text-indigo-700 text-xs sm:text-sm tracking-wide">
                  {game.gameCode}
                </span>
                <span
                  className={`text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.2 rounded-full border ${statusInfo.bg}`}
                >
                  {statusInfo.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 font-medium truncate">
                <span className="text-amber-700 font-semibold truncate">{ruleName}</span>
                <span>·</span>
                <span className="font-mono text-slate-600 font-semibold">
                  ${(game.totalPrizePool ?? 0).toFixed(2)} Pool
                </span>
              </div>
            </div>
          </div>

          {/* Show More / Show Less Button - Top Right Corner & Smaller Size */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 transition-colors cursor-pointer border border-indigo-100/80"
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Show Less' : 'Show More'}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Expanded Game Details Panel */}
        {isExpanded && (
          <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50/50 space-y-3 sm:space-y-4 text-xs animate-in fade-in duration-200">
            {/* User Requirement 5: Active Winning Rule Card
                - Description removed
                - Shows rule name if set, 'Not Set' if not set
                - Top right corner icon displays visual diagram hint */}
            <div className="p-2.5 sm:p-3 bg-gradient-to-r from-amber-50 to-indigo-50 rounded-xl border border-amber-200 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-amber-900 block">
                    Active Winning Rule
                  </span>
                  <div className="font-black text-slate-900 text-xs sm:text-sm truncate">
                    {ruleName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {game.isRuleLocked && (
                  <span className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 font-medium bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                    Locked
                  </span>
                )}
                {/* Pattern Hint & Diagram Icon Button at Top Right Corner */}
                <button
                  type="button"
                  onClick={() => setShowPatternHintModal(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-amber-100/80 active:bg-amber-200/80 text-amber-900 border border-amber-300/80 transition-colors shadow-2xs cursor-pointer text-[10px] font-bold"
                  title="View winning pattern visual hint and description"
                  aria-label="View winning rule diagram hint"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden xs:inline">Pattern Hint</span>
                </button>
              </div>
            </div>

            {/* Key Metric Grid: Entry Price and Total Prize Pool */}
            <div className={`grid ${isHost ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5`}>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                  <Ticket className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-medium text-[11px] sm:text-xs">Entry Price</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
                  {game.entryPrice > 0 ? `$${game.entryPrice.toFixed(2)}` : 'Free Play'}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-medium text-[11px] sm:text-xs">Prize Pool</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-amber-600 font-mono">
                  ${(game.totalPrizePool ?? 0).toFixed(2)}
                </div>
              </div>

              {/* ONLY rendered for authorized Host / Admin view */}
              {isHost && (
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="font-medium text-[11px] sm:text-xs">Registered</span>
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
                    {game.registeredPlayersCount} Cards
                  </div>
                </div>
              )}
            </div>

            {/* Game Code, Registration State & Start Time */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
              <div className="flex items-center gap-2">
                <span className="text-indigo-900 font-medium">Game Code:</span>
                <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                  {game.gameCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1 text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  title="Copy Game Code"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`font-semibold px-2 py-0.5 rounded-md text-[11px] ${
                    game.registrationOpen
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  Registration: {game.registrationOpen ? 'Open' : 'Closed'}
                </span>
                <div className="flex items-center gap-1 text-indigo-900 font-medium">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Start: {game.startTime}</span>
                </div>
              </div>
            </div>

            {/* Embedded 75-number Bingo board */}
            <div className="pt-2 border-t border-slate-200">
              <BingoBoard75
                calledNumbers={calledNumbers}
                latestBall={latestBall}
                onNumberClick={onNumberClick}
                isHost={isHost}
                gameStatus={game.status}
              />
            </div>

            {/* User Requirement 6: Combined Blocked Cards & Game Winners Card
                - Merged into ONE card
                - Smaller text sizes
                - Top right corner has blocked cards count with blocked icon
                - Clicking the icon/count opens a modal showing blocked cards
                - Game winners displayed with usual pattern */}
            <div className="pt-3 border-t border-slate-200">
              <div className="bg-white rounded-xl shadow-2xs border border-amber-100 p-2.5 sm:p-3 space-y-2 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <Trophy className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <span>Game Winners</span>
                      {winnersList.length > 0 && (
                        <span className="font-mono text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full">
                          {winnersList.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Blocked Cards Icon & Number at Top Right Corner (Opens Modal) */}
                  <button
                    type="button"
                    onClick={() => setShowBlockedModal(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-colors cursor-pointer"
                    title="View blocked cards list"
                  >
                    <ShieldAlert className="w-3 h-3 text-rose-600" />
                    <span>{blockedList.length} Blocked</span>
                  </button>
                </div>

                {/* Winners List in usual pattern with compact text sizes */}
                {winnersList.length === 0 ? (
                  <div className="py-2 text-center text-[11px] text-slate-400 bg-slate-50/60 rounded-lg border border-dashed border-slate-200">
                    No confirmed winners yet in this game.
                  </div>
                ) : (
                  <div className="space-y-1 pt-1 border-t border-amber-50">
                    {winnersList.map((w) => (
                      <div
                        key={w.id}
                        className="p-2 bg-gradient-to-r from-amber-50/80 to-indigo-50/40 rounded-lg border border-amber-200/80 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-md bg-amber-400 text-amber-950 flex items-center justify-center font-bold shrink-0">
                            <Award className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-[11px] sm:text-xs truncate">
                                {w.displayName}
                              </span>
                              <button
                                type="button"
                                onClick={() => onSelectWinnerCard(w)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-mono text-[10px] font-bold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Inspect winning 5x5 card"
                              >
                                <span>{getDisplayCardNumber(w.cardId)}</span>
                                <Eye className="w-2.5 h-2.5 text-indigo-500" />
                              </button>
                            </div>
                            <div className="text-[9px] text-slate-500 truncate">
                              {w.winningPattern} · {new Date(w.confirmedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-black text-xs text-emerald-600 block">
                            +${w.prizeAmount.toFixed(2)}
                          </span>
                          <span className="text-[8px] text-slate-400 block">{w.prizeCategory}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* User Requirement 5: Winning Rule Pattern Hint & Diagram Modal */}
      {showPatternHintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-sm text-slate-900">Winning Rule Pattern</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPatternHintModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Current Active Rule
              </span>
              <h4 className="text-base font-extrabold text-slate-900">{ruleName}</h4>
            </div>

            {/* 5x5 Visual Diagram Grid representing the winning pattern */}
            <div className="flex justify-center py-2">
              <PatternGridPreview pattern={activeRule} />
            </div>

            {/* Plain text hint explanation */}
            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 font-medium leading-relaxed text-center">
              {getPatternDescription(activeRule)}
            </div>

            <button
              type="button"
              onClick={() => setShowPatternHintModal(false)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* User Requirement 6: Blocked Cards List Modal */}
      {showBlockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-2xl border border-slate-200 space-y-3.5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <h3 className="font-bold text-sm text-slate-900">Blocked Cards</h3>
                <span className="font-mono text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.2 rounded-full">
                  {blockedList.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowBlockedModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
              {blockedList.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-1.5">
                  <Ban className="w-5 h-5 text-slate-300" />
                  <span>No blocked cards in this game.</span>
                </div>
              ) : (
                blockedList.map((b) => (
                  <div
                    key={b.cardId}
                    className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-200 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-rose-950">
                          #{getDisplayCardNumber(b.cardId)}
                        </span>
                        <span className="text-[9px] font-bold text-rose-700 uppercase bg-rose-100 px-1 rounded">
                          Blocked
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 truncate mt-0.5" title={b.reason}>
                        {b.reason || 'Administrative action'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowBlockedModal(false);
                        onSelectBlockedCardId(b.cardId);
                      }}
                      className="px-2 py-1 text-[10px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-1 shrink-0 transition cursor-pointer"
                    >
                      <Eye className="w-3 h-3 text-indigo-500" />
                      <span>Inspect</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowBlockedModal(false)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// Helper: 5x5 pattern visual grid preview
function PatternGridPreview({ pattern }: { pattern: WinningPattern }) {
  const isCellHighlighted = (r: number, c: number): boolean => {
    if (r === 2 && c === 2) return true; // Center FREE space
    switch (pattern) {
      case 'horizontal_line':
        return r === 0; // Top row or any horizontal row
      case 'vertical_line':
        return c === 0; // First column or any column
      case 'diagonal_line':
        return r === c || r + c === 4;
      case 'four_corners':
        return (r === 0 || r === 4) && (c === 0 || c === 4);
      case 'blackout':
        return true;
      default:
        return false;
    }
  };

  const columns = ['B', 'I', 'N', 'G', 'O'];

  return (
    <div className="p-2 bg-slate-900 rounded-xl shadow-inner inline-block">
      <div className="grid grid-cols-5 gap-1 mb-1 text-center">
        {columns.map((col) => (
          <span key={col} className="text-[9px] font-black font-mono text-slate-400 w-6">
            {col}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }).map((_, r) =>
          Array.from({ length: 5 }).map((_, c) => {
            const isFree = r === 2 && c === 2;
            const highlighted = isCellHighlighted(r, c);
            return (
              <div
                key={`${r}-${c}`}
                className={`w-6 h-6 rounded flex items-center justify-center text-[8px] font-black transition-all ${
                  isFree
                    ? 'bg-amber-400 text-amber-950 font-bold'
                    : highlighted
                    ? 'bg-indigo-500 text-white shadow-xs scale-105 ring-1 ring-white/50'
                    : 'bg-slate-800 text-slate-600'
                }`}
              >
                {isFree ? '★' : highlighted ? '●' : '·'}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function getPatternDescription(pattern: WinningPattern): string {
  switch (pattern) {
    case 'horizontal_line':
      return 'Cover all 5 numbers in any complete horizontal row across B-I-N-G-O. Center FREE square is included.';
    case 'vertical_line':
      return 'Cover all 5 numbers in any complete vertical column under B, I, N, G, or O. Center FREE square is included.';
    case 'diagonal_line':
      return 'Cover all numbers in a complete diagonal from corner to corner passing through center FREE.';
    case 'four_corners':
      return 'Cover all four outer corners of the card (top-left, top-right, bottom-left, bottom-right).';
    case 'blackout':
      return 'Full Card Blackout: Every single space across the entire 5x5 card must be called and marked.';
    case 'not_set':
    default:
      return 'The tournament host has not set the active winning pattern for this game session yet.';
  }
}
