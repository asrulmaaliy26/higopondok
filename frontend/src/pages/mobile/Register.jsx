import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/axios';
import { useNavigate, Link, Navigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Eye, EyeOff, LayoutDashboard, Zap, ShieldCheck, CheckCircle2 } from 'lucide-react';

import AuthLayout from '../../components/layout/mobile/AuthLayout';

export default function Register() {
  const token = useAuthStore((state) => state.token);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/register', { 
          name, email, password, password_confirmation: passwordConfirmation 
      });
      setAuth(response.data.user, response.data.access_token);
      navigate({ to: '/dashboard' });
    } catch (err) {
      setError(err.response?.data?.message || 'Registrasi gagal.');
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
      navigate({ to: '/dashboard' });
    } catch (err) {
      setError(err.response?.data?.message || 'Login/Daftar Google gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Login/Daftar Google dibatalkan atau gagal.');
  };

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'client-id-here'}>
      <AuthLayout 
        title="Daftar Akun Baru" 
        subtitle="Pilih metode pendaftaran untuk mengakses seluruh fasilitas & layanan pondok."
      >
        <div className="mt-6 space-y-6">
          {error && (
            <div className="rounded-none bg-red-50 dark:bg-red-950/40 p-3.5 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* ========================================== */}
          {/* 1. HERO UTAMA: GOOGLE ONE-CLICK REGISTER (PRIORITAS TINGGI) */}
          {/* ========================================== */}
          <div className="bg-gradient-to-br from-green-50/95 via-emerald-50/50 to-white dark:from-green-950/40 dark:via-gray-900 dark:to-gray-900 border-2 border-green-600 dark:border-green-500 p-4 sm:p-5 rounded-none shadow-sm relative overflow-hidden">
            {/* Header Rekomendasi */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider bg-green-600 text-white rounded-none shadow-2xs">
                <Zap className="w-3 h-3 fill-current" />
                Paling Praktis & Cepat
              </span>
              <span className="text-[11px] font-semibold text-green-700 dark:text-green-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Terverifikasi Google
              </span>
            </div>

            <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug">
              Daftar 1-Klik dengan Akun Google
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 mb-4 leading-relaxed">
              Nama dan email Anda langsung terverifikasi resmi tanpa perlu mengisi formulir panjang.
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
                text="signup_with"
                logo_alignment="center"
              />
            </div>

            {/* Poin Keunggulan Singkat */}
            <div className="mt-3.5 pt-3 border-t border-green-200/80 dark:border-green-900/60 grid grid-cols-2 gap-2 text-[11px] text-gray-700 dark:text-gray-300 font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                <span>Langsung Terverifikasi</span>
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
                Atau Daftar Manual dengan Formulir
              </span>
            </div>
          </div>

          {/* ========================================== */}
          {/* 2. FORM MANUAL (OPSI ALTERNATIF) */}
          {/* ========================================== */}
          <form className="space-y-3.5" onSubmit={handleRegister}>
            <div>
              <Label htmlFor="name" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Nama Lengkap
              </Label>
              <Input 
                id="name" 
                required 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="mt-1 rounded-none text-xs" 
                placeholder="Nama lengkap Anda" 
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Alamat Email
              </Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="mt-1 rounded-none text-xs" 
                placeholder="nama@email.com" 
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Password
              </Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
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
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="password_confirmation" className="text-xs font-bold text-gray-700 dark:text-gray-300">
                Konfirmasi Password
              </Label>
              <div className="relative mt-1">
                <Input
                  id="password_confirmation"
                  type={showPasswordConfirmation ? 'text' : 'password'}
                  required
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10 rounded-none text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirmation((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none transition-colors"
                  aria-label={showPasswordConfirmation ? 'Sembunyikan konfirmasi password' : 'Lihat konfirmasi password'}
                >
                  {showPasswordConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-none font-bold text-xs shadow-xs" disabled={loading}>
              {loading ? 'Memproses...' : 'Daftar dengan Formulir'}
            </Button>
          </form>

          {/* Opsi Mitra & Navigasi */}
          <div className="text-center text-xs text-gray-600 dark:text-gray-400 mt-6 space-y-2.5">
             <div className="flex items-center justify-center gap-3 pt-1">
               <Link to="/register-canteen" className="font-semibold text-green-600 hover:text-green-500 hover:underline">
                 Daftar Mitra Kantin
               </Link>
               <span className="text-gray-300 dark:text-gray-700">•</span>
               <Link to="/register-driver" className="font-semibold text-green-600 hover:text-green-500 hover:underline">
                 Daftar Kurir
               </Link>
             </div>

             <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
               Sudah punya akun?{' '}
               <Link to="/login" className="font-bold text-green-600 hover:text-green-500 underline underline-offset-2">
                 Masuk di sini
               </Link>
             </div>

             <div className="pt-1">
               <Link 
                 to="/dashboard"
                 className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold text-gray-700 dark:text-gray-200 hover:text-green-600 dark:hover:text-green-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-xs transition-colors"
               >
                 <LayoutDashboard className="w-4 h-4 text-green-600" />
                 <span>Kembali ke Dashboard</span>
               </Link>
             </div>
          </div>
        </div>
      </AuthLayout>
    </GoogleOAuthProvider>
  );
}
