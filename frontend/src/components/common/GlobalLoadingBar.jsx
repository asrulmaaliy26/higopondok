import React from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export default function GlobalLoadingBar() {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();

  const isLoading = isFetching > 0 || isMutating > 0;

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-emerald-950/20 overflow-hidden pointer-events-none">
      <div className="h-full bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-300 w-full animate-indeterminate shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
    </div>
  );
}
