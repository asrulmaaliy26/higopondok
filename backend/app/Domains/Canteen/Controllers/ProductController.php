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
        if ($canteenId) {
            return $request->user()->canteens()->where('id', $canteenId)->firstOrFail();
        }
        return $request->user()->canteens()->firstOrFail();
    }

    public function index(Request $request)
    {
        $canteen = $this->getActiveCanteen($request);
        $products = $canteen->products()->latest()->paginate(10);
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

