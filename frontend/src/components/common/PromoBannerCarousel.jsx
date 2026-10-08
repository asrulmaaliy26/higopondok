import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import AppImage from './AppImage';

/**
 * PromoBannerCarousel
 * Centered focus banner carousel with peek-through previews of left and right banners.
 * Follows Higo Pondok's High-Density & Flat Sharp UI Guidelines (rounded-none).
 */
export default function PromoBannerCarousel({
  banners = [],
  isLoading = false,
  heightClass = 'h-36 sm:h-48',
  className = '',
  mobileRatio = 0.90,
  tabletRatio = 0.85,
  desktopRatio = 0.78,
  titleSizeClass = 'text-[11px] sm:text-xs',
  badgeSizeClass = 'text-[9px]',
  cardPaddingClass = 'p-2.5 sm:p-3.5',
  onBannerClick = null
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // ResizeObserver to dynamically calculate slide width and centering offset
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', updateWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const bannerList = useMemo(() => {
    return Array.isArray(banners) ? banners : [];
  }, [banners]);

  const hasMultiple = bannerList.length > 1;

  // Base list for looping: if 2 banners, duplicate to 4 for seamless symmetric looping
  const baseList = useMemo(() => {
    if (!hasMultiple) return bannerList;
    if (bannerList.length === 2) {
      return [...bannerList, ...bannerList];
    }
    return bannerList;
  }, [bannerList, hasMultiple]);

  // Extended slides with cloned endpoints: [last, ...items, first]
  const slides = useMemo(() => {
    if (!hasMultiple) return bannerList;
    const len = baseList.length;
    return [baseList[len - 1], ...baseList, baseList[0]];
  }, [baseList, hasMultiple, bannerList]);

  // extended index: 1 corresponds to original first item
  const [currentIndex, setCurrentIndex] = useState(hasMultiple ? 1 : 0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const hasMovedRef = useRef(false);

  // Reset index when banners change
  useEffect(() => {
    setCurrentIndex(hasMultiple ? 1 : 0);
    setIsTransitioning(false);
  }, [hasMultiple, bannerList.length]);

  // Slide dimensions calculation
  // Mobile (<640px): 84% width -> 8% peek on left & right
  // Tablet (<1024px): 80% width -> 10% peek
  // Desktop (>=1024px): 74% width -> 13% peek
  const slideWidthRatio = useMemo(() => {
    if (containerWidth < 640) return mobileRatio;
    if (containerWidth < 1024) return tabletRatio;
    return desktopRatio;
  }, [containerWidth, mobileRatio, tabletRatio, desktopRatio]);

  const gap = containerWidth < 640 ? 8 : 12;
  const slideWidth = containerWidth > 0 ? Math.round(containerWidth * slideWidthRatio) : 320;
  const step = slideWidth + gap;
  const centerOffset = containerWidth > 0 ? (containerWidth - slideWidth) / 2 : 0;

  // Real banner index for dots / badges
  const realActiveIndex = useMemo(() => {
    if (!hasMultiple) return 0;
    const baseLen = baseList.length;
    let idx = (currentIndex - 1) % baseLen;
    if (idx < 0) idx += baseLen;
    return idx % bannerList.length;
  }, [currentIndex, hasMultiple, baseList.length, bannerList.length]);

  // Auto-play timer
  useEffect(() => {
    if (!hasMultiple || isPaused || isDragging) return;

    const timer = setInterval(() => {
      setIsTransitioning(true);
      setCurrentIndex((prev) => prev + 1);
    }, 4500);

    return () => clearInterval(timer);
  }, [hasMultiple, isPaused, isDragging, baseList.length]);

  // Seamless jump on transition end
  const handleTransitionEnd = useCallback(() => {
    if (!hasMultiple) return;
    const baseLen = baseList.length;

    if (currentIndex >= baseLen + 1) {
      // Reached cloned first slide at the end -> jump back to real index 1
      setIsTransitioning(false);
      setCurrentIndex(1);
    } else if (currentIndex <= 0) {
      // Reached cloned last slide at the beginning -> jump back to real index baseLen
      setIsTransitioning(false);
      setCurrentIndex(baseLen);
    }
  }, [hasMultiple, currentIndex, baseList.length]);

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (!hasMultiple) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => prev + 1);
  }, [hasMultiple]);

  const goToPrev = useCallback(() => {
    if (!hasMultiple) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => prev - 1);
  }, [hasMultiple]);

  const goToRealIndex = useCallback((targetRealIndex) => {
    if (!hasMultiple) return;
    setIsTransitioning(true);
    setCurrentIndex(targetRealIndex + 1);
  }, [hasMultiple]);

  // Touch and mouse drag gestures
  const handleTouchStart = (e) => {
    if (!hasMultiple) return;
    setIsDragging(true);
    hasMovedRef.current = false;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setDragOffset(0);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !hasMultiple) return;
    currentXRef.current = e.touches[0].clientX;
    const diff = currentXRef.current - startXRef.current;
    if (Math.abs(diff) > 5) {
      hasMovedRef.current = true;
    }
    setDragOffset(diff);
  };

  const handleTouchEnd = () => {
    if (!isDragging || !hasMultiple) return;
    setIsDragging(false);
    const diff = currentXRef.current - startXRef.current;
    setDragOffset(0);

    const threshold = Math.min(60, slideWidth * 0.15);
    if (diff < -threshold) {
      goToNext();
    } else if (diff > threshold) {
      goToPrev();
    } else {
      setIsTransitioning(true);
    }
  };

  const handleMouseDown = (e) => {
    if (!hasMultiple || e.button !== 0) return;
    setIsDragging(true);
    hasMovedRef.current = false;
    startXRef.current = e.clientX;
    currentXRef.current = e.clientX;
    setDragOffset(0);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !hasMultiple) return;
    currentXRef.current = e.clientX;
    const diff = currentXRef.current - startXRef.current;
    if (Math.abs(diff) > 5) {
      hasMovedRef.current = true;
    }
    setDragOffset(diff);
  };

  const handleMouseUp = () => {
    if (!isDragging || !hasMultiple) return;
    setIsDragging(false);
    const diff = currentXRef.current - startXRef.current;
    setDragOffset(0);

    const threshold = Math.min(60, slideWidth * 0.15);
    if (diff < -threshold) {
      goToNext();
    } else if (diff > threshold) {
      goToPrev();
    } else {
      setIsTransitioning(true);
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleMouseUp();
    }
    setIsPaused(false);
  };

  // Click on a slide card
  const handleSlideClick = (slideIndex, banner) => {
    if (hasMovedRef.current) return; // Ignore drag clicks
    if (slideIndex === currentIndex) {
      if (onBannerClick) onBannerClick(banner);
    } else if (slideIndex > currentIndex) {
      goToNext();
    } else if (slideIndex < currentIndex) {
      goToPrev();
    }
  };

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className={`relative overflow-hidden w-full ${className}`}>
        <div className={`w-full ${heightClass} bg-gray-200 dark:bg-gray-800 animate-pulse border border-gray-200 dark:border-gray-800`} />
      </div>
    );
  }

  // Fallback State when banners array is empty
  if (bannerList.length === 0) {
    return (
      <div className={`relative w-full ${className}`}>
        <div className={`w-full ${heightClass} bg-gradient-to-r from-green-800 via-green-700 to-emerald-800 p-4 sm:p-6 text-white flex flex-col justify-center border border-green-900 shadow-sm rounded-none`}>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-4 h-4 text-green-300" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-green-200">
              HiGO Pondok Al-Mannan
            </span>
          </div>
          <h3 className="text-base sm:text-xl font-extrabold mb-1">
            Jajan & Kebutuhan Santri Jadi Lebih Praktis!
          </h3>
          <p className="text-xs sm:text-sm text-green-100 max-w-xl">
            Pilih menu favoritmu dari berbagai kantin pondok. Kurir santri siap mengantar ke kamar asrama.
          </p>
        </div>
      </div>
    );
  }

  // Single Banner State
  if (!hasMultiple) {
    const singleBanner = bannerList[0];
    return (
      <div className={`relative w-full overflow-hidden ${className}`}>
        <div
          onClick={() => onBannerClick && onBannerClick(singleBanner)}
          className={`w-full ${heightClass} relative overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-900 cursor-pointer rounded-none`}
        >
          <AppImage
            src={singleBanner.image_path}
            alt={singleBanner.title}
            type="banner"
            className="w-full h-full object-cover"
          />
          <div className={`absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex items-end ${cardPaddingClass}`}>
            <div>
              <span className={`px-1.5 py-0.5 bg-green-600 text-white ${badgeSizeClass} font-bold uppercase tracking-wider mb-1 inline-block rounded-none shadow-xs`}>
                Promo Kantin
              </span>
              <h3 className={`text-white font-bold ${titleSizeClass} leading-tight drop-shadow-sm line-clamp-1 sm:line-clamp-2`}>
                {singleBanner.title}
              </h3>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate track translateX
  const targetX = centerOffset - currentIndex * step + dragOffset;

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none group ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Sliding Track */}
      <div
        onTransitionEnd={handleTransitionEnd}
        style={{
          transform: `translateX(${targetX}px)`,
          transition: isDragging || !isTransitioning ? 'none' : 'transform 400ms cubic-bezier(0.25, 1, 0.5, 1)',
          display: 'flex',
          gap: `${gap}px`,
          willChange: 'transform'
        }}
        className="cursor-grab active:cursor-grabbing py-1"
      >
        {slides.map((banner, index) => {
          const isCenter = index === currentIndex;
          return (
            <div
              key={`${banner.id || 'b'}-${index}`}
              style={{
                width: `${slideWidth}px`,
                flexShrink: 0
              }}
              onClick={() => handleSlideClick(index, banner)}
              className={`relative ${heightClass} overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-900 transition-all duration-300 rounded-none ${
                isCenter
                  ? 'opacity-100 scale-100 shadow-md ring-1 ring-black/10 dark:ring-white/10'
                  : 'opacity-75 scale-[0.98] cursor-pointer hover:opacity-90'
              }`}
            >
              <AppImage
                src={banner.image_path}
                alt={banner.title}
                type="banner"
                className="w-full h-full object-cover pointer-events-none select-none"
              />
              <div className={`absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex items-end ${cardPaddingClass} pointer-events-none`}>
                <div>
                  <span className={`px-1.5 py-0.5 bg-green-600 text-white ${badgeSizeClass} font-bold uppercase tracking-wider mb-0.5 sm:mb-1 inline-block rounded-none shadow-xs`}>
                    Promo Kantin
                  </span>
                  <h3 className={`text-white font-bold ${titleSizeClass} leading-tight drop-shadow-sm line-clamp-1 sm:line-clamp-2`}>
                    {banner.title}
                  </h3>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Left/Right Navigation Chevrons */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          goToPrev();
        }}
        aria-label="Banner Sebelumnya"
        className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-black/60 hover:bg-black/85 text-white border border-white/20 backdrop-blur-xs transition-opacity opacity-0 group-hover:opacity-100 z-20 rounded-none cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          goToNext();
        }}
        aria-label="Banner Berikutnya"
        className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center bg-black/60 hover:bg-black/85 text-white border border-white/20 backdrop-blur-xs transition-opacity opacity-0 group-hover:opacity-100 z-20 rounded-none cursor-pointer"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Bottom Indicators & Counter (Compact Flat Sharp) */}
      <div className="flex items-center justify-between px-2 pt-2">
        {/* Flat Rectangular Dots */}
        <div className="flex items-center gap-1.5 mx-auto">
          {bannerList.map((_, dotIdx) => (
            <button
              key={dotIdx}
              type="button"
              onClick={() => goToRealIndex(dotIdx)}
              aria-label={`Ke banner ${dotIdx + 1}`}
              className={`h-1.5 transition-all duration-300 rounded-none cursor-pointer ${
                dotIdx === realActiveIndex
                  ? 'w-6 bg-green-600 dark:bg-green-500'
                  : 'w-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Counter Badge */}
        <div className="absolute right-3 bottom-2.5 px-1.5 py-0.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono font-bold border border-white/10 rounded-none pointer-events-none">
          {realActiveIndex + 1}/{bannerList.length}
        </div>
      </div>
    </div>
  );
}
