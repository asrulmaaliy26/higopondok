<?php

namespace App\Domains\Canteen\Controllers;

use App\Http\Controllers\Controller;
use App\Domains\Canteen\Voucher;
use App\Domains\Canteen\UserVoucher;
use App\Domains\Canteen\Canteen;
use App\Domains\Auth\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class VoucherController extends Controller
{
    /**
     * Public / Santri: Daftar voucher yang tersedia dan belum kadaluarsa
     */
    public function index(Request $request)
    {
        $user = $request->user('sanctum') ?? auth('sanctum')->user() ?? $request->user();

        if ($request->hasHeader('X-Impersonate-User-Id')) {
            if ($user && $user->hasRole('admin')) {
                $impersonateId = $request->header('X-Impersonate-User-Id');
                $targetUser = \App\Domains\Auth\User::find($impersonateId);
                if ($targetUser) {
                    $user = $targetUser;
                }
            }
        }
        
        $vouchers = Voucher::with(['canteen:id,name,image', 'creator:id,name'])
            ->where('is_active', true)
            ->where('valid_until', '>=', now())
            ->orderBy('valid_until', 'asc')
            ->get();

        $userVoucherMap = [];
        if ($user) {
            $userVouchers = UserVoucher::where('user_id', $user->id)->get();
            foreach ($userVouchers as $uv) {
                $userVoucherMap[$uv->voucher_id] = [
                    'is_claimed' => true,
                    'is_used' => (bool) $uv->is_used,
                    'user_voucher_id' => $uv->id,
                ];
            }
        }

        $result = $vouchers->map(function ($voucher) use ($user, $userVoucherMap) {
            $isEligible = $user ? $voucher->isEligibleForUser($user->id) : ($voucher->target_type === 'all');
            $claimInfo = $userVoucherMap[$voucher->id] ?? null;
            $isClaimed = !is_null($claimInfo);
            $isUsed = $claimInfo['is_used'] ?? false;
            $isQuotaFull = $voucher->quota !== null && $voucher->claimed_count >= $voucher->quota;
            $isExpired = $voucher->isExpired();

            $canClaim = $user && $isEligible && !$isClaimed && !$isQuotaFull && !$isExpired;

            return [
                'id' => $voucher->id,
                'code' => $voucher->code,
                'title' => $voucher->title,
                'description' => $voucher->description,
                'discount_type' => $voucher->discount_type,
                'discount_amount' => $voucher->discount_amount,
                'min_purchase' => $voucher->min_purchase,
                'canteen_id' => $voucher->canteen_id,
                'canteen' => $voucher->canteen,
                'target_type' => $voucher->target_type,
                'target_user_ids' => $voucher->target_user_ids,
                'quota' => $voucher->quota,
                'claimed_count' => $voucher->claimed_count,
                'valid_until' => $voucher->valid_until,
                'is_active' => $voucher->is_active,
                'is_eligible' => $isEligible,
                'is_claimed' => $isClaimed,
                'is_used' => $isUsed,
                'is_quota_full' => $isQuotaFull,
                'is_expired' => $isExpired,
                'can_claim' => $canClaim,
                'user_voucher_id' => $claimInfo['user_voucher_id'] ?? null,
            ];
        });

        // Filter out specific vouchers not targeted to this user if user is logged in
        if ($user) {
            $result = $result->filter(fn($v) => $v['is_eligible'])->values();
        }

        return response()->json($result);
    }

    /**
     * User: Daftar voucher yang telah diklaim dan siap digunakan saat checkout
     */
    public function myVouchers(Request $request)
    {
        $user = $request->user();

        $userVouchers = UserVoucher::with(['voucher.canteen:id,name,image'])
            ->where('user_id', $user->id)
            ->where('is_used', false)
            ->whereHas('voucher', function ($q) {
                $q->where('is_active', true)->where('valid_until', '>=', now());
            })
            ->latest('claimed_at')
            ->get();

        return response()->json($userVouchers);
    }

    /**
     * User: Klaim voucher sebelum kadaluarsa
     */
    public function claim(Request $request, $id)
    {
        $user = $request->user();

        return \Illuminate\Support\Facades\DB::transaction(function () use ($user, $id) {
            // \u2705 lockForUpdate mencegah 2 user mengklaim kuota terakhir secara bersamaan
            $voucher = Voucher::lockForUpdate()->findOrFail($id);

            if (!$voucher->is_active) {
                return response()->json(['message' => 'Voucher sudah tidak aktif.'], 422);
            }

            if ($voucher->isExpired()) {
                return response()->json(['message' => 'Voucher sudah kadaluarsa.'], 422);
            }

            if (!$voucher->isEligibleForUser($user->id)) {
                return response()->json(['message' => 'Voucher ini tidak ditujukan untuk akun santri Anda.'], 403);
            }

            // \u2705 Cek kuota ulang di dalam transaction agar presisi
            if ($voucher->quota !== null && $voucher->claimed_count >= $voucher->quota) {
                return response()->json(['message' => 'Kuota klaim voucher ini sudah habis.'], 422);
            }

            $existing = UserVoucher::where('user_id', $user->id)->where('voucher_id', $voucher->id)->first();
            if ($existing) {
                return response()->json(['message' => 'Anda sudah mengklaim voucher ini sebelumnya.'], 422);
            }

            $userVoucher = UserVoucher::create([
                'user_id'    => $user->id,
                'voucher_id' => $voucher->id,
                'claimed_at' => now(),
                'is_used'    => false,
            ]);

            $voucher->increment('claimed_count');

            return response()->json([
                'message'      => 'Voucher berhasil diklaim! Gunakan saat membuat pesanan.',
                'user_voucher' => $userVoucher->load('voucher.canteen')
            ], 201);
        });
    }

    /**
     * Admin & Kantin: Opsi daftar santri untuk filter penerima voucher
     */
    public function santriOptions(Request $request)
    {
        $santris = User::role('user')
            ->select(['id', 'name', 'phone', 'santri_name', 'santri_room', 'santri_class', 'santri_level'])
            ->get()
            ->map(function ($u) {
                $level = $u->santri_level ?: '-';
                if (strcasecmp($level, 'Aliyah') === 0) {
                    $level = 'MA';
                }
                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'phone' => $u->phone,
                    'santri_name' => $u->santri_name ?: $u->name,
                    'santri_room' => $u->santri_room ?: '-',
                    'santri_class' => $u->santri_class ?: '-',
                    'santri_level' => $level,
                ];
            })
            ->sortBy('santri_name')
            ->values();

        return response()->json($santris);
    }

    /**
     * Kantin & Admin: Daftar voucher milik kantin tertentu atau seluruh kantin (mode all)
     */
    public function canteenVouchers(Request $request)
    {
        $user = $request->user();
        $isAdmin = $user && ($user->hasRole('admin') || $user->hasRole('super_admin') || $user->role === 'admin' || $user->role === 'super_admin');
        $canteenId = $request->input('canteen_id') ?? $request->query('canteen_id');

        // Mode 'all': Admin atau pengguna yang ingin melihat seluruh voucher di semua kantin
        if ($canteenId === 'all' || ($isAdmin && !$canteenId)) {
            $vouchers = Voucher::with(['canteen:id,name', 'creator:id,name'])
                ->withCount('userVouchers')
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json($vouchers);
        }

        $canteen = null;
        if ($isAdmin) {
            if ($canteenId) {
                $canteen = Canteen::where('id', $canteenId)->first();
            }
            if (!$canteen) {
                $canteen = Canteen::first();
            }
        } else {
            if ($canteenId) {
                $canteen = $user->canteens()->where('id', $canteenId)->first();
            } else {
                $canteen = $user->canteens()->first();
            }
        }

        if (!$canteen) {
            // Jika admin tidak memiliki toko terdaftar tapi tidak kirim canteen_id, tampilkan seluruh voucher
            if ($isAdmin) {
                $vouchers = Voucher::with(['canteen:id,name', 'creator:id,name'])
                    ->withCount('userVouchers')
                    ->orderBy('created_at', 'desc')
                    ->get();
                return response()->json($vouchers);
            }
            return response()->json(['message' => 'Toko tidak ditemukan'], 404);
        }

        // Tampilkan voucher khusus toko ini BESERTA voucher global pondok (agar toko mengetahui promo aktif)
        $vouchers = Voucher::with(['canteen:id,name', 'creator:id,name'])
            ->withCount('userVouchers')
            ->where(function ($q) use ($canteen) {
                $q->where('canteen_id', $canteen->id)
                  ->orWhereNull('canteen_id');
            })
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($vouchers);
    }

    /**
     * Admin: Daftar seluruh voucher di sistem
     */
    public function allVouchers(Request $request)
    {
        $vouchers = Voucher::with(['canteen:id,name', 'creator:id,name'])
            ->withCount('userVouchers')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($vouchers);
    }

    /**
     * Kantin & Admin: Tambah voucher baru
     */
    public function store(Request $request)
    {
        $user = $request->user();
        $isAdmin = $user && ($user->hasRole('admin') || $user->hasRole('super_admin') || $user->role === 'admin' || $user->role === 'super_admin');

        $rules = [
            'code' => 'required|string|max:20|unique:vouchers,code',
            'title' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'discount_type' => 'required|in:admin_fee,delivery_fee,product_discount',
            'discount_amount' => 'required|numeric|min:1',
            'min_purchase' => 'nullable|numeric|min:0',
            'valid_until' => 'required|date',
            'target_type' => 'required|in:all,specific',
            'target_user_ids' => 'nullable|array',
            'quota' => 'nullable|integer|min:1',
            'canteen_id' => 'nullable',
        ];

        $validated = $request->validate($rules);

        $validated['code'] = Str::upper(preg_replace('/[^A-Z0-9_-]/i', '', $validated['code']));
        $validated['created_by_user_id'] = $user->id;
        $validated['min_purchase'] = $validated['min_purchase'] ?? 0;
        $validated['is_active'] = true;

        if ($isAdmin) {
            $inputCanteenId = $request->input('canteen_id') ?? $request->query('canteen_id');
            if ($inputCanteenId && $inputCanteenId !== 'all') {
                $validated['canteen_id'] = $inputCanteenId;
            } else {
                $validated['canteen_id'] = null; // Global voucher pondok berlaku seluruh kantin
            }
        } else {
            $canteenId = $request->input('canteen_id') ?? $request->query('canteen_id');
            $canteen = $canteenId ? $user->canteens()->where('id', $canteenId)->first() : $user->canteens()->first();
            if (!$canteen) {
                return response()->json(['message' => 'Toko tidak ditemukan'], 404);
            }
            $validated['canteen_id'] = $canteen->id;
        }

        $voucher = Voucher::create($validated);

        return response()->json([
            'message' => 'Voucher berhasil dibuat.',
            'voucher' => $voucher->load(['canteen:id,name', 'creator:id,name'])
        ], 201);
    }

    /**
     * Kantin & Admin: Toggle status aktif/nonaktif voucher
     */
    public function toggleStatus(Request $request, $id)
    {
        $user = $request->user();
        $isAdmin = $user && ($user->hasRole('admin') || $user->hasRole('super_admin') || $user->role === 'admin' || $user->role === 'super_admin');

        $voucher = null;
        if ($isAdmin) {
            $voucher = Voucher::findOrFail($id);
        } else {
            $canteenId = $request->input('canteen_id') ?? $request->query('canteen_id');
            $canteen = $canteenId ? $user->canteens()->where('id', $canteenId)->first() : $user->canteens()->first();
            if (!$canteen) {
                // Alternatif: Cek apakah voucher ini dibuat oleh user ini
                $voucher = Voucher::where('created_by_user_id', $user->id)->findOrFail($id);
            } else {
                $voucher = Voucher::where(function($q) use ($canteen, $user) {
                    $q->where('canteen_id', $canteen->id)->orWhere('created_by_user_id', $user->id);
                })->findOrFail($id);
            }
        }

        $voucher->update(['is_active' => !$voucher->is_active]);

        return response()->json([
            'message' => 'Status voucher berhasil diubah.',
            'voucher' => $voucher
        ]);
    }

    /**
     * Kantin & Admin: Hapus voucher
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $isAdmin = $user && ($user->hasRole('admin') || $user->hasRole('super_admin') || $user->role === 'admin' || $user->role === 'super_admin');

        $voucher = null;
        if ($isAdmin) {
            $voucher = Voucher::findOrFail($id);
        } else {
            $canteenId = $request->input('canteen_id') ?? $request->query('canteen_id');
            $canteen = $canteenId ? $user->canteens()->where('id', $canteenId)->first() : $user->canteens()->first();
            if (!$canteen) {
                $voucher = Voucher::where('created_by_user_id', $user->id)->findOrFail($id);
            } else {
                $voucher = Voucher::where(function($q) use ($canteen, $user) {
                    $q->where('canteen_id', $canteen->id)->orWhere('created_by_user_id', $user->id);
                })->findOrFail($id);
            }
        }

        $voucher->delete();

        return response()->json(['message' => 'Voucher berhasil dihapus.']);
    }

    /**
     * Admin & Kantin: Daftar user yang telah mengklaim voucher tertentu
     */
    public function claimers(Request $request, $id)
    {
        $user = $request->user();
        $isAdmin = $user && ($user->hasRole('admin') || $user->hasRole('super_admin') || $user->role === 'admin' || $user->role === 'super_admin');

        $voucher = null;
        if ($isAdmin) {
            $voucher = Voucher::with(['canteen:id,name'])->findOrFail($id);
        } else {
            $canteenId = $request->input('canteen_id') ?? $request->query('canteen_id');
            $canteen = $canteenId ? $user->canteens()->where('id', $canteenId)->first() : $user->canteens()->first();
            if (!$canteen) {
                $voucher = Voucher::where('created_by_user_id', $user->id)->with(['canteen:id,name'])->findOrFail($id);
            } else {
                $voucher = Voucher::where(function($q) use ($canteen, $user) {
                    $q->where('canteen_id', $canteen->id)->orWhere('created_by_user_id', $user->id);
                })->with(['canteen:id,name'])->findOrFail($id);
            }
        }

        $claims = UserVoucher::with([
                'user:id,name,phone,santri_name,santri_room,santri_class,santri_level',
                'order:id,order_number,status,total_amount'
            ])
            ->where('voucher_id', $voucher->id)
            ->latest('claimed_at')
            ->get()
            ->map(function ($uv) {
                return [
                    'id' => $uv->id,
                    'claimed_at' => $uv->claimed_at,
                    'is_used' => (bool)$uv->is_used,
                    'used_at' => $uv->used_at,
                    'order' => $uv->order ? [
                        'id' => $uv->order->id,
                        'order_number' => $uv->order->order_number,
                        'status' => $uv->order->status,
                        'total_amount' => $uv->order->total_amount,
                    ] : null,
                    'user' => $uv->user ? [
                        'id' => $uv->user->id,
                        'name' => $uv->user->name,
                        'phone' => $uv->user->phone,
                        'santri_name' => $uv->user->santri_name,
                        'santri_room' => $uv->user->santri_room,
                        'santri_class' => $uv->user->santri_class,
                        'santri_level' => $uv->user->santri_level,
                    ] : null,
                ];
            });

        return response()->json([
            'voucher' => [
                'id' => $voucher->id,
                'code' => $voucher->code,
                'title' => $voucher->title,
                'discount_type' => $voucher->discount_type,
                'discount_amount' => $voucher->discount_amount,
                'quota' => $voucher->quota,
                'claimed_count' => $voucher->claimed_count,
            ],
            'claims' => $claims
        ]);
    }
}
