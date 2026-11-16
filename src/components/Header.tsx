import React from 'react';
import { RotateCcw, RotateCw, Settings, Menu, ShieldAlert, Radio, Clock, Sparkles, Shield, LogIn, Globe, Wallet } from 'lucide-react';
import { GameSession, User } from '../types/bingo';
import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  appName: string;
  user: User | null;
  game: GameSession | null;
  countdownSeconds?: number;
  claimWindowSeconds?: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenSettings: () => void;
  onOpenMenu: () => void;
  onOpenHostControls: () => void;
  onOpenAuth: () => void;
  onOpenWallet?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  appName,
  user,
  game,
  countdownSeconds,
  claimWindowSeconds,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenSettings,
  onOpenMenu,
  onOpenHostControls,
  onOpenAuth,
  onOpenWallet,
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  // REQUIREMENT 6: Strictly check if user is an authorized host or admin
  const isHost = user?.role === 'host' || user?.role === 'admin';

  const displayedAppName = language === 'am' && (!appName || appName === 'MY Bingo') ? t.appName : (appName || 'MY Bingo');

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white shadow-md select-none">
      <div className="max-w-4xl mx-auto px-3.5 py-2.5 flex items-center justify-between gap-2">
        {/* Left: App Title and Live Indicator */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg md:text-xl font-extrabold tracking-tight truncate drop-shadow-xs font-sans">
              {displayedAppName}
            </h1>
            {(game?.status === 'pre_game_countdown' || game?.status === 'starting_countdown') && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-400 text-amber-950 uppercase tracking-wider animate-pulse shadow-xs">
                <Clock className="w-3 h-3" />
                {countdownSeconds && countdownSeconds > 0 ? `${t.startsIn} ${countdownSeconds}s` : t.startingSoon}
              </span>
            )}
            {game?.autoCallActive && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-emerald-950 uppercase tracking-wider animate-pulse">
                <Radio className="w-2.5 h-2.5" />
                {t.auto}
              </span>
            )}
          </div>
        </div>

        {/* Center / Right: Control Action Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Functional Language Switch (English / Amharic) */}
          <button
            type="button"
            onClick={toggleLanguage}
            title={language === 'en' ? 'ቋንቋ ወደ አማርኛ ቀይር (Switch to Amharic)' : 'Switch language to English'}
            aria-label="Language switch"
            className="min-h-[36px] sm:min-h-[38px] px-2 sm:px-2.5 py-1 flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 active:bg-white/35 text-white font-bold text-xs border border-white/20 transition-all cursor-pointer shadow-2xs select-none"
          >
            <Globe className="w-3.5 h-3.5 text-blue-200 shrink-0" />
            <span className="font-semibold tracking-wide text-[11px] sm:text-xs">
              {language === 'en' ? 'አማ' : 'EN'}
            </span>
          </button>

          {/* Undo Button */}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title={canUndo ? t.undo : 'Nothing to undo'}
            aria-label={t.undo}
            className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg transition-colors ${
              canUndo
                ? 'text-white hover:bg-white/20 active:bg-white/30 cursor-pointer'
                : 'text-white/35 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Redo Button */}
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title={canRedo ? t.redo : 'Nothing to redo'}
            aria-label={t.redo}
            className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg transition-colors ${
              canRedo
                ? 'text-white hover:bg-white/20 active:bg-white/30 cursor-pointer'
                : 'text-white/35 cursor-not-allowed'
            }`}
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Settings button */}
          <button
            type="button"
            onClick={onOpenSettings}
            title={t.settings}
            aria-label={t.settings}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-white hover:bg-white/20 active:bg-white/30 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Real-Money Wallet Balance Trigger */}
          {user && (
            <button
              type="button"
              onClick={onOpenWallet}
              title="Open Real-Money Wallet & Telebirr Deposit/Withdrawal"
              className="min-h-[36px] sm:min-h-[38px] px-2.5 sm:px-3 py-1 flex items-center gap-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black text-xs shadow-xs border border-emerald-300 transition-all cursor-pointer select-none"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-950" />
              <span className="tracking-tight">
                {user.balance !== undefined ? user.balance.toFixed(2) : '0.00'}{' '}
                <span className="text-[10px] font-bold opacity-75">ETB</span>
              </span>
            </button>
          )}

          {/* REQUIREMENT 6: Host Controls Trigger - ONLY visible if user is an authorized host or admin */}
          {isHost && (
            <button
              type="button"
              onClick={onOpenHostControls}
              title={t.adminPanel}
              aria-label={t.adminPanel}
              className="min-h-[38px] px-2.5 flex items-center gap-1 rounded-lg transition-colors bg-amber-500 text-slate-950 font-bold text-xs border border-amber-300 hover:bg-amber-400 cursor-pointer shadow-xs"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.adminPanel}</span>
            </button>
          )}

          {/* Sign In button when signed out */}
          {!user && (
            <button
              type="button"
              onClick={onOpenAuth}
              title={t.signIn}
              className="min-h-[38px] px-3 flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer shadow-xs transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t.signIn}</span>
            </button>
          )}

          {/* Hamburger Menu Button */}
          <button
            type="button"
            onClick={onOpenMenu}
            title={t.openMenu}
            aria-label={t.openMenu}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-white hover:bg-white/20 active:bg-white/30 transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
