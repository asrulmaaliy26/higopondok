import React, { useState } from 'react';
import api from '../../lib/axios';
import { useNavigate, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import AuthLayout from '../../components/layout/mobile/AuthLayout';

export default function RegisterCanteen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [canteenName, setCanteenName] = useState('');
  const [canteenDesc, setCanteenDesc] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.post('/register/canteen', { 
          name, email, password, password_confirmation: passwordConfirmation,
          canteen_name: canteenName, canteen_description: canteenDesc
      });
      setSuccess('Pendaftaran berhasil! Silakan tunggu persetujuan dari Admin.');
      setTimeout(() => navigate({ to: '/login' }), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Registrasi gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Daftar Kantin" 
      subtitle="Buka toko Anda di Higo Pondok"
    >
      <form className="mt-8 space-y-6" onSubmit={handleRegister}>
        {error && (
          <div className="rounded-md bg-red-50 p-4 border border-red-100">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-md bg-green-50 p-4 border border-green-100">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">Data Pemilik</h3>
          <div>
            <Label htmlFor="name">Nama Lengkap</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
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
            <Label htmlFor="passwordConfirmation">Konfirmasi Password</Label>
            <div className="relative mt-1">
              <Input
                id="passwordConfirmation"
                type={showPasswordConfirmation ? 'text' : 'password'}
                required
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
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

          <h3 className="font-semibold text-gray-700 dark:text-gray-300 pt-4">Data Toko</h3>
          <div>
            <Label htmlFor="canteenName">Nama Kantin/Toko</Label>
            <Input id="canteenName" required value={canteenName} onChange={(e) => setCanteenName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="canteenDesc">Deskripsi Singkat</Label>
            <Input id="canteenDesc" value={canteenDesc} onChange={(e) => setCanteenDesc(e.target.value)} className="mt-1" />
          </div>
        </div>

        <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-6" disabled={loading || success}>
          {loading ? 'Memproses...' : 'Daftar Kantin'}
        </Button>

        <div className="text-center text-sm text-gray-600 mt-6 space-y-2">
           <div className="pt-4 border-t border-gray-200 mt-4">
             Sudah punya akun? <Link to="/login" className="font-semibold text-green-600 hover:text-green-500">Masuk di sini</Link>
           </div>
        </div>
      </form>
    </AuthLayout>
  );
}
