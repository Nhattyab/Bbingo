import React from 'react';
import {
  X,
  Home,
  Layers,
  BookOpen,
  History,
  Archive,
  User as UserIcon,
  Settings,
  HelpCircle,
  Bell,
  LogOut,
  LogIn,
  Shield,
  Globe,
  Wallet,
} from 'lucide-react';
import { User } from '../types/bingo';
import { useLanguage } from '../context/LanguageContext';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeItem: string;
  onNavigate: (item: string) => void;
  user: User | null;
  onLogout: () => void;
  onOpenSavedCards: () => void;
  onOpenHostDashboard?: () => void;
  onOpenAuth: () => void;
  onOpenWallet?: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  activeItem,
  onNavigate,
  user,
  onLogout,
  onOpenSavedCards,
  onOpenHostDashboard,
  onOpenAuth,
  onOpenWallet,
}) => {
  const { language, setLanguage, toggleLanguage, t } = useLanguage();
  if (!isOpen) return null;

  const isHost = user?.role === 'host' || user?.role === 'admin';

  const navLinks: { id: string; label: string; icon: any; onClick?: () => void }[] = [
    { id: 'game', label: t.homeGame, icon: Home },
    {
      id: 'wallet',
      label: language === 'am' ? 'የገንዘብ ቦርሳ (Wallet)' : 'Wallet & Telebirr',
      icon: Wallet,
      onClick: () => {
        onClose();
        if (onOpenWallet) onOpenWallet();
      },
    },
    { id: 'rules', label: t.gameRules, icon: BookOpen },
    { id: 'history', label: t.gameHistory, icon: History },
    { id: 'profile', label: t.profile, icon: UserIcon },
    { id: 'settings', label: t.settings, icon: Settings },
    { id: 'notifications', label: t.notifications, icon: Bell },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-xs w-full bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-lg text-white">
              75
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-tight">{language === 'am' ? t.appName : 'MY Bingo'}</div>
              <div className="text-[11px] text-blue-200">{t.classicEdition}</div>
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

        {/* Language Switch Section */}
        <div className="px-4 py-2.5 bg-indigo-50/70 border-b border-indigo-100/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Globe className="w-3.5 h-3.5 text-indigo-600" />
            <span>{language === 'am' ? 'ቋንቋ (Language)' : 'Language (ቋንቋ)'}</span>
          </div>
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                language === 'en'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('am')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                language === 'am'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              አማርኛ
            </button>
          </div>
        </div>

        {/* User Account Card */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-2">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-bold text-slate-900 text-xs truncate">
                  {user.displayName}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isHost
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                }`}
              >
                {user.role === 'admin' ? 'Admin' : isHost ? 'Host' : 'Player'}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-700 text-xs">{t.notSignedIn}</div>
                <div className="text-[11px] text-slate-400">{t.guestMode}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-2xs cursor-pointer"
              >
                {t.signIn}
              </button>
            </div>
          )}
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* Host & Admin Panel Entry: ONLY for authorized Host or Admin */}
          {isHost && onOpenHostDashboard && (
            <button
              type="button"
              onClick={() => {
                onOpenHostDashboard();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-amber-950 bg-amber-100 border border-amber-300 hover:bg-amber-200 shadow-2xs transition-all cursor-pointer mb-2"
            >
              <Shield className="w-4 h-4 text-amber-700" />
              <span>{t.adminPanel}</span>
            </button>
          )}

          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeItem === link.id;

            return (
              <button
                key={link.id}
                type="button"
                onClick={() => {
                  if (link.onClick) {
                    link.onClick();
                  } else {
                    onNavigate(link.id);
                  }
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{link.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer Logout / Login */}
        <div className="p-3 border-t border-slate-100">
          {user ? (
            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.signOut}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer shadow-xs"
            >
              <LogIn className="w-4 h-4" />
              <span>{t.signIn}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
