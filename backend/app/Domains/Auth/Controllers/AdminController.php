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

        return response()->json([
            'total_santri' => $totalSantri,
            'total_transactions' => $totalTransactions,
            'pending_approvals' => $pendingApprovals,
            'total_admin_debt' => $totalAdminDebt,
            'recent_activities' => $recentActivities
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
        // 1. Pastikan yang meminta ini adalah ADMIN sejati
        if (!$request->user()->hasRole('admin')) {
            return response()->json(['message' => 'Unauthorized. Hanya Admin yang dapat menyamar.'], 403);
        }

        // 2. Cegah admin menyamar menjadi admin lain untuk keamanan
        $targetUser = User::findOrFail($id);
        if ($targetUser->hasRole('admin')) {
            return response()->json(['message' => 'Tidak dapat menyamar sebagai sesama Admin.'], 403);
        }

        // 3. Buatkan token Sanctum baru khusus untuk penyamaran ini
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
        $logs = \App\Domains\Admin\ActivityLog::with('user:id,name,role')->orderBy('created_at', 'desc')->paginate(50);
        return response()->json($logs);
    }

    public function paymentLogs(Request $request)
    {
        $logs = \App\Domains\Admin\PaymentLog::with(['user:id,name,role', 'order:id,total_price,status'])->orderBy('created_at', 'desc')->paginate(50);
        return response()->json($logs);
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
}
