<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Tarif & Biaya Operasional Higo Pondok (Opsi B)
    |--------------------------------------------------------------------------
    | Konfigurasi terpusat untuk ongkos kirim kurir, biaya layanan admin pondok,
    | dan aturan pembagian insentif pesanan rombongan (batch order).
    |
    | Dapat diubah langsung di file ini atau melalui environment (.env):
    | PRICING_BASE_DELIVERY_FEE=3000
    | PRICING_BASE_ADMIN_FEE=2000
    | PRICING_EXTRA_DELIVERY_PER_5_ITEMS=2000
    | PRICING_EXTRA_ADMIN_PER_5_ITEMS=3000
    | PRICING_USER_THRESHOLD_LIMIT=3
    | PRICING_USER_THRESHOLD_COURIER_CUT=2000
    */

    'base_delivery_fee'          => (float) env('PRICING_BASE_DELIVERY_FEE', 3000.0),
    'base_admin_fee'             => (float) env('PRICING_BASE_ADMIN_FEE', 2000.0),
    'extra_delivery_per_5_items' => (float) env('PRICING_EXTRA_DELIVERY_PER_5_ITEMS', 2000.0),
    'extra_admin_per_5_items'    => (float) env('PRICING_EXTRA_ADMIN_PER_5_ITEMS', 3000.0),
    'user_threshold_limit'       => (int) env('PRICING_USER_THRESHOLD_LIMIT', 3),
    'user_threshold_courier_cut' => (float) env('PRICING_USER_THRESHOLD_COURIER_CUT', 2000.0),
];
