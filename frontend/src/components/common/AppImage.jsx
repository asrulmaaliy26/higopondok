import React, { useState } from 'react';
import { getStorageUrl } from '../../lib/axios';
import { UtensilsCrossed, Store } from 'lucide-react';

export default function AppImage({
  src,
  alt = '',
  className = '',
  type = 'food', // 'food' | 'canteen' | 'store' | 'banner'
  fallbackIcon = null
}) {
  const [hasError, setHasError] = useState(false);

  const fullUrl = src && typeof src === 'string' && src.trim() !== '' ? getStorageUrl(src) : null;

  if (!fullUrl || hasError) {
    const isStore = type === 'canteen' || type === 'store';
    return (
      <div className={`w-full h-full flex items-center justify-center bg-green-50/80 dark:bg-green-950/50 text-green-700 dark:text-green-400 select-none ${className}`}>
        {fallbackIcon ? (
          fallbackIcon
        ) : isStore ? (
          <Store className="w-1/2 h-1/2 max-w-[24px] max-h-[24px] min-w-[14px] min-h-[14px] stroke-[2.2]" />
        ) : (
          <UtensilsCrossed className="w-1/2 h-1/2 max-w-[24px] max-h-[24px] min-w-[14px] min-h-[14px] stroke-[2]" />
        )}
      </div>
    );
  }

  return (
    <img
      src={fullUrl}
      alt={alt}
      onError={() => setHasError(true)}
      className={className}
      loading="lazy"
    />
  );
}
