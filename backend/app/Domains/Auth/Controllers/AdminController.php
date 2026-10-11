<?php

namespace App\Domains\Auth\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Domains\Canteen\Canteen;
use App\Domains\Delivery\Driver;
use App\Domains\Auth\User;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\Resources\CanteenResource;
use App\Domains\Canteen\Requests\BulkUpdateHoursRequest;
use App\Domains\Canteen\Requests\UpdateCanteenHoursRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\OrderItem;
use App\Domains\Canteen\CanteenBanner;
use App\Domains\Canteen\Voucher;
use App\Domains\Canteen\UserVoucher;
use App\Domains\Canteen\CanteenWithdrawal;
use App\Domains\Canteen\CanteenBalanceLedger;
use App\Domains\Admin\PaymentLog;
use App\Domains\Admin\ActivityLog;

class AdminController extends Controller
{
    public function allCanteens()
    {
        // Get all canteens with their user and pending/approved banners
        $canteens = Canteen::with(['user', 'banners' => function($q) {
            $q->orderBy('created_at', 'desc');
        }])->orderBy('created_at', 'desc')->get();
        
        return CanteenResource::collection($canteens);
    }

    public function globalStatus()
    {
        $isGlobalForceClosed = (bool) Cache::get('admin_global_canteen_force_closed', false);
        return response()->json([
            'is_global_force_closed' => $isGlobalForceClosed,
            'total_canteens' => Canteen::count(),
            'approved_canteens' => Canteen::where('status', 'approved')->count(),
        ]);
    }

    public function bulkClose(Request $request)
    {
        Cache::forever('admin_global_canteen_force_closed', true);

        return response()->json([
            'message' => 'Seluruh toko berhasil ditutup langsung.',
            'is_global_force_closed' => true
        ]);
    }

    public function bulkOpen(Request $request)
    {
        Cache::forget('admin_global_canteen_force_closed');

        if ($request->input('reset_all', true)) {
            $canteens = Canteen::where('status', 'approved')->get();
            foreach ($canteens as $canteen) {
                Cache::forget('canteen_force_closed_' . $canteen->id);
            }
        }

        return response()->json([
            'message' => 'Seluruh toko berhasil dibuka kembali (mengikuti jadwal operasional masing-masing).',
            'is_global_force_closed' => false
        ]);
    }

    public function toggleDirectClose(Request $request, $id)
    {
        $canteen = Canteen::findOrFail($id);
        $cacheKey = 'canteen_force_closed_' . $canteen->id;
        $currentState = (bool) Cache::get($cacheKey, false);

        $newState = $request->has('force_close') 
            ? (bool) $request->input('force_close') 
            : !$currentState;

        if ($newState) {
            Cache::forever($cacheKey, true);
            $msg = "Toko {$canteen->name} berhasil ditutup langsung.";
        } else {
            Cache::forget($cacheKey);
            $msg = "Toko {$canteen->name} berhasil dibuka (mengikuti jadwal operasional).";
        }

        return response()->json([
            'message' => $msg,
            'is_force_closed' => $newState,
            'canteen' => new CanteenResource($canteen->fresh())
        ]);
    }

    public function updateFees(Request $request, $id)
    {
        $canteen = Canteen::findOrFail($id);
        
        $category = $request->input('category', $canteen->category ?? 'kauman');
        $defaultDelivery = 3500;
        $defaultAdmin = 1500;

        $canteen->update([
            'category' => $category,
            'delivery_fee' => $request->input('delivery_fee', $defaultDelivery),
            'admin_fee' => $request->input('admin_fee', $defaultAdmin),
            'delivery_rates' => $request->input('delivery_rates', $canteen->delivery_rates),
        ]);
        
        return response()->json(['message' => 'Zona lokasi & tarif toko berhasil diperbarui', 'canteen' => new CanteenResource($canteen)]);
    }

    public function updateHours(UpdateCanteenHoursRequest $request, $id)
    {
        $canteen = Canteen::findOrFail($id);
        $openTime = strlen($request->open_time) === 5 ? $request->open_time . ':00' : $request->open_time;
        $closeTime = strlen($request->close_time) === 5 ? $request->close_time . ':00' : $request->close_time;
        
        $canteen->update([
            'open_time' => $openTime,
            'close_time' => $closeTime,
        ]);

        // Hapus force close cache jika ada
        Cache::forget('canteen_force_closed_' . $canteen->id);
        
        return response()->json([
            'message' => 'Jam operasional berhasil diperbarui', 
            'canteen' => new CanteenResource($canteen->fresh())
        ]);
    }

