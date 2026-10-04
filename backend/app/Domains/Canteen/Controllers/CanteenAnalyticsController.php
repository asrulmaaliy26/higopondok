<?php

namespace App\Domains\Canteen\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Carbon\Carbon;
use App\Domains\Canteen\Order;

class CanteenAnalyticsController extends Controller
{
    public function globalStats(Request $request)
    {
        $user = $request->user();
        
        // Dapatkan semua kantin milik pengguna
        $canteens = $user->canteens()->get();
        $canteenIds = $canteens->pluck('id');

        if ($canteenIds->isEmpty()) {
            return response()->json([
                'today_income' => 0,
                'this_week_income' => 0,
                'this_month_income' => 0,
                'total_balance' => 0,
                'completed_orders_count' => 0,
                'store_performance' => [],
                'recent_transactions' => []
            ]);
        }

        // Hitung Pendapatan Harian (Hari ini)
        $todayIncome = $this->calculateIncome($canteenIds, Carbon::today(), Carbon::tomorrow());

        // Hitung Pendapatan Mingguan (Minggu ini)
        $thisWeekIncome = $this->calculateIncome($canteenIds, Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek());

        // Hitung Pendapatan Bulanan (Bulan ini)
        $thisMonthIncome = $this->calculateIncome($canteenIds, Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth());

        // Saldo Kas Nyata Kantin (Saldo aktif di database)
        $totalBalance = (float) $canteens->sum('balance');

        // Hitung Total Pesanan Selesai
        $completedOrdersCount = Order::whereIn('canteen_id', $canteenIds)
            ->where('status', 'completed')
            ->count();

        // Performa per toko (Ranking)
        $storePerformance = [];
        foreach ($canteens as $canteen) {
            $storeIncome = $this->calculateIncome([$canteen->id], null, null);
            $storeOrders = Order::where('canteen_id', $canteen->id)->where('status', 'completed')->count();
            
            $storePerformance[] = [
                'id' => $canteen->id,
                'name' => $canteen->name,
                'image' => $canteen->image,
                'total_income' => $storeIncome,
                'total_orders' => $storeOrders
            ];
        }
        
        // Urutkan toko berdasarkan pendapatan terbanyak
        usort($storePerformance, function ($a, $b) {
            return $b['total_income'] <=> $a['total_income'];
        });

        // Riwayat Transaksi Terbaru (Limit 15)
        $recentTransactions = Order::with(['user:id,name', 'canteen:id,name'])
            ->whereIn('canteen_id', $canteenIds)
            ->where('status', 'completed')
            ->orderBy('updated_at', 'desc')
            ->take(15)
            ->get()
            ->map(function ($order) {
                // Kalkulasi nominal bersih (tanpa ongkir jika ada kurir) via model Order
                return [
                    'id' => $order->id,
                    'order_number' => $order->id,
                    'canteen_name' => $order->canteen->name ?? 'Unknown',
                    'customer_name' => $order->user->name ?? 'Unknown',
                    'amount' => $order->canteen_income,
                    'date' => $order->updated_at->format('Y-m-d H:i')
                ];
            });

        return response()->json([
            'today_income' => $todayIncome,
            'this_week_income' => $thisWeekIncome,
            'this_month_income' => $thisMonthIncome,
            'total_balance' => $totalBalance,
            'completed_orders_count' => $completedOrdersCount,
            'store_performance' => $storePerformance,
            'recent_transactions' => $recentTransactions
        ]);
    }

    /**
     * Helper untuk menghitung total pendapatan berdasarkan rentang waktu
     */
    private function calculateIncome($canteenIds, $startDate, $endDate)
    {
        $query = Order::whereIn('canteen_id', $canteenIds)
            ->where('status', 'completed');

        if ($startDate && $endDate) {
            $query->whereBetween('updated_at', [$startDate, $endDate]);
        }

        $orders = $query->with(['items.product'])->get();
        $totalIncome = 0;

        foreach ($orders as $order) {
            $totalIncome += $order->canteen_income;
        }

        return $totalIncome;
    }
}
