import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ 
  text = 'Memuat data...', 
  subtext = 'Mohon tunggu sebentar', 
  fullScreen = false, 
  minHeight = 'min-h-[150px]',
  size = 'md' 
}) {
  const sizeMap = {
    sm: 'w-6 h-6 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-10 h-10 border-3',
  };

  const spinnerSize = sizeMap[size] || sizeMap.md;

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white dark:bg-gray-900 border border-green-300 dark:border-green-800 p-5 rounded-none shadow-xl flex flex-col items-center text-center max-w-xs w-full animate-in zoom-in-95 duration-150">
          <div className="relative mb-2.5">
            <div className={`${spinnerSize} border-green-200 dark:border-green-950 border-t-green-600 dark:border-t-green-400 rounded-full animate-spin`}></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-none animate-pulse"></div>
            </div>
          </div>
          <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">{text}</h4>
          {subtext && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{subtext}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-none ${minHeight} w-full text-center animate-fade-in`}>
      <div className="relative mb-2.5">
        <div className={`${spinnerSize} border-green-200 dark:border-green-950 border-t-green-600 dark:border-t-green-400 rounded-full animate-spin`}></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-none animate-pulse"></div>
        </div>
      </div>
      <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{text}</p>
      {subtext && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{subtext}</p>}
    </div>
  );
}