    public function bulkUpdateHours(BulkUpdateHoursRequest $request)
    {
        $query = Canteen::where('status', 'approved');

        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        $openTime = strlen($request->open_time) === 5 ? $request->open_time . ':00' : $request->open_time;
        $closeTime = strlen($request->close_time) === 5 ? $request->close_time . ':00' : $request->close_time;

        $count = $query->count();
        $query->update([
            'open_time' => $openTime,
            'close_time' => $closeTime,
        ]);

        if ($request->input('reopen_force_closed', true)) {
            Cache::forget('admin_global_canteen_force_closed');
            $affectedCanteens = Canteen::where('status', 'approved')->get();
            foreach ($affectedCanteens as $c) {
                Cache::forget('canteen_force_closed_' . $c->id);
            }
        }

        $categoryLabel = match($request->category) {
            'kauman' => 'Zona Kauman',
            'kota' => 'Zona Kota',
            default => 'Semua Toko'
        };

        return response()->json([
            'message' => "Jam operasional {$categoryLabel} ({$count} toko) berhasil diatur ke {$openTime} - {$closeTime}.",
            'affected_count' => $count
        ]);
    }

    public function dashboardStats()
    {
        $totalSantri = User::role('user')->count();
        $totalTransactions = Order::where('status', 'completed')->count();
        
        $pendingCanteens = Canteen::where('status', 'pending')->count();
        $pendingDrivers = Driver::where('status', 'pending')->count();
        $pendingApprovals = $pendingCanteens + $pendingDrivers;
        
        // Sum of all paid admin fees (if we have a way to track, else sum of all admin_debt)
        $totalAdminDebt = Canteen::sum('admin_debt');

        // Recent users
        $recentUsers = User::with('roles')->orderBy('created_at', 'desc')->take(3)->get();
        
        $recentActivities = $recentUsers->map(function($u) {
            $roleName = $u->roles->first()?->name ?? 'User';
            return [
                'id' => $u->id,
                'title' => 'Pendaftaran ' . ucfirst($roleName) . ' Baru',
                'description' => $u->name . ' baru saja mendaftar',
                'time' => $u->created_at?->diffForHumans() ?? 'Baru saja', // ✅ null-safe
            ];
        });

        // 1. Metrik Finansial & Pembayaran
        $totalOmzet = (float) Order::where('status', 'completed')->sum('total_price');
        $totalAdminFee = (float) Order::where('status', 'completed')->sum('admin_fee');
        $totalDeliveryFee = (float) Order::where('status', 'completed')->sum('delivery_fee');

        $todayOmzet = (float) Order::whereDate('created_at', today())->where('status', 'completed')->sum('total_price');
        $todayOrders = Order::whereDate('created_at', today())->count();

        $paidOrdersCount = Order::where('payment_status', 'paid')->count();
        $unpaidOrdersCount = Order::where('payment_status', '!=', 'paid')->count();

        // 2. Daftar Transaksi / Pembayaran Terbaru (Terakhir 4 transaksi)
        $recentPayments = Order::with(['user:id,name', 'canteen:id,name'])
            ->latest()
            ->take(4)
            ->get()
            ->map(function ($order) {
                return [
                    'id' => $order->id,
                    'user_name' => $order->user?->name ?? 'Santri',
                    'canteen_name' => $order->canteen?->name ?? 'Kantin',
                    'total_price' => (float) $order->total_price,
                    'admin_fee' => (float) $order->admin_fee,
                    'delivery_fee' => (float) $order->delivery_fee,
                    'payment_status' => $order->payment_status ?? 'unpaid',
                    'order_status' => $order->status,
                    'time' => $order->created_at?->diffForHumans() ?? 'Baru saja',
                ];
            });

        return response()->json([
            'total_santri' => $totalSantri,
            'total_transactions' => $totalTransactions,
            'pending_approvals' => $pendingApprovals,
            'total_admin_debt' => $totalAdminDebt,
            'recent_activities' => $recentActivities,
            'payment_summary' => [
                'total_omzet' => $totalOmzet,
                'total_admin_fee' => $totalAdminFee,
                'total_delivery_fee' => $totalDeliveryFee,
                'today_omzet' => $todayOmzet,
                'today_orders' => $todayOrders,
                'paid_orders_count' => $paidOrdersCount,
                'unpaid_orders_count' => $unpaidOrdersCount,
                'recent_payments' => $recentPayments,
            ]
        ]);
    }

