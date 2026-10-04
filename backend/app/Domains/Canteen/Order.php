<?php

namespace App\Domains\Canteen;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\OrderItem;
use App\Traits\LogsActivity;

class Order extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    // Konstanta Bisnis Finansial & Tarif Higo Pondok (Opsi B)
    public const BASE_DELIVERY_FEE = 3000.0;
    public const BASE_ADMIN_FEE = 2000.0;
    public const EXTRA_DELIVERY_PER_5_ITEMS = 2000.0;
    public const EXTRA_ADMIN_PER_5_ITEMS = 3000.0;
    public const USER_THRESHOLD_COURIER_CUT = 2000.0; // Potongan ongkir dialihkan ke admin untuk user ke-4 dst
    public const USER_THRESHOLD_LIMIT = 3;            // 3 user pertama tidak dipotong

    /**
     * Dapatkan konfigurasi tarif terpusat (membaca dari config/pricing.php dengan fallback ke konstanta kelas)
     */
    public static function getPricingConfig(): array
    {
        return [
            'base_delivery_fee'          => (float) config('pricing.base_delivery_fee', self::BASE_DELIVERY_FEE),
            'base_admin_fee'             => (float) config('pricing.base_admin_fee', self::BASE_ADMIN_FEE),
            'extra_delivery_per_5_items' => (float) config('pricing.extra_delivery_per_5_items', self::EXTRA_DELIVERY_PER_5_ITEMS),
            'extra_admin_per_5_items'    => (float) config('pricing.extra_admin_per_5_items', self::EXTRA_ADMIN_PER_5_ITEMS),
            'user_threshold_limit'       => (int) config('pricing.user_threshold_limit', self::USER_THRESHOLD_LIMIT),
            'user_threshold_courier_cut' => (float) config('pricing.user_threshold_courier_cut', self::USER_THRESHOLD_COURIER_CUT),
        ];
    }

    protected $fillable = [
        'checkout_id',
        'user_id',
        'canteen_id',
        'total_price',
        'admin_fee',
        'delivery_fee',
        'status',
        'payment_status',
        'courier_id',
        'delivery_location',
        'proof_of_delivery',
        'proof_of_purchase',
        'proof_of_payment',
        'is_courier_paid_by_canteen',
        'proof_courier_paid',
        'custom_notes',
        'is_custom',
        'voucher_id',
        'voucher_discount',
        'order_for',
        'is_priority',
        'created_at',
    ];

    protected $casts = [
        'proof_of_delivery' => 'array',
        'proof_of_purchase' => 'array',
        'proof_of_payment' => 'array',
        'total_price' => 'float',
        'admin_fee' => 'float',
        'delivery_fee' => 'float',
        'voucher_discount' => 'float',
        'is_courier_paid_by_canteen' => 'boolean',
        'is_custom' => 'boolean',
        'is_priority' => 'boolean',
    ];

    protected $appends = [
        'hpp',
        'canteen_profit',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function canteen()
    {
        return $this->belongsTo(Canteen::class);
    }

    public function voucher()
    {
        return $this->belongsTo(Voucher::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function courier()
    {
        return $this->belongsTo(User::class, 'courier_id');
    }

    // ==========================================
    // LOCAL SCOPES
    // ==========================================

    /**
     * Scope untuk mengambil pesanan yang valid masuk ke rekapitulasi (processing & completed)
     */
    public function scopeForRecap($query)
    {
        return $query->whereIn('status', ['processing', 'completed'])
                     ->with(['user', 'items.product', 'canteen', 'courier']);
    }

    /**
     * Scope untuk memfilter pesanan berdasarkan periode tanggal
     */
    public function scopeFilterPeriod($query, ?string $period = 'day', ?string $startDate = null, ?string $endDate = null)
    {
        if ($startDate && $endDate) {
            $start = Carbon::parse($startDate, 'Asia/Jakarta')->startOfDay();
            $end = Carbon::parse($endDate, 'Asia/Jakarta')->endOfDay();
            return $query->whereBetween('created_at', [$start, $end]);
        }

        if ($period === 'all') {
            return $query;
        }

        if ($period === 'week') {
            return $query->whereBetween('created_at', [
                now('Asia/Jakarta')->startOfWeek(),
                now('Asia/Jakarta')->endOfWeek()
            ]);
        }

        if ($period === 'month') {
            return $query->whereMonth('created_at', now('Asia/Jakarta')->month)
                         ->whereYear('created_at', now('Asia/Jakarta')->year);
        }

        if ($period === 'year') {
            return $query->whereYear('created_at', now('Asia/Jakarta')->year);
        }

        // Default: day (hari ini)
        return $query->whereDate('created_at', now('Asia/Jakarta')->format('Y-m-d'));
    }

    // ==========================================
    // LOGIKA PERHITUNGAN AKUNTANSI & TARIF
    // ==========================================

    /**
     * Hitung tarif ongkir & admin saat checkout berdasarkan kuantitas barang
     * Aturan Dasar: Mengambil dari konfigurasi getPricingConfig() (Default Opsi B: Driver 3.000 + Admin 2.000).
     * Setiap kelipatan 5 produk (>5): +2.000 ke driver, +3.000 ke admin.
     */
    public static function calculateOrderFees(int $totalQuantity): array
    {
        $cfg = self::getPricingConfig();
        $extraBlocks = max(0, (int) floor(($totalQuantity - 1) / 5));
        $extraDelivery = $extraBlocks * $cfg['extra_delivery_per_5_items'];
        $extraAdmin = $extraBlocks * $cfg['extra_admin_per_5_items'];

        $deliveryFee = $cfg['base_delivery_fee'] + $extraDelivery;
        $adminFee = $cfg['base_admin_fee'] + $extraAdmin;

        return [
            'extra_blocks'       => $extraBlocks,
            'base_delivery_fee'  => $cfg['base_delivery_fee'],
            'base_admin_fee'     => $cfg['base_admin_fee'],
            'extra_delivery_fee' => $extraDelivery,
            'extra_admin_fee'    => $extraAdmin,
            'delivery_fee'       => $deliveryFee,
            'admin_fee'          => $adminFee,
        ];
    }

    /**
     * Hitung tarif ongkir & admin dengan mempertimbangkan urutan user
     * pada toko yang sama dalam 1 hari kalender.
     *
     * Aturan:
     *   - User ke-1, 2, 3 : delivery_fee utuh, admin_fee normal.
     *   - User ke-4+       : delivery_fee dipotong (dialihkan ke admin).
     *
     * Grand Total yang dibayar user TETAP SAMA; hanya distribusi internal bergeser.
     *
     * @param int $totalQuantity  Total jumlah item dalam pesanan ini.
     * @param int $userDailyIndex Urutan user unik di toko ini hari ini (1-based).
     */
    public static function calculateUserRankedFees(int $totalQuantity, int $userDailyIndex): array
    {
        $cfg = self::getPricingConfig();
        $base = self::calculateOrderFees($totalQuantity);

        $courierCut = ($userDailyIndex > $cfg['user_threshold_limit'])
            ? min($base['delivery_fee'], (float) $cfg['user_threshold_courier_cut'])
            : 0.0;

        return array_merge($base, [
            'delivery_fee'         => $base['delivery_fee'] - $courierCut,
            'admin_fee'            => $base['admin_fee'] + $courierCut,
            'courier_cut_to_admin' => $courierCut,
            'user_daily_index'     => $userDailyIndex,
        ]);
    }

    /**
     * Tentukan urutan (1-based) user pada kantin tertentu pada tanggal tertentu.
     * Hanya menghitung pesanan dengan status pending/processing/completed (bukan cancelled).
     * Digunakan saat checkout untuk menentukan apakah user terkena potongan ongkir.
     *
     * @param int    $userId    ID user yang sedang checkout.
     * @param int    $canteenId ID kantin yang dituju.
     * @param string $date      Tanggal dalam format 'Y-m-d'.
     */
    public static function getUserDailyIndex(int $userId, int $canteenId, string $date): int
    {
        $existingUserIds = self::whereDate('created_at', $date)
            ->where('canteen_id', $canteenId)
            ->whereIn('status', ['pending', 'processing', 'completed'])
            ->orderBy('id', 'asc')
            ->pluck('user_id')
            ->unique()
            ->values();

        $pos = $existingUserIds->search($userId);

        if ($pos === false) {
            return $existingUserIds->count() + 1;
        }

        return $pos + 1;
    }

    /**
     * Aksesor Subtotal Produk (HPJ) di luar ongkir dan admin
     */
    public function getProductsSubtotalAttribute(): float
    {
        if ($this->relationLoaded('items') && $this->items && $this->items->isNotEmpty()) {
            return (float) $this->items->sum(fn($i) => $i->subtotal_amount);
        }

        if ($this->items()->exists()) {
            return (float) $this->items()->sum(\Illuminate\Support\Facades\DB::raw('price * quantity'));
        }

        $rawDelivery = !is_null($this->delivery_fee) ? (float) $this->delivery_fee : 3000.0;
        $rawAdmin = !is_null($this->admin_fee) ? (float) $this->admin_fee : 2000.0;
        $productDiscount = ($this->voucher && $this->voucher->discount_type === 'product_discount') ? (float) ($this->voucher_discount ?? 0) : 0.0;

        return max(0.0, (float) $this->total_price - $rawDelivery - $rawAdmin + $productDiscount);
    }

    /**
     * Aksesor Modal Belanja (HPP) total pesanan
     */
    public function getHppAttribute(): float
    {
        if ($this->relationLoaded('items') && $this->items && $this->items->isNotEmpty()) {
            return (float) $this->items->sum(fn($i) => $i->total_hpp);
        }

        $subtotal = $this->products_subtotal;
        return $subtotal > 1000 ? ($subtotal - 1000.0) : $subtotal;
    }

    /**
     * Aksesor Laba Toko (HPJ - HPP)
     */
    public function getCanteenProfitAttribute(): float
    {
        return $this->products_subtotal - $this->hpp;
    }

    /**
     * Aksesor Pendapatan Bersih Toko (Selisih HPJ dan HPP, ditambah ongkir jika tanpa kurir)
     */
    public function getCanteenIncomeAttribute(): float
    {
        $profit = (float) $this->canteen_profit;
        if (is_null($this->courier_id)) {
            $deliveryFee = (float) ($this->delivery_fee > 0 ? $this->delivery_fee : max(0, (float) $this->total_price - $this->products_subtotal - (float) $this->admin_fee));
            return $profit + $deliveryFee;
        }
        return $profit;
    }

    /**
     * Hitung metrik keuangan komprehensif untuk satu pesanan
     * Memperhitungkan batas user unik harian per toko (3 user pertama utuh, ke-4 dst dipotong)
     * Serta memperhitungkan alokasi diskon voucher (ongkir, admin, produk) secara presisi
     */
    public function getFinancialMetrics(int $userDailyIndex = 1): array
    {
        $cfg = self::getPricingConfig();
        $baseAdminStandard = (float) $cfg['base_admin_fee'];
        $baseDeliveryStandard = (float) $cfg['base_delivery_fee'];

        $voucherDiscount = (float) ($this->voucher_discount ?? 0);
        if ($voucherDiscount <= 0 && $this->voucher) {
            $voucherDiscount = (float) ($this->voucher->discount_amount ?? 0);
        }
        $voucherType = $this->voucher ? $this->voucher->discount_type : null;

        $deliveryDiscount = ($voucherType === 'delivery_fee') ? $voucherDiscount : 0.0;
        $adminDiscount = ($voucherType === 'admin_fee') ? $voucherDiscount : 0.0;
        $productDiscount = ($voucherType === 'product_discount') ? $voucherDiscount : 0.0;

        // Ongkir riil di DB (yang dibayar santri)
        // Jika kolom tidak null di DB, hormati nilai DB (misal 0 karena gratis ongkir)
        $actualDeliveryFee = !is_null($this->delivery_fee) ? (float) $this->delivery_fee : max(0.0, $baseDeliveryStandard - $deliveryDiscount);
        $actualAdminFee = !is_null($this->admin_fee) ? (float) $this->admin_fee : max(0.0, $baseAdminStandard - $adminDiscount);

        // Tarif ongkir kotor standar sebelum subsidi voucher
        $standardGrossDeliveryFee = $actualDeliveryFee + $deliveryDiscount;
        if ($standardGrossDeliveryFee <= 0 && !is_null($this->courier_id)) {
            $standardGrossDeliveryFee = $baseDeliveryStandard;
        }

        // Potongan ambang batas user ke-4+ ke admin
        $discountRate = ($userDailyIndex > $cfg['user_threshold_limit']) ? $cfg['user_threshold_courier_cut'] : 0.0;
        $courierCutToAdmin = 0.0;
        if ($actualAdminFee > $baseAdminStandard) {
            $courierCutToAdmin = $actualAdminFee - $baseAdminStandard;
        } elseif ($discountRate > 0 && $actualDeliveryFee > $discountRate) {
            $courierCutToAdmin = min($actualDeliveryFee, $discountRate);
        }

        // Ongkir bersih untuk kurir (kurir tetap berhak menerima ongkir penuh yang disubsidi oleh voucher)
        $courierNetDeliveryFee = max(0.0, $standardGrossDeliveryFee - $courierCutToAdmin);

        // Subtotal produk kotor (harga menu riil)
        if ($this->relationLoaded('items') && $this->items && $this->items->isNotEmpty()) {
            $grossProductsSubtotal = (float) $this->items->sum(fn($i) => $i->subtotal_amount);
        } else {
            $grossProductsSubtotal = max(0.0, (float) $this->total_price - $actualDeliveryFee - $actualAdminFee + $productDiscount);
        }

        // Subtotal produk bersih (setelah dipotong diskon belanja jika ada)
        $netProductsSubtotal = max(0.0, $grossProductsSubtotal - $productDiscount);

        $orderHpp = $this->hpp;
        // Jika voucher toko spesifik, laba toko menanggung diskon. Jika voucher admin pondok, toko utuh (disubsidi).
        $canteenDiscountBurden = ($voucherType === 'product_discount' && $this->voucher && $this->voucher->canteen_id) ? $productDiscount : 0.0;
        $canteenProfit = $grossProductsSubtotal - $canteenDiscountBurden - $orderHpp;
        $totalPrice = (float) $this->total_price;

        return [
            'total_price' => $totalPrice,
            'products_subtotal' => $grossProductsSubtotal,
            'net_products_subtotal' => $netProductsSubtotal,
            'hpp' => $orderHpp,
            'canteen_profit' => $canteenProfit,
            'raw_delivery_fee' => $standardGrossDeliveryFee,
            'delivery_fee' => $actualDeliveryFee,
            'courier_net_delivery_fee' => $courierNetDeliveryFee,
            'admin_fee' => $actualAdminFee,
            'base_admin_fee' => max(0.0, $actualAdminFee - $courierCutToAdmin),
            'courier_cut_to_admin' => $courierCutToAdmin,
            'voucher_discount' => $voucherDiscount,
            'voucher_type' => $voucherType,
            'delivery_discount' => $deliveryDiscount,
            'admin_discount' => $adminDiscount,
            'product_discount' => $productDiscount,
            'user_daily_index' => $userDailyIndex,
        ];
    }

    /**
     * Hitung rekapitulasi penjualan & keuangan kolektif terpusat
     * Digunakan secara konsisten oleh AdminOrderController dan OrderController (Kantin)
     */
    public static function calculateRecap($orders, string $period = 'day'): array
    {
        $totalProducts = 0;
        $totalNetProducts = 0;
        $totalHpp = 0;
        $totalDeliveryFee = 0;
        $totalCourierNetDeliveryFee = 0;
        $totalAdminFee = 0;
        $totalBaseAdminFee = 0;
        $totalCourierCutToAdmin = 0;
        $totalVoucherDiscount = 0;
        $totalDeliveryDiscount = 0;
        $totalAdminDiscount = 0;
        $totalProductDiscount = 0;
        $grandTotal = 0;

        $canteenRecap = [];
        $userRecap = [];
        $courierRecap = [];
        $productBreakdown = [];

        // Lacak urutan user unik per toko/kantin per tanggal (dalam 1 hari)
        // Aturan: 3 user pertama tidak terkena potongan (ongkir kurir utuh).
        // User ke-4 dan seterusnya terpotong 2.000 dialihkan ke admin.
        $seenUsersPerDayCanteen = [];

        foreach ($orders as $order) {
            $order->loadMissing(['voucher', 'items.product', 'user', 'courier', 'canteen']);

            $cId = $order->canteen_id;
            $orderDate = $order->created_at ? $order->created_at->format('Y-m-d') : date('Y-m-d');
            $dayKey = $orderDate . '_' . $cId;

            if (!isset($seenUsersPerDayCanteen[$dayKey])) {
                $seenUsersPerDayCanteen[$dayKey] = [];
            }

            $userId = $order->user_id;
            if (!isset($seenUsersPerDayCanteen[$dayKey][$userId])) {
                $userIndex = count($seenUsersPerDayCanteen[$dayKey]) + 1;
                $seenUsersPerDayCanteen[$dayKey][$userId] = $userIndex;
            } else {
                $userIndex = $seenUsersPerDayCanteen[$dayKey][$userId];
            }

            $metrics = $order->getFinancialMetrics($userIndex);

            $productsSubtotal = $metrics['products_subtotal'];
            $netProductsSubtotal = $metrics['net_products_subtotal'];
            $orderHpp = $metrics['hpp'];
            $deliveryFee = $metrics['delivery_fee']; // Riil bayar santri
            $courierNetDeliveryFee = $metrics['courier_net_delivery_fee']; // Hak kurir
            $adminFee = $metrics['admin_fee']; // Riil bayar santri
            $baseAdminFee = $metrics['base_admin_fee'];
            $courierCutToAdmin = $metrics['courier_cut_to_admin'];
            $totalPrice = $metrics['total_price'];
            $voucherDiscount = $metrics['voucher_discount'];

            $totalProducts += $productsSubtotal;
            $totalNetProducts += $netProductsSubtotal;
            $totalHpp += $orderHpp;
            $totalDeliveryFee += $deliveryFee;
            $totalCourierNetDeliveryFee += $courierNetDeliveryFee;
            $totalAdminFee += $adminFee;
            $totalBaseAdminFee += $baseAdminFee;
            $totalCourierCutToAdmin += $courierCutToAdmin;
            $totalVoucherDiscount += $voucherDiscount;
            $totalDeliveryDiscount += $metrics['delivery_discount'];
            $totalAdminDiscount += $metrics['admin_discount'];
            $totalProductDiscount += $metrics['product_discount'];
            $grandTotal += $totalPrice;

            // 1. Group by Canteen / Toko
            $cName = $order->canteen ? $order->canteen->name : 'Toko #' . $cId;
            if (!isset($canteenRecap[$cId])) {
                $canteenRecap[$cId] = [
                    'canteen_id' => $cId,
                    'canteen_name' => $cName,
                    'category' => $order->canteen->category ?? 'kauman',
                    'total_products' => 0,
                    'total_net_products' => 0,
                    'total_hpp' => 0,
                    'total_profit' => 0,
                    'total_delivery_fee' => 0,
                    'total_admin_fee' => 0,
                    'total_voucher_discount' => 0,
                    'total_base_admin_fee' => 0,
                    'total_courier_cut_to_admin' => 0,
                    'grand_total' => 0,
                    'order_count' => 0,
                ];
            }
            $canteenRecap[$cId]['total_products'] += $productsSubtotal;
            $canteenRecap[$cId]['total_net_products'] += $netProductsSubtotal;
            $canteenRecap[$cId]['total_hpp'] += $orderHpp;
            $canteenRecap[$cId]['total_profit'] += $metrics['canteen_profit'];
            $canteenRecap[$cId]['total_delivery_fee'] += $deliveryFee;
            $canteenRecap[$cId]['total_admin_fee'] += $adminFee;
            $canteenRecap[$cId]['total_voucher_discount'] += $voucherDiscount;
            $canteenRecap[$cId]['total_base_admin_fee'] += $baseAdminFee;
            $canteenRecap[$cId]['total_courier_cut_to_admin'] += $courierCutToAdmin;
            $canteenRecap[$cId]['grand_total'] += $totalPrice;
            $canteenRecap[$cId]['order_count'] += 1;

            // 2. Group by Santri / Wali
            $santriName = $order->user ? ($order->user->santri_name ?: $order->user->name) : 'Santri #' . $userId;
            $waliName = $order->user ? $order->user->name : 'Wali #' . $userId;

            if (!isset($userRecap[$userId])) {
                $userRecap[$userId] = [
                    'user_id' => $userId,
                    'santri_name' => $santriName,
                    'wali_name' => $waliName,
                    'santri_room' => $order->user->santri_room ?? '',
                    'total_products' => 0,
                    'total_net_products' => 0,
                    'total_delivery_fee' => 0,
                    'total_admin_fee' => 0,
                    'total_voucher_discount' => 0,
                    'total_base_admin_fee' => 0,
                    'total_courier_cut_to_admin' => 0,
                    'grand_total' => 0,
                    'order_count' => 0,
                ];
            }
            $userRecap[$userId]['total_products'] += $productsSubtotal;
            $userRecap[$userId]['total_net_products'] += $netProductsSubtotal;
            $userRecap[$userId]['total_delivery_fee'] += $deliveryFee;
            $userRecap[$userId]['total_admin_fee'] += $adminFee;
            $userRecap[$userId]['total_voucher_discount'] += $voucherDiscount;
            $userRecap[$userId]['total_base_admin_fee'] += $baseAdminFee;
            $userRecap[$userId]['total_courier_cut_to_admin'] += $courierCutToAdmin;
            $userRecap[$userId]['grand_total'] += $totalPrice;
            $userRecap[$userId]['order_count'] += 1;

            // 3. Group by Courier / Kurir
            $courierId = $order->courier_id ?: 0;
            $courierName = $order->courier ? $order->courier->name : 'Tanpa Kurir (Antar Sendiri)';

            if (!isset($courierRecap[$courierId])) {
                $courierRecap[$courierId] = [
                    'courier_id' => $courierId,
                    'courier_name' => $courierName,
                    'is_unassigned' => empty($order->courier_id),
                    'total_delivery_fee' => 0,
                    'total_courier_cut_to_admin' => 0,
                    'net_delivery_fee' => 0,
                    'paid_delivery_fee' => 0,
                    'subsidized_delivery_discount' => 0,
                    'grand_total' => 0,
                    'order_count' => 0,
                ];
            }
            $courierRecap[$courierId]['total_delivery_fee'] += $metrics['raw_delivery_fee'];
            $courierRecap[$courierId]['total_courier_cut_to_admin'] += $courierCutToAdmin;
            $courierRecap[$courierId]['net_delivery_fee'] += $courierNetDeliveryFee;
            $courierRecap[$courierId]['paid_delivery_fee'] += $deliveryFee;
            $courierRecap[$courierId]['subsidized_delivery_discount'] += $metrics['delivery_discount'];
            $courierRecap[$courierId]['grand_total'] += $totalPrice;
            $courierRecap[$courierId]['order_count'] += 1;

            // 4. Product Breakdown
            if ($order->items && $order->items->isNotEmpty()) {
                foreach ($order->items as $item) {
                    $prodId = $item->product_id ?: ('item_' . $item->id);
                    $prodName = $item->product ? $item->product->name : 'Produk Khusus';
                    $itemHpj = (float) $item->price;
                    $itemHpp = (float) $item->hpp;
                    $itemQty = (int) $item->quantity;
                    $itemSubtotal = (float) $item->subtotal_amount;
                    $itemTotalHpp = (float) $item->total_hpp;
                    $itemProfit = (float) $item->profit;

                    if (!isset($productBreakdown[$prodId])) {
                        $productBreakdown[$prodId] = [
                            'product_id' => $prodId,
                            'name' => $prodName,
                            'canteen_name' => $cName,
                            'hpp' => $itemHpp,
                            'hpj' => $itemHpj,
                            'total_quantity' => 0,
                            'total_subtotal' => 0,
                            'total_hpp' => 0,
                            'total_profit' => 0,
                            'is_custom' => false,
                        ];
                    }
                    $productBreakdown[$prodId]['total_quantity'] += $itemQty;
                    $productBreakdown[$prodId]['total_subtotal'] += $itemSubtotal;
                    $productBreakdown[$prodId]['total_hpp'] += $itemTotalHpp;
                    $productBreakdown[$prodId]['total_profit'] += $itemProfit;
                }
            } else {
                $customNotes = trim($order->custom_notes ?? '');
                $prodName = !empty($customNotes) ? ('Titip Beli: ' . $customNotes) : 'Pesanan Khusus / Titip Beli';
                $prodKey = 'custom_' . $cId . '_' . md5($prodName);
                $customHpp = $orderHpp;
                $customProfit = $productsSubtotal - $customHpp;

                if (!isset($productBreakdown[$prodKey])) {
                    $productBreakdown[$prodKey] = [
                        'product_id' => $prodKey,
                        'name' => $prodName,
                        'canteen_name' => $cName,
                        'hpp' => $customHpp,
                        'hpj' => $productsSubtotal,
                        'total_quantity' => 0,
                        'total_subtotal' => 0,
                        'total_hpp' => 0,
                        'total_profit' => 0,
                        'is_custom' => true,
                    ];
                }
                $productBreakdown[$prodKey]['total_quantity'] += 1;
                $productBreakdown[$prodKey]['total_subtotal'] += $productsSubtotal;
                $productBreakdown[$prodKey]['total_hpp'] += $customHpp;
                $productBreakdown[$prodKey]['total_profit'] += $customProfit;
            }
        }

        // Sort breakdowns
        usort($productBreakdown, fn($a, $b) => $b['total_quantity'] <=> $a['total_quantity'] ?: $b['total_subtotal'] <=> $a['total_subtotal']);
        usort($canteenRecap, fn($a, $b) => $b['grand_total'] <=> $a['grand_total']);
        usort($userRecap, fn($a, $b) => $b['grand_total'] <=> $a['grand_total']);
        usort($courierRecap, fn($a, $b) => $b['order_count'] <=> $a['order_count'] ?: $b['net_delivery_fee'] <=> $a['net_delivery_fee']);

        return [
            'period' => $period,
            'summary' => [
                'total_products' => $totalProducts,
                'total_net_products' => $totalNetProducts,
                'total_hpp' => $totalHpp,
                'total_profit' => ($totalProducts - $totalHpp),
                'total_delivery_fee' => $totalDeliveryFee,
                'total_courier_net_delivery_fee' => $totalCourierNetDeliveryFee,
                'total_admin_fee' => $totalAdminFee,
                'total_base_admin_fee' => $totalBaseAdminFee,
                'total_courier_cut_to_admin' => $totalCourierCutToAdmin,
                'total_voucher_discount' => $totalVoucherDiscount,
                'total_delivery_discount' => $totalDeliveryDiscount,
                'total_admin_discount' => $totalAdminDiscount,
                'total_product_discount' => $totalProductDiscount,
                'grand_total' => $grandTotal,
                'total_orders' => count($orders),
            ],
            'canteen_recap' => array_values($canteenRecap),
            'user_recap' => array_values($userRecap),
            'courier_recap' => array_values($courierRecap),
            'product_breakdown' => array_values($productBreakdown),
        ];
    }
}
