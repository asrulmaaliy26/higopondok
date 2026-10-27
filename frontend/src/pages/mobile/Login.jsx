import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/axios';
import { useNavigate, Link, Navigate, useSearch } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Eye, EyeOff, LayoutDashboard, Zap, ShieldCheck, CheckCircle2 } from 'lucide-react';

import AuthLayout from '../../components/layout/mobile/AuthLayout';

export default function Login() {
  const token = useAuthStore((state) => state.token);
  const search = useSearch({ strict: false });
  const redirectTarget = search?.redirect || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  if (token) {
    return <Navigate to={redirectTarget} replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/login', { 
        email: email.trim(), 
        password: password.trim() 
      });
      setAuth(response.data.user, response.data.access_token);
      navigate({ to: redirectTarget });
    } catch (err) {
      setError(err.response?.data?.message || 'Login gagal. Periksa kembali kredensial Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/google', {
        id_token: credentialResponse.credential
      });
      setAuth(response.data.user, response.data.access_token);
      navigate({ to: redirectTarget });
    } catch (err) {
      setError(err.response?.data?.message || 'Login Google gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Login Google dibatalkan atau gagal.');
  };

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'client-id-here'}>
      <AuthLayout 
        title="Masuk ke Akun Anda" 
        subtitle="Pilih metode masuk untuk menikmati kemudahan layanan pondok pesantren."
      >
        <div className="mt-6 space-y-6">
          {error && (
            <div className="rounded-none bg-red-50 dark:bg-red-950/40 p-3.5 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* ========================================== */}
          {/* 1. HERO UTAMA: GOOGLE ONE-CLICK LOGIN (PRIORITAS TINGGI) */}
          {/* ========================================== */}
          <div className="bg-gradient-to-br from-green-50/95 via-emerald-50/50 to-white dark:from-green-950/40 dark:via-gray-900 dark:to-gray-900 border-2 border-green-600 dark:border-green-500 p-4 sm:p-5 rounded-none shadow-sm relative overflow-hidden">
            {/* Header Rekomendasi */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider bg-green-600 text-white rounded-none shadow-2xs">
                <Zap className="w-3 h-3 fill-current" />
                Paling Cepat & Praktis
              </span>
              <span className="text-[11px] font-semibold text-green-700 dark:text-green-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Resmi & Aman
              </span>
            </div>

            <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
              Masuk 1-Klik dengan Akun Google
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 mb-4 leading-relaxed">
              Langsung masuk otomatis ke aplikasi tanpa repot mengetik atau menghafal password.
            </p>

            {/* Container Tombol Google */}
            <div className="flex justify-center w-full min-h-[44px]">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap
                theme="outline"
                size="large"
                shape="rectangular"
                width="100%"
                text="signin_with"
                logo_alignment="center"
              />
            </div>

            {/* Poin Keunggulan Singkat */}
            <div className="mt-3.5 pt-3 border-t border-green-200/80 dark:border-green-900/60 grid grid-cols-2 gap-2 text-[11px] text-gray-700 dark:text-gray-300 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                <span>Instan 1 Detik</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                <span>Bebas Lupa Password</span>
              </div>
            </div>
          </div>

          {/* Pemisah Garis Tengah */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-slate-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                Atau Gunakan Email / No. HP
              </span>
            </div>
          </div>

          {/* ========================================== */}
          {/* 2. FORM MANUAL (OPSI ALTERNATIF) */}
          {/* ========================================== */}
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <Label htmlFor="email" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Alamat Email / No. HP / Username
              </Label>
              <Input
                id="email"
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com atau nomor HP"
                className="mt-1 rounded-none text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Password
                </Label>
                <a href="#" className="text-xs font-medium text-green-600 hover:text-green-500">
                  Lupa password?
                </a>
              </div>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10 rounded-none text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none transition-colors"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-none font-bold text-xs shadow-xs" disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk dengan Email / No. HP'}
            </Button>
          </form>

          {/* Footer Navigasi */}
          <div className="text-center text-xs text-gray-600 dark:text-gray-400 mt-6 space-y-3">
             <p>
               Belum punya akun?{' '}
               <Link to="/register" className="font-bold text-green-600 hover:text-green-500 underline underline-offset-2">
                 Daftar sekarang
               </Link>
             </p>

             <div className="pt-1">
               <Link 
                 to="/dashboard"
                 className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-green-600 dark:hover:text-green-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-xs transition-colors"
               >
                 <LayoutDashboard className="w-4 h-4 text-green-600" />
                 <span>Kembali ke Dashboard</span>
               </Link>
             </div>

             <p className="pt-1">
               <Link to="/buku-panduan" className="font-medium text-gray-500 hover:text-green-600 flex items-center justify-center gap-1 text-xs">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-open"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                 Baca Dokumentasi Aplikasi
               </Link>
             </p>
          </div>
        </div>
      </AuthLayout>
    </GoogleOAuthProvider>
  );
}
