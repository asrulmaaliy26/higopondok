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

  // Aturan pesanan bertingkat rombongan toko (Batch Order)
  // - Santri ke-1: Ongkir kurir utuh Rp 3.000 (Potongan Rp 0, Admin Rp 2.000)
  // - Santri ke-2 dst: Ongkir kurir Rp 1.500 (Potongan Rp 1.500 dialihkan ke kas admin, Admin Rp 3.500)
  USER_RANK_2_COURIER_CUT: 1500,
  USER_RANK_3_PLUS_COURIER_CUT: 1500,
  USER_THRESHOLD_LIMIT: 1,
  USER_THRESHOLD_COURIER_CUT: 1500,
};

/**
 * =====================================================================
 * DAFTAR ZONA TOKO TERPUSAT (Single Source of Truth)
 * Tambahkan atau ubah zona di sini untuk menambah opsi zona baru
 * secara dinamis di seluruh sistem aplikasi Higo Pondok.
 * =====================================================================
 */
export const CANTEEN_ZONES = [
  { id: 'kauman', label: 'Zona Kauman', deliveryFee: 2000, adminFee: 1000 },
  { id: 'kota',   label: 'Zona Kota',   deliveryFee: PRICING_CONFIG.BASE_DELIVERY_FEE, adminFee: PRICING_CONFIG.BASE_ADMIN_FEE },
];

export const getCanteenZone = (id) => CANTEEN_ZONES.find(z => z.id === id) ?? CANTEEN_ZONES[0];

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
 * @param {number} userRank      - Urutan pemesan harian di toko (1 = Santri ke-1, 2 = Santri ke-2, 3+ = Santri ke-3+)
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

  // Potongan ongkir bertingkat dialihkan ke kas admin pada hari yang sama:
  // Rank 1: Rp 0 (Kurir Rp 3.000, Admin Rp 2.000)
  // Rank 2+: Rp 1.500 (Kurir Rp 1.500, Admin Rp 3.500)
  let cutRate = 0;
  if (hasCourier) {
    if (userRank >= 2) {
      cutRate = PRICING_CONFIG.USER_THRESHOLD_COURIER_CUT;
    }
  }

  const courierCut = Math.min(rawDeliveryFee, cutRate);

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
