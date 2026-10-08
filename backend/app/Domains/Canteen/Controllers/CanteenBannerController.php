<?php

namespace App\Domains\Canteen\Controllers;

use App\Http\Controllers\Controller;
use App\Domains\Canteen\CanteenBanner;
use App\Domains\Canteen\Canteen;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CanteenBannerController extends Controller
{
    // Publik / User (hanya banner yang aktif)
    public function index()
    {
        $banners = \Illuminate\Support\Facades\Cache::remember('banners_active', 300, function () {
            return CanteenBanner::with('canteen:id,name')
                ->where('status', 'active')
                ->latest()
                ->get();
        });
            
        return response()->json($banners);
    }

    // Kantin & Admin: Upload banner baru
    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:100',
            'image' => 'required|image|mimes:jpeg,png,jpg,webp|max:3072'
        ]);

        $user = $request->user();
        $isAdmin = $user && ($user->hasRole('admin') || $user->hasRole('super_admin') || $user->role === 'admin' || $user->role === 'super_admin');
        $canteenId = $request->input('canteen_id') ?? $request->query('canteen_id');

        $canteen = null;
        if ($isAdmin) {
            if ($canteenId) {
                $canteen = Canteen::with('user')->find($canteenId);
            }
        } else {
            if ($canteenId) {
                $canteen = $user->canteens()->where('id', $canteenId)->first();
            } else {
                $canteen = $user->canteens()->first();
            }
        }
        
        if (!$canteen) {
            return response()->json(['message' => 'Toko tidak ditemukan'], 404);
        }

        $targetUser = $canteen->user ?? $user;
        $imagePath = $this->storeOptimizedImage($request->file('image'), $targetUser, 'banners');

        $banner = $canteen->banners()->create([
            'title' => $request->title,
            'image_path' => '/storage/' . $imagePath,
            'status' => 'active'
        ]);

        return response()->json(['message' => 'Banner berhasil ditambahkan', 'banner' => $banner]);
    }

    // Kantin & Admin: Toggle status banner
    public function toggleStatus(Request $request, $id)
    {
        $user = $request->user();
        $isAdmin = $user && ($user->hasRole('admin') || $user->hasRole('super_admin') || $user->role === 'admin' || $user->role === 'super_admin');

        if ($isAdmin) {
            $banner = CanteenBanner::findOrFail($id);
        } else {
            $canteenId = $request->input('canteen_id') ?? $request->query('canteen_id');
            $canteen = $canteenId ? $user->canteens()->where('id', $canteenId)->first() : $user->canteens()->first();
            if (!$canteen) return response()->json(['message' => 'Toko tidak ditemukan'], 404);

            $banner = $canteen->banners()->findOrFail($id);
        }

        $banner->update(['status' => $banner->status === 'active' ? 'inactive' : 'active']);
        
        return response()->json(['message' => 'Status banner berhasil diubah', 'banner' => $banner]);
    }

    // Kantin & Admin: Hapus banner
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $isAdmin = $user && ($user->hasRole('admin') || $user->hasRole('super_admin') || $user->role === 'admin' || $user->role === 'super_admin');

        if ($isAdmin) {
            $banner = CanteenBanner::findOrFail($id);
        } else {
            $canteenId = $request->input('canteen_id') ?? $request->query('canteen_id');
            $canteen = $canteenId ? $user->canteens()->where('id', $canteenId)->first() : $user->canteens()->first();
            if (!$canteen) return response()->json(['message' => 'Toko tidak ditemukan'], 404);

            $banner = $canteen->banners()->findOrFail($id);
        }

        $banner->delete(); // File handling is executed in Model boot deleting event

        return response()->json(['message' => 'Banner berhasil dihapus']);
    }
}
