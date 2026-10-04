import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/axios';
import { useNavigate, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Eye, EyeOff } from 'lucide-react';

import AuthLayout from '../../components/layout/mobile/AuthLayout';

export default function Register() {
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
        title="Daftar User" 
        subtitle="Buat akun untuk mengakses berbagai layanan pondok pesantren."
      >
        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          {error && (
            <div className="rounded-md bg-red-50 p-4 border border-red-100">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="Nama lengkap Anda" />
            </div>
            <div>
              <Label htmlFor="email">Alamat Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" placeholder="nama@email.com" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
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
              <Label htmlFor="password_confirmation">Konfirmasi Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password_confirmation"
                  type={showPasswordConfirmation ? 'text' : 'password'}
                  required
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
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
          </div>

          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-6" disabled={loading}>
            {loading ? 'Memproses...' : 'Daftar Sekarang'}
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Atau daftar langsung dengan</span>
            </div>
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap
              theme="outline"
              size="large"
              width="100%"
              text="signup_with"
            />
          </div>

          <div className="text-center text-sm text-gray-600 mt-6 space-y-2">
             <div>
               Ingin mendaftar sebagai kantin? <Link to="/register-canteen" className="font-semibold text-green-600 hover:text-green-500">Daftar Kantin</Link>
             </div>
             <div>
               Ingin menjadi driver? <Link to="/register-driver" className="font-semibold text-green-600 hover:text-green-500">Daftar Driver</Link>
             </div>
             <div className="pt-4 border-t border-gray-200 mt-4">
               Sudah punya akun? <Link to="/login" className="font-semibold text-green-600 hover:text-green-500">Masuk di sini</Link>
             </div>
          </div>
        </form>
      </AuthLayout>
    </GoogleOAuthProvider>
  );
}