    public function pendingCanteens()
    {
        return response()->json(Canteen::with('user')->where('status', 'pending')->get());
    }

    public function approveCanteen($id)
    {
        $canteen = Canteen::findOrFail($id);
        $canteen->update(['status' => 'approved']);
        return response()->json(['message' => 'Kantin disetujui', 'canteen' => $canteen]);
    }

    public function rejectCanteen($id)
    {
        $canteen = Canteen::findOrFail($id);
        $canteen->update(['status' => 'rejected']);
        return response()->json(['message' => 'Kantin ditolak', 'canteen' => $canteen]);
    }

    public function pendingDrivers()
    {
        return response()->json(Driver::with('user')->where('status', 'pending')->get());
    }

    public function approveDriver($id)
    {
        $driver = Driver::findOrFail($id);
        $driver->update(['status' => 'approved']);
        return response()->json(['message' => 'Kurir disetujui', 'driver' => $driver]);
    }

    public function rejectDriver($id)
    {
        $driver = Driver::findOrFail($id);
        $driver->update(['status' => 'rejected']);
        return response()->json(['message' => 'Kurir ditolak', 'driver' => $driver]);
    }

    public function impersonateUser(Request $request, $id)
    {
        // 1. Pastikan yang meminta ini adalah Super Admin / Admin
        if (!$request->user()->hasRole('super_admin') && !$request->user()->hasRole('admin')) {
            return response()->json(['message' => 'Unauthorized. Hanya Super Admin dan Admin yang dapat menyamar.'], 403);
        }

        $targetUser = User::findOrFail($id);

        // 2. Cegah menyamar ke akun sendiri
        if ($targetUser->id === $request->user()->id) {
            return response()->json(['message' => 'Tidak dapat menyamar ke akun sendiri.'], 422);
        }

        // 3. Cegah menyamar menjadi sesama Super Admin untuk keamanan
        if ($targetUser->hasRole('super_admin')) {
            return response()->json(['message' => 'Tidak dapat menyamar sebagai Super Admin.'], 403);
        }

        // 4. Jika requester bukan Super Admin (Admin biasa), cegah menyamar sebagai sesama Admin
        if (!$request->user()->hasRole('super_admin') && $targetUser->hasRole('admin')) {
            return response()->json(['message' => 'Admin tidak diizinkan menyamar sebagai sesama Admin.'], 403);
        }

        // 5. Buatkan token Sanctum baru khusus untuk penyamaran ini
        // Kita beri nama token 'impersonation_token'
        $token = $targetUser->createToken('impersonation_token')->plainTextToken;

        $targetUser->load(['roles', 'canteens', 'assignedCanteens']);

        return response()->json([
            'message' => 'Berhasil beralih akun.',
            'user' => $targetUser,
            'token' => $token
        ]);
    }

    public function payAdminDebt(Request $request, $id)
    {
        $canteen = \App\Domains\Canteen\Canteen::findOrFail($id);
        
        $amount = $canteen->admin_debt;
        
        $canteen->update([
            'admin_debt' => 0
        ]);

        return response()->json([
            'message' => 'Pembayaran tagihan admin sebesar Rp ' . number_format($amount, 0, ',', '.') . ' telah diterima.',
            'canteen' => $canteen
        ]);
    }

    public function processWithdrawal(Request $request, $id)
    {
        $data = $request->validate([
            'amount' => 'required|numeric|min:1000',
            'notes' => 'nullable|string|max:255',
        ]);

        return DB::transaction(function () use ($request, $id, $data) {
            $canteen = Canteen::lockForUpdate()->findOrFail($id);

            if ($canteen->balance < $data['amount']) {
                return response()->json([
                    'message' => 'Saldo kantin tidak mencukupi untuk pencairan ini.',
                    'current_balance' => $canteen->balance
                ], 400);
            }

            $withdrawalAmount = (float) $data['amount'];

            \App\Domains\Canteen\CanteenBalanceLedger::record(
                $canteen,
                'out',
                $withdrawalAmount,
                "Pencairan dana kantin ({$canteen->name}) oleh admin: " . ($data['notes'] ?? '-')
            );

            $canteen->decrement('balance', $withdrawalAmount);

            \App\Domains\Canteen\CanteenWithdrawal::create([
                'canteen_id' => $canteen->id,
                'admin_id' => $request->user()->id,
                'amount' => $withdrawalAmount,
                'notes' => $data['notes'] ?? null
            ]);

            \App\Domains\Admin\PaymentLog::create([
                'user_id' => $canteen->user_id,
                'amount' => $withdrawalAmount,
                'type' => 'withdraw',
                'description' => "Pencairan dana kantin ({$canteen->name}) oleh admin: " . ($data['notes'] ?? '-'),
            ]);

            return response()->json([
                'message' => 'Pencairan dana berhasil diproses.',
                'canteen' => $canteen->fresh()
            ]);
        });
    }

