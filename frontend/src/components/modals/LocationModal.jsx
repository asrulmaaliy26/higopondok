import React from 'react';
import { createPortal } from 'react-dom';

export const LocationModal = ({
  isOpen,
  onClose,
  canteen,
  predefinedLocations,
  getMappedLocation,
  deliveryLocation,
  setDeliveryLocation,
  customLocation,
  setCustomLocation,
  totalPrice,
  deliveryFee,
  handleConfirmCheckout,
  isPending
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] my-auto">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Lokasi Pengiriman</h3>
          <p className="text-sm text-gray-500 mt-1">Pilih lokasi pengantaran pesanan Anda</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {predefinedLocations.map(loc => {
            return (
              <label key={loc} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${deliveryLocation === loc ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <div className="flex items-center">
                  <input 
                    type="radio" 
                    name="location" 
                    value={loc}
                    checked={deliveryLocation === loc}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                  />
                  <span className="ml-3 font-medium text-gray-900 dark:text-white capitalize">{loc}</span>
                </div>
                <span className="text-xs font-semibold text-gray-500">
                  + Rp {deliveryFee.toLocaleString('id-ID')}
                </span>
              </label>
            );
          })}
          
          <label className={`flex flex-col p-3 rounded-lg border cursor-pointer transition-colors ${deliveryLocation === 'custom' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input 
                  type="radio" 
                  name="location" 
                  value="custom"
                  checked={deliveryLocation === 'custom'}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                />
                <span className="ml-3 font-medium text-gray-900 dark:text-white">Tulis Sendiri</span>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                + Rp {deliveryFee.toLocaleString('id-ID')}
              </span>
            </div>
            {deliveryLocation === 'custom' && (
              <input 
                type="text"
                placeholder="Contoh: Gedung B, Kamar 4"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                className="mt-3 ml-7 p-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
            )}
          </label>
          

          {/* Show Total dynamically in Modal */}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Total Tagihan:</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                Rp {totalPrice.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
        
        <div className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-800/50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 hover:bg-gray-50"
          >
            Batal
          </button>
          <button 
            onClick={handleConfirmCheckout}
            disabled={isPending || !deliveryLocation || (deliveryLocation === 'custom' && !customLocation.trim())}
            className="flex-1 py-2.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? 'Memproses...' : 'Lanjut WA'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
