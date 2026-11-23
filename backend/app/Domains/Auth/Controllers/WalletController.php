<?php

namespace App\Domains\Auth\Controllers;

use App\Http\Controllers\Controller;
use App\Domains\Admin\ActivityLog;
use App\Domains\Auth\User;
use App\Domains\Auth\WalletTransaction;
use App\Domains\Auth\Requests\AdjustWalletRequest;
use App\Domains\Auth\Requests\TopupWalletRequest;
use App\Domains\Auth\Resources\WalletTransactionResource;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\Services\WhatsAppNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WalletController extends Controller
{
    /**
     * Get authenticated user's wallet balance, daily limit summary, and paginated transactions.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $today = now('Asia/Jakarta')->toDateString();

        $todaySpent = (float) Order::where('user_id', $user->id)
            ->whereDate('created_at', $today)
            ->whereNotIn('status', ['cancelled'])
            ->sum('total_price');

        $transactions = WalletTransaction::where('user_id', $user->id)
            ->latest()
            ->paginate(10);

        return response()->json([
            'balance' => (float) ($user->balance ?? 0),
            'santri_daily_limit' => (float) ($user->santri_daily_limit ?? 0),
            'santri_dietary_notes' => $user->santri_dietary_notes,
            'today_spent' => $todaySpent,
            'transactions' => WalletTransactionResource::collection($transactions)->response()->getData(true),
        ]);
    }

    /**
     * Submit a top-up request with transfer proof.
     */
    public function requestTopup(TopupWalletRequest $request)
    {
        return DB::transaction(function () use ($request) {
            $user = $request->user();
            $roleStr = strtolower(str_replace(' ', '_', $user->role ?? 'user'));
            $nameStr = strtolower(str_replace(' ', '_', preg_replace('/[^a-zA-Z0-9\s]/', '', $user->name ?? 'user')));
            $folder = "{$roleStr}_{$nameStr}/wallet_topup";

            $file = $request->file('proof_image');
            $filename = 'topup_' . time() . '_' . Str::random(6) . '.' . ($file->getClientOriginalExtension() ?: 'jpg');
            $path = $file->storeAs($folder, $filename, 'public');

            $tx = WalletTransaction::create([
                'user_id' => $user->id,
                'type' => 'topup',
                'amount' => (float) $request->amount,
                'balance_before' => (float) ($user->balance ?? 0),
                'balance_after' => (float) ($user->balance ?? 0),
                'status' => 'pending',
                'proof_image' => $path,
                'description' => $request->notes ? ('Top Up Higo Wallet: ' . $request->notes) : 'Pengajuan Top Up Saldo Higo Wallet',
            ]);

            return response()->json([
                'message' => 'Pengajuan top-up berhasil dikirim dan menunggu verifikasi Admin.',
                'transaction' => new WalletTransactionResource($tx),
            ], 201);
        });
    }

    /**
     * Admin: List wallet transactions / top-up requests.
     */
    public function adminIndex(Request $request)
    {
        $status = $request->query('status', 'all');
        $type = $request->query('type', 'all');
        $search = trim((string) $request->query('search', ''));

        $query = WalletTransaction::with([
            'user:id,name,santri_name,santri_room,phone,balance',
            'approver:id,name',
        ])->latest();

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }
        if ($type && $type !== 'all') {
            $query->where('type', $type);
        }
        if ($search !== '') {
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('santri_name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $paginated = $query->paginate(15);
        $pendingCount = WalletTransaction::where('type', 'topup')->where('status', 'pending')->count();
        $totalWalletBalance = (float) User::sum('balance');

        return response()->json([
            'pending_count' => $pendingCount,
            'total_wallet_balance' => $totalWalletBalance,
            'transactions' => WalletTransactionResource::collection($paginated)->response()->getData(true),
        ]);
    }

    /**
     * Admin: Approve a pending top-up request.
     */
    public function approveTopup(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $tx = WalletTransaction::where('id', $id)->lockForUpdate()->firstOrFail();
            if ($tx->status !== 'pending') {
                return response()->json(['message' => 'Transaksi top-up ini sudah diproses sebelumnya.'], 422);
            }

            $user = User::where('id', $tx->user_id)->lockForUpdate()->firstOrFail();
            $before = (float) ($user->balance ?? 0);
            $after = $before + (float) $tx->amount;

            $user->balance = $after;
            $user->save();

            $tx->balance_before = $before;
            $tx->balance_after = $after;
            $tx->status = 'completed';
            $tx->approved_by = $request->user()->id;
            $tx->approved_at = now();
            if ($request->filled('admin_notes')) {
                $tx->admin_notes = $request->admin_notes;
            }
            $tx->save();

            $formattedAmt = number_format($tx->amount, 0, ',', '.');
            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'approved',
                'model_type' => WalletTransaction::class,
                'model_id' => $tx->id,
                'description' => "Menyetujui Top Up Higo Wallet {$user->name} sebesar Rp {$formattedAmt}",
            ]);

            WhatsAppNotificationService::notifyWalletTopupApproved($user, (float) $tx->amount);

            return response()->json([
                'message' => 'Top-up saldo Higo Wallet berhasil disetujui.',
                'transaction' => new WalletTransactionResource($tx->load(['user', 'approver'])),
            ]);
        });
    }

    /**
     * Admin: Reject a pending top-up request.
     */
    public function rejectTopup(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $tx = WalletTransaction::where('id', $id)->lockForUpdate()->firstOrFail();
            if ($tx->status !== 'pending') {
                return response()->json(['message' => 'Transaksi top-up ini sudah diproses sebelumnya.'], 422);
            }

            $tx->status = 'rejected';
            $tx->admin_notes = $request->input('admin_notes', 'Bukti transfer tidak valid / ditolak Admin.');
            $tx->approved_by = $request->user()->id;
            $tx->approved_at = now();
            $tx->save();

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'rejected',
                'model_type' => WalletTransaction::class,
                'model_id' => $tx->id,
                'description' => "Menolak Top Up Higo Wallet #{$tx->id}: {$tx->admin_notes}",
            ]);

            return response()->json([
                'message' => 'Pengajuan top-up ditolak.',
                'transaction' => new WalletTransactionResource($tx->load(['user', 'approver'])),
            ]);
        });
    }

    /**
     * Admin: Direct wallet balance adjustment / manual topup.
     */
    public function adminAdjust(AdjustWalletRequest $request)
    {
        return DB::transaction(function () use ($request) {
            $targetUser = User::where('id', $request->user_id)->lockForUpdate()->firstOrFail();
            $amount = (float) $request->amount;
            $before = (float) ($targetUser->balance ?? 0);
            $after = max(0, $before + $amount);

            $targetUser->balance = $after;
            $targetUser->save();

            $tx = WalletTransaction::create([
                'user_id' => $targetUser->id,
                'type' => $amount > 0 ? 'topup' : 'adjustment',
                'amount' => abs($amount),
                'balance_before' => $before,
                'balance_after' => $after,
                'status' => 'completed',
                'description' => $request->description,
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]);

            $formattedAmt = number_format(abs($amount), 0, ',', '.');
            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'adjusted',
                'model_type' => WalletTransaction::class,
                'model_id' => $tx->id,
                'description' => ($amount > 0 ? 'Top Up Manual' : 'Penyesuaian Saldo') . " {$targetUser->name} sebesar Rp {$formattedAmt}",
            ]);

            if ($amount > 0) {
                WhatsAppNotificationService::notifyWalletTopupApproved($targetUser, $amount);
            }

            return response()->json([
                'message' => 'Saldo Higo Wallet berhasil diperbarui.',
                'transaction' => new WalletTransactionResource($tx->load(['user', 'approver'])),
            ]);
        });
    }
}
