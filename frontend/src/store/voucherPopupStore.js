import { create } from 'zustand';

/**
 * Store to coordinate the floating voucher threshold popup with the active cart banner.
 * Ensures the cart banner smoothly slides up when the voucher popup is active,
 * preventing any overlapping, and glides back down when the voucher auto-closes after 5 seconds.
 */
export const useVoucherPopupStore = create((set) => ({
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
}));
