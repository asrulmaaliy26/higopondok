<?php

namespace App\Domains\Auth\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Domains\Auth\User;
use Illuminate\Validation\ValidationException;
use App\Domains\Auth\Requests\UpdateProfileRequest;
use Illuminate\Support\Facades\Storage;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|string',
            'password' => 'required|string',
        ]);

        $loginInput = trim($request->email);
        // \u2705 Hanya email & phone \u2014 nama tidak unik dan mudah ditebak (keamanan)
        $user = User::where('email', $loginInput)
            ->orWhere('phone', $loginInput)
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Kredensial yang diberikan tidak cocok dengan data kami.'],
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user->load('roles'),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Berhasil logout'
        ]);
    }

    public function loginWithGoogle(Request $request)
    {
        $request->validate([
            'id_token' => 'required|string',
        ]);

        try {
            $response = \Illuminate\Support\Facades\Http::get('https://oauth2.googleapis.com/tokeninfo', [
                'id_token' => $request->id_token
            ]);

            if ($response->failed()) {
                return response()->json(['message' => 'Token Google tidak valid'], 401);
            }

            $googleUser = $response->json();
            
            if (!isset($googleUser['email'])) {
                return response()->json(['message' => 'Email tidak ditemukan dari akun Google'], 401);
            }

            // \u2705 Verifikasi bahwa token dikeluarkan untuk aplikasi ini (bukan dari app Google lain)
            $googleClientId = config('services.google.client_id');
            if ($googleClientId && isset($googleUser['aud']) && $googleUser['aud'] !== $googleClientId) {
                return response()->json(['message' => 'Token Google tidak valid untuk aplikasi ini.'], 401);
            }

            // Find existing user by email or google_id
            $user = User::where('email', $googleUser['email'])
                        ->orWhere('google_id', $googleUser['sub'])
                        ->first();

            if (!$user) {
                // Create new user if not exists
                $user = User::create([
                    'name' => $googleUser['name'] ?? 'User Google',
                    'email' => $googleUser['email'],
                    'google_id' => $googleUser['sub'],
                    'password' => Hash::make(\Illuminate\Support\Str::random(24)), // Random password for google users
                    'avatar' => $googleUser['picture'] ?? null,
                ]);

                // Assign default role 'user'
                $user->assignRole('user');
            } else {
                // Update google_id and avatar if missing
                if (!$user->google_id) {
                    $user->google_id = $googleUser['sub'];
                }
                if (!$user->avatar && isset($googleUser['picture'])) {
                    $user->avatar = $googleUser['picture'];
                }
                $user->save();
            }

            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'access_token' => $token,
                'token_type' => 'Bearer',
                'user' => $user->load('roles'),
            ]);

        } catch (\Exception $e) {
            return response()->json(['message' => 'Terjadi kesalahan saat memproses login Google: ' . $e->getMessage()], 500);
        }
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => $request->user()->load('roles'),
        ]);
    }

    public function updateProfile(UpdateProfileRequest $request)
    {
        $user = $request->user();
        
        if ($request->has('name')) {
            $user->name = $request->name;
        }
        if ($request->has('email')) {
            $user->email = $request->email;
        }
        if ($request->has('phone')) {
            $user->phone = $request->phone;
        }
        
        // Field profil umum — boleh diubah sendiri oleh user
        $regularFields = ['santri_name', 'santri_room', 'santri_class', 'santri_level'];
        foreach ($regularFields as $field) {
            if ($request->has($field)) {
                $user->$field = $request->$field;
            }
        }

        // Field status Guru/Staff — HANYA ADMIN yang boleh mengubah
        $teacherFields = ['is_teacher', 'niy', 'teacher_unit'];
        foreach ($teacherFields as $field) {
            if ($request->has($field)) {
                if (!$user->hasRole('admin')) {
                    return response()->json([
                        'message' => 'Perubahan status Guru/Staff hanya dapat dilakukan oleh Admin.',
                        'error_code' => 'UNAUTHORIZED_TEACHER_UPDATE',
                    ], 403);
                }
                $user->$field = $request->$field;
            }
        }
        
        $passwordChanged = false;
        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
            $passwordChanged = true;
        }

        if ($request->hasFile('avatar')) {
            if ($user->avatar) {
                Storage::disk('public')->delete($user->avatar);
            }
            $path = $this->storeOptimizedImage($request->file('avatar'), $user, 'avatars');
            $user->avatar = $path;
        }
        
        $user->save();

        // Jika password diganti, cabut semua token lama kecuali token yang sedang aktif
        // agar sesi di device lain dipaksa login ulang dengan password baru.
        if ($passwordChanged) {
            $currentTokenId = $request->user()->currentAccessToken()->id;
            $user->tokens()->where('id', '!=', $currentTokenId)->delete();
        }

        return response()->json([
            'message' => 'Profil berhasil diperbarui',
            'user' => $user->load('roles'),
        ]);
    }

    public function toggleWorkingStatus(Request $request)
    {
        $user = $request->user();
        if (!$user->hasRole('kurir')) {
            return response()->json(['message' => 'Hanya kurir yang dapat mengubah status kerja'], 403);
        }

        $user->is_working = !$user->is_working;
        $user->save();

        return response()->json([
            'message' => 'Status kerja berhasil diubah',
            'is_working' => $user->is_working
        ]);
    }
}
