import React from 'react';
import { Megaphone, AlertCircle, Info, Sparkles } from 'lucide-react';

interface LiveAnnouncementsProps {
  announcements: string[];
  isServiceSuspended?: boolean;
}

export const LiveAnnouncements: React.FC<LiveAnnouncementsProps> = ({
  announcements,
  isServiceSuspended,
}) => {
  const currentAnnouncements = announcements || [];
  const latestAnnouncement = currentAnnouncements[0] || (
    isServiceSuspended
      ? 'Bingo games are currently suspended by the administrator.'
      : 'Welcome to the tournament! Waiting for next call or announcement.'
  );

  return (
    <div
      aria-label="Live Game Announcement"
      className="bg-amber-50/90 border border-amber-200/90 text-amber-950 px-2.5 py-1.5 rounded-xl shadow-2xs flex items-center justify-between gap-2 text-[11px] sm:text-xs transition-all"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
          <Sparkles className="w-3 h-3 text-amber-600" />
        </div>
        <p className="font-medium truncate leading-snug">{latestAnnouncement}</p>
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
