<?php

namespace App\Domains\Canteen\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Requests\StoreProductRequest;
use App\Domains\Canteen\Requests\UpdateProductRequest;
use App\Domains\Canteen\Resources\ProductResource;

class ProductController extends Controller
{

    private function getActiveCanteen(Request $request)
    {
        $canteenId = $request->query('canteen_id') ?? $request->input('canteen_id');
        $user = $request->user();

        if ($user && ($user->hasRole('admin') || $user->hasRole('super_admin'))) {
            if ($canteenId) {
                return Canteen::where('id', $canteenId)->firstOrFail();
            }
            return Canteen::firstOrFail();
        }

        if ($canteenId) {
            return $user->canteens()->where('id', $canteenId)->firstOrFail();
        }
        return $user->canteens()->firstOrFail();
    }

    public function index(Request $request)
    {
        $canteen = $this->getActiveCanteen($request);
        $query = $canteen->products();

        // 1. Filter Pencarian Produk
        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('category', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // 2. Filter Tab: Paling Laris vs Semua Menu
        $tab = $request->input('tab');
        $sort = $request->input('sort');
        if ($tab === 'popular' || $tab === 'paling_laris' || $sort === 'popular') {
            $query->orderBy('sold_count', 'desc')->latest();
        } else {
            $query->latest();
        }

        // 3. Opsi Open All (Tanpa Paginasi)
        $isAll = $request->boolean('all') || $request->input('per_page') === 'all';
        if ($isAll) {
            $products = $query->get();
            return ProductResource::collection($products);
        }

        // 4. Paginasi Standar
        $perPage = (int) $request->input('per_page', 10);
        if ($perPage <= 0) {
            $perPage = 10;
        }

        $products = $query->paginate($perPage);
        return ProductResource::collection($products);
    }

    public function store(StoreProductRequest $request)
    {
        $user = $request->user();
        $canteen = $this->getActiveCanteen($request);
        $validated = $request->validated();
        
        if ($request->hasFile('image')) {
            $path = $this->storeOptimizedImage($request->file('image'), $user, 'products');
            $validated['image'] = $path;
        }

        $product = $canteen->products()->create($validated);
        
        return response()->json([
            'message' => 'Produk berhasil ditambahkan', 
            'product' => new ProductResource($product)
        ], 201);
    }

    public function update(UpdateProductRequest $request, $id)
    {
        $user = $request->user();
        $canteen = $this->getActiveCanteen($request);
        $product = $canteen->products()->findOrFail($id);
        $validated = $request->validated();
        
        if ($request->hasFile('image')) {
            // Hapus gambar lama jika ada
            if ($product->image && Storage::disk('public')->exists($product->image)) {
                Storage::disk('public')->delete($product->image);
            }
            $path = $this->storeOptimizedImage($request->file('image'), $user, 'products');
            $validated['image'] = $path;
        }

        $product->update($validated);
        
        return response()->json([
            'message' => 'Produk berhasil diupdate', 
            'product' => new ProductResource($product)
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $canteen = $this->getActiveCanteen($request);
        $product = $canteen->products()->findOrFail($id);
        
        // Hapus gambar jika ada
        if ($product->image && Storage::disk('public')->exists($product->image)) {
            Storage::disk('public')->delete($product->image);
        }

        $product->delete();
        
        return response()->json(['message' => 'Produk berhasil dihapus']);
    }
}

