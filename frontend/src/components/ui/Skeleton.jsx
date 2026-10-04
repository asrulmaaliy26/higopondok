import React from 'react';

export const SkeletonCard = () => {
  return (
    <div className="flex gap-4 group relative border-b border-gray-50 dark:border-gray-800/50 pb-5 animate-pulse">
      {/* Product Image Skeleton */}
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-gray-200 dark:bg-gray-800 flex items-center justify-center shrink-0 border border-gray-200 dark:border-gray-700 overflow-hidden relative">
      </div>
      
      {/* Product Details Skeleton */}
      <div className="flex-1 min-w-0 py-1 flex flex-col">
        {/* Title */}
        <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-3/4 mb-2"></div>
        {/* Category & Stock */}
        <div className="flex items-center gap-2 mt-1 mb-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/5"></div>
        </div>
        
        {/* Price */}
        <div className="mt-auto flex items-center justify-between">
          <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-1/3"></div>
        </div>
        
        {/* Management Actions */}
        <div className="mt-3 flex gap-2">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-md w-full"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded-md w-12"></div>
        </div>
      </div>
    </div>
  );
};
