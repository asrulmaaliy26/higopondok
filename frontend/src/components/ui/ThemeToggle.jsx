import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

export default function ThemeToggle({ 
  variant = 'icon', 
  className = '', 
  showLabel = false,
  size = 'md'
}) {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDark = theme === 'dark';

  const handleClick = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    toggleTheme();
  };

  if (variant === 'pill-light') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-xs border border-white/20 text-xs font-bold transition-all duration-200 cursor-pointer select-none ${className}`}
        title={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
        aria-label={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
      >
        <div className="relative w-3.5 h-3.5 flex items-center justify-center pointer-events-none">
          {isDark ? (
            <Moon className="w-3.5 h-3.5 text-amber-200" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-amber-300" />
          )}
        </div>
        <span className="pointer-events-none text-[11px] uppercase tracking-wider">{isDark ? 'Gelap' : 'Terang'}</span>
      </button>
    );
  }

  if (variant === 'switch') {
    return (
      <div className={`flex items-center justify-between gap-3 ${className}`}>
        {showLabel && (
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 select-none">
            {isDark ? 'Mode Gelap' : 'Mode Terang'}
          </span>
        )}
        <button
          type="button"
          onClick={handleClick}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-none border border-gray-300 dark:border-gray-600 transition-colors duration-200 ease-in-out focus:outline-none ${
            isDark ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
          role="switch"
          aria-checked={isDark}
          title={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
        >
          <span
            className={`pointer-events-none flex h-5 w-5 transform items-center justify-center rounded-none bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
              isDark ? 'translate-x-5' : 'translate-x-0'
            }`}
          >
            {isDark ? (
              <Moon className="h-3 w-3 text-green-700" />
            ) : (
              <Sun className="h-3 w-3 text-amber-500" />
            )}
          </span>
        </button>
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 text-xs font-semibold transition-all duration-200 active:scale-95 cursor-pointer shadow-xs ${className}`}
        title={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500" />
        )}
        <span className="text-[11px] uppercase tracking-wider">{isDark ? 'Gelap' : 'Terang'}</span>
      </button>
    );
  }

  // Default: 'icon'
  const sizeClasses = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-10 h-10' : 'w-9 h-9';
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-5 h-5' : 'w-4.5 h-4.5';

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center rounded-none bg-gray-100/90 hover:bg-gray-200/90 dark:bg-gray-800/90 dark:hover:bg-gray-700/90 text-gray-600 dark:text-gray-300 border border-gray-200/60 dark:border-gray-700/60 shadow-xs transition-all duration-200 active:scale-95 cursor-pointer ${sizeClasses} ${className}`}
      title={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
      aria-label={isDark ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
    >
      <div className="relative flex items-center justify-center pointer-events-none">
        {isDark ? (
          <Moon className={`${iconSize} text-amber-400 transition-transform duration-300 hover:-rotate-12`} />
        ) : (
          <Sun className={`${iconSize} text-amber-500 transition-transform duration-300 hover:rotate-45`} />
        )}
      </div>
    </button>
  );
}