    public function activityLogs(Request $request)
    {
        $query = \App\Domains\Admin\ActivityLog::with(['user:id,name', 'user.roles'])->orderBy('id', 'desc');

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('model_type', 'like', "%{$search}%")
                  ->orWhereHas('user', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        if ($request->filled('action') && $request->action !== 'all') {
            $query->where('action', $request->action);
        }

        if ($request->filled('date_filter')) {
            $filter = $request->date_filter;
            if ($filter === 'today') {
                $query->whereDate('created_at', now()->today());
            } elseif ($filter === 'yesterday') {
                $query->whereDate('created_at', now()->subDay()->toDateString());
            } elseif ($filter === '7_days') {
                $query->where('created_at', '>=', now()->subDays(7)->startOfDay());
            } elseif ($filter === '30_days') {
                $query->where('created_at', '>=', now()->subDays(30)->startOfDay());
            }
        } elseif ($request->filled('date')) {
            $query->whereDate('created_at', $request->date);
        }

        $perPage = (int) $request->input('per_page', 50);
        $logs = $query->paginate($perPage);
        return response()->json($logs);
    }

    public function paymentLogs(Request $request)
    {
        $logs = \App\Domains\Admin\PaymentLog::with(['user:id,name', 'user.roles', 'order:id,total_price,status'])->orderBy('id', 'desc')->paginate(50);
        return response()->json($logs);
    }

    public function userAchievements(Request $request)
    {
        $totalCompleted = \App\Domains\Canteen\Order::where('status', 'completed')->count();
        $totalOrders = \App\Domains\Canteen\Order::count();
        $successRate = $totalOrders > 0 ? round(($totalCompleted / $totalOrders) * 100, 1) : 0;
        $totalTurnover = (float) \App\Domains\Canteen\Order::where('status', 'completed')->sum('total_price');

        // 1. Top Santri / Pelanggan Pesanan Tertinggi
        $topUsers = \App\Domains\Canteen\Order::where('status', 'completed')
            ->selectRaw('user_id, count(*) as total_orders, sum(total_price) as total_spent')
            ->groupBy('user_id')
            ->orderByDesc('total_orders')
            ->take(15)
            ->with('user:id,name,santri_name,santri_room,santri_class,penalty_points')
            ->get()
            ->map(function ($row, $index) {
                $u = $row->user;
                return [
                    'rank' => $index + 1,
                    'user_id' => $row->user_id,
                    'name' => $u ? ($u->santri_name ?: $u->name) : "User #{$row->user_id}",
                    'room' => $u->santri_room ?? '-',
                    'class' => $u->santri_class ?? '-',
                    'penalty_points' => (int) ($u->penalty_points ?? 0),
                    'total_orders' => (int) $row->total_orders,
                    'total_spent' => (float) $row->total_spent,
                ];
            });

        // 2. Top Kantin / Toko Terlaris
        $topCanteens = \App\Domains\Canteen\Order::where('status', 'completed')
            ->selectRaw('canteen_id, count(*) as total_orders, sum(total_price) as total_revenue')
            ->groupBy('canteen_id')
            ->orderByDesc('total_orders')
            ->take(15)
            ->with('canteen:id,name,category')
            ->get()
            ->map(function ($row, $index) {
                $c = $row->canteen;
                return [
                    'rank' => $index + 1,
                    'canteen_id' => $row->canteen_id,
                    'name' => $c->name ?? "Toko #{$row->canteen_id}",
                    'category' => $c->category ?? '-',
                    'total_orders' => (int) $row->total_orders,
                    'total_revenue' => (float) $row->total_revenue,
                ];
            });

        // 3. Top Kurir Pengantaran Terbanyak
        $topCouriers = \App\Domains\Canteen\Order::where('status', 'completed')
            ->whereNotNull('courier_id')
            ->selectRaw('courier_id, count(*) as total_delivered, sum(delivery_fee) as total_fee')
            ->groupBy('courier_id')
            ->orderByDesc('total_delivered')
            ->take(15)
            ->with('courier:id,name')
            ->get()
            ->map(function ($row, $index) {
                $cr = $row->courier;
                return [
                    'rank' => $index + 1,
                    'courier_id' => $row->courier_id,
                    'name' => $cr->name ?? "Kurir #{$row->courier_id}",
                    'total_delivered' => (int) $row->total_delivered,
                    'total_fee' => (float) $row->total_fee,
                ];
            });

        return response()->json([
            'summary' => [
                'total_completed_orders' => $totalCompleted,
                'total_orders' => $totalOrders,
                'success_rate' => $successRate,
                'total_turnover' => $totalTurnover,
            ],
            'top_users' => $topUsers,
            'top_canteens' => $topCanteens,
            'top_couriers' => $topCouriers,
        ]);
    }

    /**
     * Helper: Memuat seluruh data master santri unik (1.713 santri) dan memetakan akun-akun pemesan.
     */
    protected function getMasterSantriCollection()
    {
        $jsonPath = base_path('../data_santri/seluruh_data_santri.json');
        if (!file_exists($jsonPath)) {
            $jsonPath = base_path('../frontend/src/data/santri.json');
        }

        $rows = [];
        if (file_exists($jsonPath)) {
            $json = json_decode(file_get_contents($jsonPath), true);
            $rows = $json['data'] ?? [];
        }

        // Ambil seluruh user terdaftar yang memiliki santri_name
        $usersWithSantri = User::whereNotNull('santri_name')
            ->where('santri_name', '!=', '')
            ->withCount(['orders as completed_orders_count' => fn($q) => $q->where('status', 'completed')])
            ->withCount('orders as total_orders_count')
            ->withSum(['orders as total_spent' => fn($q) => $q->where('status', 'completed')], 'total_price')
            ->get(['id', 'name', 'email', 'phone', 'santri_name', 'santri_room', 'santri_class', 'santri_level', 'balance', 'penalty_points']);

        $accountsBySantri = [];
        foreach ($usersWithSantri as $u) {
            $clean = trim(preg_replace('/\s+/', ' ', mb_strtoupper($u->santri_name)));
            $clean = trim(preg_replace('/\s+(LAKI-LAKI|PEREMPUAN)$/i', '', $clean));
            if (!isset($accountsBySantri[$clean])) {
                $accountsBySantri[$clean] = [];
            }
            $accountsBySantri[$clean][] = $u;
        }

        $allSantri = [];
        $processedKeys = [];

        foreach ($rows as $index => $r) {
            $rawName = $r[1] ?? '';
            $cleanName = trim(preg_replace('/\s+(Laki-laki|Perempuan)$/i', '', $rawName));
            $key = trim(preg_replace('/\s+/', ' ', mb_strtoupper($cleanName)));
            $processedKeys[$key] = true;

            $gender = '';
            if (preg_match('/Perempuan$/i', $rawName)) $gender = 'Perempuan';
            elseif (preg_match('/Laki-laki$/i', $rawName)) $gender = 'Laki-laki';

            $nis = trim($r[2] ?? '');
            $nisn = trim($r[3] ?? '');
            $level = trim($r[4] ?? '');
            $class = trim($r[5] ?? '');
            $room = trim($r[10] ?? '') ?: (trim($r[6] ?? '') ?: '-');
            $program = trim($r[7] ?? '');
            $phone = trim($r[8] ?? '');

            $matched = $accountsBySantri[$key] ?? [];

            $totOrders = 0;
            $totSpent = 0;
            $maxPenalty = 0;
            $totBalance = 0;

            foreach ($matched as $acc) {
                $totOrders += (int) $acc->completed_orders_count;
                $totSpent += (float) $acc->total_spent;
                if ($acc->penalty_points > $maxPenalty) $maxPenalty = (int) $acc->penalty_points;
                $totBalance += (float) $acc->balance;
            }

            $allSantri[] = [
                'id' => $nis ?: ('s_' . ($index + 1)),
                'nis' => $nis,
                'nisn' => $nisn,
                'santri_name' => $cleanName,
                'gender' => $gender,
                'santri_level' => $level,
                'santri_class' => $class,
                'santri_room' => $room,
                'program' => $program,
                'phone' => $phone,
                'accounts_count' => count($matched),
                'linked_accounts' => $matched,
                'completed_orders_count' => $totOrders,
                'total_spent' => $totSpent,
                'penalty_points' => $maxPenalty,
                'total_balance' => $totBalance,
            ];
        }

        // Masukkan juga santri dari tabel users yang mungkin namanya belum ada di master json
        foreach ($accountsBySantri as $key => $accs) {
            if (!isset($processedKeys[$key])) {
                $firstAcc = $accs[0];
                $totOrders = 0;
                $totSpent = 0;
                $maxPenalty = 0;
                $totBalance = 0;
                foreach ($accs as $acc) {
                    $totOrders += (int) $acc->completed_orders_count;
                    $totSpent += (float) $acc->total_spent;
                    if ($acc->penalty_points > $maxPenalty) $maxPenalty = (int) $acc->penalty_points;
                    $totBalance += (float) $acc->balance;
                }

                $allSantri[] = [
                    'id' => 'u_' . $firstAcc->id,
                    'nis' => '-',
                    'nisn' => '-',
                    'santri_name' => $firstAcc->santri_name,
                    'gender' => '',
                    'santri_level' => $firstAcc->santri_level ?: '-',
                    'santri_class' => $firstAcc->santri_class ?: '-',
                    'santri_room' => $firstAcc->santri_room ?: '-',
                    'program' => '-',
                    'phone' => $firstAcc->phone ?: '-',
                    'accounts_count' => count($accs),
                    'linked_accounts' => $accs,
                    'completed_orders_count' => $totOrders,
                    'total_spent' => $totSpent,
                    'penalty_points' => $maxPenalty,
                    'total_balance' => $totBalance,
                ];
            }
        }

        return collect($allSantri);
    }

    /**
     * Mengambil daftar master seluruh santri unik (1 santri = 1 baris) beserta statistik pesanan & filter.
     */
    public function santriList(Request $request)
    {
        $santriCollection = $this->getMasterSantriCollection();

        // Opsi Filter Unik
        $levels = $santriCollection->pluck('santri_level')->filter(fn($l) => $l && $l !== '-')->unique()->values()->sort()->values();
        
        $levelClassesMap = [];
        foreach ($santriCollection->groupBy('santri_level') as $lvl => $group) {
            if ($lvl && $lvl !== '-') {
                $levelClassesMap[$lvl] = $group->pluck('santri_class')->filter(fn($c) => $c && $c !== '-')->unique()->values()->sort()->values();
            }
        }

        $allRooms = $santriCollection->pluck('santri_room')->filter(fn($r) => $r && $r !== '-')->unique()->values()->sort()->values();

        // Filter Pencarian Teks
        if ($request->filled('search')) {
            $search = mb_strtolower(trim($request->search));
            $santriCollection = $santriCollection->filter(function ($item) use ($search) {
                if (str_contains(mb_strtolower($item['santri_name']), $search)) return true;
                if (str_contains(mb_strtolower($item['nis']), $search)) return true;
                if (str_contains(mb_strtolower($item['nisn']), $search)) return true;
                if (str_contains(mb_strtolower($item['santri_room']), $search)) return true;
                if (str_contains(mb_strtolower($item['santri_class']), $search)) return true;
                if (str_contains(mb_strtolower($item['phone']), $search)) return true;

                // Cari juga di nama wali atau email akun yang terhubung
                foreach ($item['linked_accounts'] as $acc) {
                    if (str_contains(mb_strtolower($acc->name ?? ''), $search)) return true;
                    if (str_contains(mb_strtolower($acc->email ?? ''), $search)) return true;
                    if (str_contains(mb_strtolower($acc->phone ?? ''), $search)) return true;
                }

                return false;
            });
        }

        // Filter Jenjang
        if ($request->filled('level') && $request->level !== 'all') {
            $santriCollection = $santriCollection->filter(fn($i) => $i['santri_level'] === $request->level);
        }

        // Filter Kelas
        if ($request->filled('class') && $request->class !== 'all') {
            $santriCollection = $santriCollection->filter(fn($i) => str_contains($i['santri_class'], $request->class));
        }

        // Filter Kamar
        if ($request->filled('room') && $request->room !== 'all') {
            $santriCollection = $santriCollection->filter(fn($i) => str_contains($i['santri_room'], $request->room));
        }

        // Filter Status Akun
        if ($request->input('account_status') === 'has_account') {
            $santriCollection = $santriCollection->filter(fn($i) => $i['accounts_count'] > 0);
        } elseif ($request->input('account_status') === 'no_account') {
            $santriCollection = $santriCollection->filter(fn($i) => $i['accounts_count'] === 0);
        } elseif ($request->input('account_status') === 'multi_account') {
            $santriCollection = $santriCollection->filter(fn($i) => $i['accounts_count'] > 1);
        }

        // Pengurutan
        $sortBy = $request->input('sort_by', 'name_asc');
        if ($sortBy === 'orders_desc') {
            $santriCollection = $santriCollection->sortByDesc('completed_orders_count');
        } elseif ($sortBy === 'spent_desc') {
            $santriCollection = $santriCollection->sortByDesc('total_spent');
        } elseif ($sortBy === 'penalty_desc') {
            $santriCollection = $santriCollection->sortByDesc('penalty_points');
        } elseif ($sortBy === 'accounts_desc') {
            $santriCollection = $santriCollection->sortByDesc('accounts_count');
        } elseif ($sortBy === 'balance_desc') {
            $santriCollection = $santriCollection->sortByDesc('total_balance');
        } else {
            $santriCollection = $santriCollection->sortBy('santri_name', SORT_NATURAL | SORT_FLAG_CASE);
        }

        // Paginasi
        $perPage = max(5, min(100, (int) $request->input('per_page', 25)));
        $currentPage = max(1, (int) $request->input('page', 1));
        $totalItems = $santriCollection->count();

        $pagedItems = $santriCollection->slice(($currentPage - 1) * $perPage, $perPage)->values();

        $classesForSelectedLevel = ($request->filled('level') && $request->level !== 'all' && isset($levelClassesMap[$request->level]))
            ? $levelClassesMap[$request->level]
            : $santriCollection->pluck('santri_class')->filter(fn($c) => $c && $c !== '-')->unique()->values()->sort()->values();

        return response()->json([
            'santri' => [
                'current_page' => $currentPage,
                'data' => $pagedItems,
                'first_page_url' => null,
                'from' => ($currentPage - 1) * $perPage + 1,
                'last_page' => (int) ceil($totalItems / $perPage),
                'next_page_url' => null,
                'path' => $request->url(),
                'per_page' => $perPage,
                'prev_page_url' => null,
                'to' => min($currentPage * $perPage, $totalItems),
                'total' => $totalItems,
            ],
            'filter_options' => [
                'levels' => $levels,
                'classes' => $classesForSelectedLevel,
                'rooms' => $allRooms,
                'level_classes_map' => $levelClassesMap,
            ],
            'meta_counts' => [
                'total_santri' => $totalItems,
                'total_master' => 1713,
            ]
        ]);
    }

    /**
     * Mengambil detail lengkap 1 santri dari master data beserta seluruh akun terhubung dan 5 riwayat pesanan terakhir.
     */
    public function santriDetail($id)
    {
        $santriCollection = $this->getMasterSantriCollection();

        $santri = $santriCollection->first(function ($item) use ($id) {
            return (string) $item['id'] === (string) $id
                || (string) $item['nis'] === (string) $id
                || mb_strtolower($item['santri_name']) === mb_strtolower($id);
        });

        if (!$santri) {
            // Fallback cari di User jika ada id numeric
            $fallbackUser = User::find($id);
            if ($fallbackUser && $fallbackUser->santri_name) {
                $santri = $santriCollection->first(function ($item) use ($fallbackUser) {
                    return mb_strtolower($item['santri_name']) === mb_strtolower($fallbackUser->santri_name);
                });
            }
        }

        if (!$santri) {
            return response()->json(['message' => 'Santri tidak ditemukan.'], 404);
        }

        $accountIds = collect($santri['linked_accounts'])->pluck('id')->filter()->toArray();

        // 5 pesanan terakhir dari seluruh akun yang terhubung ke santri ini
        $recentOrders = [];
        if (!empty($accountIds)) {
            $recentOrders = \App\Domains\Canteen\Order::whereIn('user_id', $accountIds)
                ->with(['canteen:id,name', 'user:id,name', 'items:id,order_id,product_id,quantity,price,subtotal', 'items.product:id,name'])
                ->orderByDesc('id')
                ->take(5)
                ->get();
        }

        return response()->json([
            'santri' => $santri,
            'linked_accounts' => $santri['linked_accounts'],
            'recent_orders' => $recentOrders,
        ]);
    }

    /**
     * Admin: Tetapkan / cabut status Guru/Staff pada user tertentu.
     * Endpoint ini WAJIB digunakan karena PUT /me tidak mengizinkan user self-set is_teacher.
     */
    public function setTeacherStatus(Request $request, $id)
    {
        $request->validate([
            'is_teacher'   => 'required|boolean',
            'niy'          => 'nullable|string|max:50',
            'teacher_unit' => 'nullable|string|max:100',
        ]);

        $targetUser = User::findOrFail($id);

        $targetUser->update([
            'is_teacher'   => (bool) $request->is_teacher,
            'niy'          => $request->niy ?? $targetUser->niy,
            'teacher_unit' => $request->teacher_unit ?? $targetUser->teacher_unit,
        ]);

        return response()->json([
            'message' => 'Status Guru/Staff berhasil ' . ($request->is_teacher ? 'ditetapkan' : 'dicabut') . '.',
            'user' => $targetUser->load('roles'),
        ]);
    }

    /**
     * Super Admin: Hapus toko secara permanen beserta seluruh produk,
     * pesanan, order items, log pembayaran, saldo ledgers, voucher, banner, dan file fisiknya.
     */
    public function destroyCanteen(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || !$user->hasRole('super_admin')) {
            return response()->json([
                'message' => 'Hanya Super Administrator yang berhak menghapus toko secara permanen.'
            ], 403);
        }

        $canteen = Canteen::withTrashed()->findOrFail($id);
        $canteenName = $canteen->name;

        DB::transaction(function () use ($canteen, $request) {
            // 1. Ambil seluruh pesanan milik toko (termasuk yang soft deleted)
            $orders = Order::withTrashed()->where('canteen_id', $canteen->id)->get();
            $orderIds = $orders->pluck('id')->toArray();

            // 2. Hapus berkas bukti fisik pesanan
            foreach ($orders as $order) {
                foreach (['proof_of_delivery', 'proof_of_purchase', 'proof_of_payment', 'proof_courier_paid'] as $fileField) {
                    if (!empty($order->$fileField)) {
                        Storage::disk('public')->delete($order->$fileField);
                    }
                }
            }

            // 3. Bersihkan transaksi pembayaran, buku kas pesanan, dan order items
            if (!empty($orderIds)) {
                PaymentLog::whereIn('order_id', $orderIds)->delete();
                CanteenBalanceLedger::whereIn('order_id', $orderIds)->delete();
                OrderItem::whereIn('order_id', $orderIds)->forceDelete();
            }

            // 4. Hapus pesanan secara permanen (force delete) agar profit/rekap bersih
            Order::withTrashed()->where('canteen_id', $canteen->id)->forceDelete();

            // 5. Bersihkan buku kas kantin & penarikan saldo
            CanteenBalanceLedger::where('canteen_id', $canteen->id)->delete();
            CanteenWithdrawal::where('canteen_id', $canteen->id)->delete();

            // 6. Hapus seluruh produk toko berserta gambar fisiknya
            $products = Product::withTrashed()->where('canteen_id', $canteen->id)->get();
            foreach ($products as $product) {
                if (!empty($product->image)) {
                    Storage::disk('public')->delete($product->image);
                }
                $product->forceDelete();
            }

            // 7. Bersihkan banner promosi toko berserta gambar fisiknya
            $banners = CanteenBanner::where('canteen_id', $canteen->id)->get();
            foreach ($banners as $banner) {
                if (!empty($banner->image)) {
                    Storage::disk('public')->delete($banner->image);
                }
                $banner->delete();
            }

            // 8. Bersihkan voucher toko & user vouchers
            $vouchers = Voucher::where('canteen_id', $canteen->id)->get();
            $voucherIds = $vouchers->pluck('id')->toArray();
            if (!empty($voucherIds)) {
                UserVoucher::whereIn('voucher_id', $voucherIds)->delete();
            }
            Voucher::where('canteen_id', $canteen->id)->delete();

            // 9. Putus hubungan kurir (pivot canteen_couriers)
            $canteen->couriers()->detach();

            // 10. Hapus logo / gambar fisik toko jika ada
            if (!empty($canteen->image)) {
                Storage::disk('public')->delete($canteen->image);
            }

            // 11. Hapus cache status operasional / force close
            Cache::forget('canteen_force_closed_' . $canteen->id);

            // 12. Catat log aktivitas Super Admin
            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'DELETE_CANTEEN',
                'description' => "Super Admin {$request->user()->name} menghapus permanen toko '{$canteen->name}' (ID: {$canteen->id}) beserta seluruh produk, pesanan, dan rekap profit.",
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            // 13. Hapus entitas toko secara permanen
            $canteen->forceDelete();
        });

        return response()->json([
            'message' => "Toko '{$canteenName}' beserta seluruh produk, pesanan, dan rekap profit berhasil dihapus permanen.",
        ]);
    }
}

