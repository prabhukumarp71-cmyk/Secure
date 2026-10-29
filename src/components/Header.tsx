import React from 'react';
import { Shield, Lock, Sun, Moon, Usb } from 'lucide-react';

interface HeaderProps {
  activeTab: 'gallery' | 'testbench' | 'android' | 'threat_model';
  onTabChange: (tab: 'gallery' | 'testbench' | 'android' | 'threat_model') => void;
  isLocked: boolean;
  onLock: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isUsbMounted: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  isLocked,
  onLock,
  isDark,
  onToggleTheme,
  isUsbMounted,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 h-16">
        {/* ZONE 1: Brand Wordmark (Single text element) */}
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/25">
            <Shield className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Moto Secure Vault
          </span>
        </div>

        {/* ZONE 2: Clean Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => onTabChange('gallery')}
            className={`transition whitespace-nowrap shrink-0 pb-1 ${
              activeTab === 'gallery'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Vault Gallery
          </button>
          <button
            type="button"
            onClick={() => onTabChange('testbench')}
            className={`transition whitespace-nowrap shrink-0 pb-1 ${
              activeTab === 'testbench'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Security Lab
          </button>
          <button
            type="button"
            onClick={() => onTabChange('android')}
            className={`transition whitespace-nowrap shrink-0 pb-1 ${
              activeTab === 'android'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Android Source
          </button>
          <button
            type="button"
            onClick={() => onTabChange('threat_model')}
            className={`transition whitespace-nowrap shrink-0 pb-1 ${
              activeTab === 'threat_model'
                ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Threat Model
          </button>
        </nav>

        {/* ZONE 3: Primary Action & Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
            title="Toggle Dark / Light Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {!isLocked ? (
            <button
              type="button"
              onClick={onLock}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Vault</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Locked</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
