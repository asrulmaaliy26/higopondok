<?php

namespace App\Domains\Auth\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Delivery\Driver;

class RegisterController extends Controller
{
    public function registerUser(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        $user->assignRole('user');
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user->load('roles'),
        ]);
    }

    public function registerCanteen(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'canteen_name' => 'required|string|max:255',
            'canteen_description' => 'nullable|string',
        ]);

        return DB::transaction(function () use ($request) {
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
            ]);

            $user->assignRole('kantin');
            $user->assignRole('kurir');

            $canteen = Canteen::create([
                'user_id' => $user->id,
                'name' => $request->canteen_name,
                'description' => $request->canteen_description,
                'status' => 'pending',
            ]);

            return response()->json([
                'message' => 'Pendaftaran kantin berhasil. Menunggu persetujuan admin.',
                'user' => $user->load('roles'),
                'canteen' => $canteen
            ]);
        });
    }

    public function registerDriver(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'vehicle_info' => 'required|string',
        ]);

        return DB::transaction(function () use ($request) {
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
            ]);

            $user->assignRole('kurir');

            $driver = Driver::create([
                'user_id' => $user->id,
                'vehicle_info' => $request->vehicle_info,
                'status' => 'pending',
            ]);

            return response()->json([
                'message' => 'Pendaftaran kurir berhasil. Menunggu persetujuan admin.',
                'user' => $user->load('roles'),
                'driver' => $driver
            ]);
        });
    }
}
