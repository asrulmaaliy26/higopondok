<?php

namespace App\Domains\Auth\Controllers;

use App\Http\Controllers\Controller;
use App\Domains\Auth\User;
use App\Domains\Auth\Requests\StoreUserRequest;
use App\Domains\Auth\Requests\UpdateUserRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /**
     * Get paginated users with search and role filter.
     */
    public function index(Request $request)
    {
        $query = User::with(['roles', 'assignedCanteens:id,name'])->latest();

        // Search Filter
        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('santri_name', 'like', "%{$search}%")
                  ->orWhere('santri_room', 'like', "%{$search}%")
                  ->orWhere('santri_class', 'like', "%{$search}%");
            });
        }

        // Role Filter
        if ($request->filled('role') && $request->role !== 'all') {
            $query->role($request->role);
        }

        // Paginate
        $perPage = max(5, min(100, (int) $request->input('per_page', 15)));
        $users = $query->paginate($perPage);

        // Transform collection to attach role and canteen_ids
        $users->getCollection()->transform(function ($user) {
            $user->role = $user->roles->first()?->name ?? 'user';
            $user->canteen_ids = $user->assignedCanteens ? $user->assignedCanteens->pluck('id')->toArray() : [];
            return $user;
        });

        return response()->json($users);
    }

    /**
     * Store a new user.
     */
    public function store(StoreUserRequest $request)
    {
        $data = $request->validated();
        $data['password'] = Hash::make($data['password']);
        
        $role = $data['role'] ?? 'user';
        $canteenIds = $data['canteen_ids'] ?? null;
        unset($data['role']); // Remove role from data since it's not a column
        unset($data['status']); // Remove status if present (not a column)
        unset($data['canteen_ids']);

        $user = User::create($data);
        $user->assignRole($role);

        if ($role === 'kurir' && is_array($canteenIds)) {
            $user->assignedCanteens()->sync($canteenIds);
        }

        return response()->json([
            'message' => 'User berhasil ditambahkan',
            'user' => $user->load('assignedCanteens:id,name')
        ], 201);
    }

    /**
     * Update an existing user.
     */
    public function update(UpdateUserRequest $request, $id)
    {
        $user = User::findOrFail($id);
        $data = $request->validated();

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']); // Prevent updating password if not provided
        }

        $role = $data['role'] ?? null;
        $canteenIds = array_key_exists('canteen_ids', $data) ? $data['canteen_ids'] : null;
        unset($data['role']);
        unset($data['status']);
        unset($data['canteen_ids']);

        $passwordChanged = isset($data['password']);
        $user->update($data);
        
        if ($role) {
            $user->syncRoles([$role]);
        }

        if ($user->hasRole('kurir') || $role === 'kurir') {
            if (is_array($canteenIds)) {
                $user->assignedCanteens()->sync($canteenIds);
            }
        }

        // Jika password diganti oleh admin, cabut semua token user itu
        // agar dipaksa login ulang dengan password yang baru.
        if ($passwordChanged) {
            $user->tokens()->delete();
        }

        return response()->json([
            'message' => 'User berhasil diupdate',
            'user' => $user->load('assignedCanteens:id,name')
        ]);
    }

    /**
     * Delete a user.
     */
    public function destroy($id)
    {
        $user = User::findOrFail($id);

        if ($user->id === request()->user()->id) {
            return response()->json([
                'message' => 'Tidak bisa menghapus akun Anda sendiri'
            ], 403);
        }

        $user->delete();

        return response()->json([
            'message' => 'User berhasil dihapus'
        ]);
    }
}
