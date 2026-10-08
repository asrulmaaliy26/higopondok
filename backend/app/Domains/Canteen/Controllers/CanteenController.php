<?php

namespace App\Domains\Canteen\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Requests\UpdateCanteenRequest;
use App\Domains\Canteen\Resources\CanteenResource;

class CanteenController extends Controller
{
    public function index(Request $request)
    {
        // Public route: list approved canteens
        $userLat = $request->query('lat', -7.250445);
        $userLng = $request->query('lng', 112.768845);

        // Cache 60 detik per kombinasi koordinat
        $cacheKey = 'canteens_list_' . round($userLat, 3) . '_' . round($userLng, 3);
        $data = Cache::remember($cacheKey, 60, function () use ($userLat, $userLng, $request) {
            $canteens = Canteen::approved()
                ->select('canteens.*')
                ->selectRaw("( 6371 * acos( cos( radians(?) ) * cos( radians( latitude ) ) * cos( radians( longitude ) - radians(?) ) + sin( radians(?) ) * sin( radians( latitude ) ) ) ) AS distance", [$userLat, $userLng, $userLat])
                ->with(['products', 'user:id,name,phone,email'])
                ->withCount('products')
                ->orderBy('distance')
                ->get();

            return CanteenResource::collection($canteens)->resolve($request);
        });
            
        return response()->json(['data' => $data]);
    }

    public function show($id)
    {
        $canteen = Canteen::with(['products'])->findOrFail($id);
        return response()->json($canteen);
    }

    private function getActiveCanteen(Request $request)
    {
        $canteenId = $request->query('canteen_id') ?? $request->input('canteen_id');
        $user = $request->user();

        if ($user && ($user->hasRole('admin') || $user->hasRole('super_admin'))) {
            if ($canteenId) {
                return Canteen::where('id', $canteenId)->first() ?: Canteen::first();
            }
            return Canteen::first();
        }

        if ($canteenId) {
            return $user->canteens()->where('id', $canteenId)->first();
        }
        return $user->canteens()->first();
    }

    public function myCanteens(Request $request)
    {
        $user = $request->user();

        if ($user && ($user->hasRole('admin') || $user->hasRole('super_admin'))) {
            $canteens = Canteen::with(['user:id,name,email,phone'])
                ->withCount(['orders as pending_orders_count' => function ($query) {
                    $query->whereIn('status', ['pending', 'processing']);
                }])->get();
            return CanteenResource::collection($canteens);
        }

        $canteens = $user->canteens()
            ->with(['user:id,name,email,phone'])
            ->withCount(['orders as pending_orders_count' => function ($query) {
                $query->whereIn('status', ['pending', 'processing']);
            }])
            ->get();
        return CanteenResource::collection($canteens);
    }

    public function storeMyCanteen(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);
        
        $data['user_id'] = $request->user()->id;
        $data['status'] = 'pending';
        
        $canteen = Canteen::create($data);
        return response()->json([
            'message' => 'Kantin baru berhasil dibuat. Menunggu persetujuan admin.',
            'canteen' => new CanteenResource($canteen)
        ]);
    }

    public function myCanteen(Request $request)
    {
        $canteen = $this->getActiveCanteen($request);
        
        if (!$canteen) {
            return response()->json(['message' => 'Kantin tidak ditemukan'], 404);
        }
        $canteen->load(['user:id,name,email,phone', 'products', 'banners', 'orders.items']);
        return new CanteenResource($canteen);
    }

    public function dashboardStats(Request $request)
    {
        $canteen = $this->getActiveCanteen($request);
        if (!$canteen) {
            return response()->json(['message' => 'Kantin tidak ditemukan'], 404);
        }

        $canteen->load(['products', 'orders.items']);
        $pendingOrders = $canteen->orders()->whereIn('status', ['pending', 'processing'])->count();
        
        $todayIncome = 0;
        $completedToday = $canteen->orders()->where('status', 'completed')
            ->whereDate('updated_at', today())->get();
            
        foreach ($completedToday as $order) {
            $todayIncome += $order->canteen_income;
        }

        $outOfStock = $canteen->products()->where(function($q) {
            $q->where('stock', 0)->orWhere('is_available', false);
        })->count();

        return response()->json([
            'pending_orders' => $pendingOrders,
            'today_income' => $todayIncome,
            'out_of_stock_products' => $outOfStock,
            'rating' => $canteen->rating
        ]);
    }

    public function updateMyCanteen(UpdateCanteenRequest $request)
    {
        $canteen = $this->getActiveCanteen($request);
        if (!$canteen) {
            return response()->json(['message' => 'Kantin tidak ditemukan'], 404);
        }
        
        $data = $request->validated();
        
        if ($request->hasFile('image')) {
            if ($canteen->image) {
                Storage::disk('public')->delete($canteen->image);
            }
            $path = $this->storeOptimizedImage($request->file('image'), $request->user(), 'canteens');
            $data['image'] = $path;
        }

        $canteen->update($data);
        
        return response()->json([
            'message' => 'Kantin berhasil diupdate', 
            'canteen' => new CanteenResource($canteen)
        ]);
    }

    public function balanceLedgers(Request $request)
    {
        $canteen = $this->getActiveCanteen($request);
        if (!$canteen) {
            return response()->json(['message' => 'Kantin tidak ditemukan'], 404);
        }

        $ledgers = \App\Domains\Canteen\CanteenBalanceLedger::where('canteen_id', $canteen->id)
            ->with(['order:id,total_price,status,created_at'])
            ->orderBy('created_at', 'desc')
            ->paginate(20);

        return response()->json([
            'canteen_name' => $canteen->name,
            'current_balance' => (float)$canteen->balance,
            'ledgers' => $ledgers
        ]);
    }
}
