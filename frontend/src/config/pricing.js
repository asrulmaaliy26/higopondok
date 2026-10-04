/**
 * =====================================================================
 * KONFIGURASI TARIF & OPERASIONAL HIGO PONDOK (OPSI B)
 * =====================================================================
 * File ini adalah Single Source of Truth untuk semua perhitungan biaya
 * layanan, ongkir kurir, dan biaya admin di seluruh aplikasi frontend.
 *
 * Jika ada perubahan tarif di kemudian hari, CUKUP UBAH DI FILE INI.
 * =====================================================================
 */

export const PRICING_CONFIG = {
  // Tarif Dasar (Pesanan standar 1 - 5 item)
  BASE_DELIVERY_FEE: 3000, // Ongkir kurir dasar
  BASE_ADMIN_FEE: 2000,    // Biaya admin pondok dasar

  // Tambahan biaya per kelipatan 5 item (> 5 item)
  EXTRA_DELIVERY_PER_5_ITEMS: 2000, // Tambahan ke kurir
  EXTRA_ADMIN_PER_5_ITEMS: 3000,    // Tambahan ke admin

  // Aturan pesanan rombongan toko (Batch Order)
  USER_THRESHOLD_LIMIT: 3,          // 3 user pemesan pertama di toko yang sama bebas potongan
  USER_THRESHOLD_COURIER_CUT: 2000, // Mulai user ke-4+, dialihkan Rp 2.000 ke kas admin (kurir dapat Rp 1.000)
};

/**
 * Format angka ke Rupiah (Rp X.XXX)
 */
export function formatRupiah(amount) {
  return 'Rp ' + (Math.round(amount) || 0).toLocaleString('id-ID');
}

/**
 * Helper terpusat untuk menghitung seluruh komponen biaya pesanan
 *
 * @param {number} totalQuantity - Jumlah total item yang dibeli
 * @param {number} userRank      - Urutan pemesan harian di toko (1 untuk user 1-3, 4 untuk user 4+)
 * @param {boolean} hasCourier   - Apakah pesanan diantar kurir (true) atau diambil mandiri/toko (false)
 * @returns {object} Rincian lengkap biaya
 */
export function calculateOrderFees(totalQuantity = 1, userRank = 1, hasCourier = true) {
  const qty = Math.max(1, parseInt(totalQuantity, 10) || 1);
  const extraBlocks = Math.max(0, Math.floor((qty - 1) / 5));

  const extraCourierFee = extraBlocks * PRICING_CONFIG.EXTRA_DELIVERY_PER_5_ITEMS;
  const extraAdminFee = extraBlocks * PRICING_CONFIG.EXTRA_ADMIN_PER_5_ITEMS;

  const rawDeliveryFee = PRICING_CONFIG.BASE_DELIVERY_FEE + extraCourierFee;
  const baseAdminFee = PRICING_CONFIG.BASE_ADMIN_FEE + extraAdminFee;

  // Potongan ongkir dialihkan ke admin untuk pemesan ke-4 dst pada hari yang sama
  const courierCut = (hasCourier && userRank > PRICING_CONFIG.USER_THRESHOLD_LIMIT)
    ? Math.min(rawDeliveryFee, PRICING_CONFIG.USER_THRESHOLD_COURIER_CUT)
    : 0;

  const deliveryFee = hasCourier ? Math.max(0, rawDeliveryFee - courierCut) : 0;
  const adminFee = hasCourier ? (baseAdminFee + courierCut) : baseAdminFee;

  return {
    quantity: qty,
    extraBlocks,
    rawDeliveryFee,
    baseAdminFee,
    extraCourierFee,
    extraAdminFee,
    courierCut,
    deliveryFee,
    adminFee,
    totalExtraFee: deliveryFee + adminFee,
  };
}
