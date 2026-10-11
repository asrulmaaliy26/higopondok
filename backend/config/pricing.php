<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Tarif & Biaya Operasional Higo Pondok
    |--------------------------------------------------------------------------
    | Konfigurasi terpusat untuk ongkos kirim kurir, biaya layanan admin pondok,
    | dan aturan pembagian insentif pesanan rombongan bertingkat (batch order):
    | - Santri ke-1: Ongkir utuh Rp 3.000 ke kurir (Potongan Rp 0)
    | - Santri ke-2: Ongkir dialihkan Rp 1.000 ke kas admin (Kurir Rp 2.000, Admin Rp 3.000)
    | - Santri ke-3+: Ongkir dialihkan Rp 2.000 ke kas admin (Kurir Rp 1.000, Admin Rp 4.000)
    |
    | Dapat diubah langsung di file ini atau melalui environment (.env):
    | PRICING_BASE_DELIVERY_FEE=3000
    | PRICING_BASE_ADMIN_FEE=2000
    | PRICING_EXTRA_DELIVERY_PER_5_ITEMS=2000
    | PRICING_EXTRA_ADMIN_PER_5_ITEMS=3000
    | PRICING_USER_RANK_2_COURIER_CUT=1000
    | PRICING_USER_RANK_3_PLUS_COURIER_CUT=2000
    */

    'base_delivery_fee'            => (float) env('PRICING_BASE_DELIVERY_FEE', 3000.0),
    'base_admin_fee'               => (float) env('PRICING_BASE_ADMIN_FEE', 2000.0),
    'extra_delivery_per_5_items'   => (float) env('PRICING_EXTRA_DELIVERY_PER_5_ITEMS', 2000.0),
    'extra_admin_per_5_items'      => (float) env('PRICING_EXTRA_ADMIN_PER_5_ITEMS', 3000.0),
    'user_rank_2_courier_cut'      => (float) env('PRICING_USER_RANK_2_COURIER_CUT', 2000.0),
    'user_rank_3_plus_courier_cut' => (float) env('PRICING_USER_RANK_3_PLUS_COURIER_CUT', 2000.0),

    // Aturan Aktif: Santri ke-1 ongkir utuh (limit 1), mulai santri ke-2 dst langsung dipotong 2.000 dialihkan ke kas admin
    'user_threshold_limit'         => 1,
    'user_threshold_courier_cut'   => (float) env('PRICING_USER_RANK_3_PLUS_COURIER_CUT', 2000.0),
];
