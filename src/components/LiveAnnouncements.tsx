import React from 'react';
import { AlertCircle, Sparkles } from 'lucide-react';
import { GameSession } from '../types/bingo';

interface LiveAnnouncementsProps {
  announcements?: string[];
  isServiceSuspended?: boolean;
  game?: GameSession | null;
  claimWindowSeconds?: number;
}

export const LiveAnnouncements: React.FC<LiveAnnouncementsProps> = ({
  announcements,
  isServiceSuspended,
  game,
  claimWindowSeconds,
}) => {
  // Strictly enforce the 5 user-specified notification messages:
  // 1. "registration opened"
  // 2. "registration closed"
  // 3. "Game is starting .."
  // 4. "Bingo claimed, bingo claim window will be closed in __ seconds"
  // 5. "game completed, ready for the next game"
  // NEVER show blocked cards or player codes in this notification card.
  let displayMessage = 'registration closed';

  if (isServiceSuspended) {
    displayMessage = 'Bingo games are currently suspended by the administrator.';
  } else if (game?.claimWindowActive || game?.status === 'checking_winners' || game?.status === 'claim_review') {
    const secs = claimWindowSeconds && claimWindowSeconds > 0 ? claimWindowSeconds : 15;
    displayMessage = `Bingo claimed, bingo claim window will be closed in ${secs} seconds`;
  } else if (
    game?.status === 'game_completed' ||
    game?.status === 'winner_confirmed' ||
    game?.status === 'completed'
  ) {
    displayMessage = 'game completed, ready for the next game';
  } else if (
    game?.status === 'starting_countdown' ||
    game?.status === 'pre_game_countdown' ||
    game?.status === 'running' ||
    game?.status === 'in_progress'
  ) {
    displayMessage = 'Game is starting ..';
  } else if (game?.status === 'registration_closed') {
    displayMessage = 'registration closed';
  } else if (game?.status === 'registration_open' || game?.registrationOpen) {
    displayMessage = 'registration opened';
  } else {
    // Check server announcement if it matches allowed messages
    const first = announcements?.[0];
    if (
      first === 'registration opened' ||
      first === 'registration closed' ||
      first === 'Game is starting ..' ||
      first === 'game completed, ready for the next game'
    ) {
      displayMessage = first;
    } else if (first && first.startsWith('Bingo claimed, bingo claim window will be closed in')) {
      displayMessage = first;
    } else {
      displayMessage = game?.registrationOpen ? 'registration opened' : 'registration closed';
    }
  }

  return (
    <div
      aria-label="Live Game Notification"
      className="bg-amber-50/95 border border-amber-200 text-amber-950 px-2.5 py-1.5 rounded-xl shadow-2xs flex items-center justify-between gap-2 text-[11px] sm:text-xs transition-all"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
          <Sparkles className="w-3 h-3 text-amber-600" />
        </div>
        <p className="font-semibold truncate leading-snug">{displayMessage}</p>
      </div>

      {isServiceSuspended && (
        <span className="shrink-0 text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.5 rounded uppercase flex items-center gap-1">
          <AlertCircle className="w-2.5 h-2.5" />
          <span>Suspended</span>
        </span>
      )}
    </div>
  );
};
