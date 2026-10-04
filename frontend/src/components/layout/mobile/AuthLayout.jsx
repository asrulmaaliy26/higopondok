import React from 'react';
import { Link } from '@tanstack/react-router';

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="flex min-h-screen w-full bg-slate-50 dark:bg-gray-950">
      {/* Left Pane - Form */}
      <div className="flex w-full flex-col justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-md animate-fade-in-up">
          <div className="mb-10 text-center lg:text-left">
            <Link to="/" className="inline-flex items-center gap-3">
              <img src="/logo-transparent.png" alt="HiGO" className="h-12 w-12 object-contain" />
              <div>
                <span className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
                  Hi<span className="text-green-600">GO</span>
                </span>
                <span className="block text-xs font-semibold text-gray-500 uppercase tracking-widest">Higo Pondok</span>
              </div>
            </Link>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              {title}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {subtitle}
            </p>
          </div>
          {children}
        </div>
      </div>

      {/* Right Pane - Visual */}
      <div className="relative hidden w-0 flex-1 lg:block bg-green-600 overflow-hidden">
        {/* Dynamic Abstract Background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-600 via-green-800 to-emerald-900 mix-blend-multiply" />
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-green-400/20 blur-3xl animate-float" />
        <div className="absolute bottom-10 left-10 w-72 h-72 rounded-full bg-emerald-500/20 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="glass-card max-w-lg rounded-2xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-4">Sistem Manajemen Pesantren Modern</h3>
            <p className="text-green-100 mb-6 leading-relaxed">
              Platform terpadu untuk mengelola seluruh aktivitas pondok pesantren. Dari administrasi santri, pembayaran, hingga sistem kantin dan transportasi yang terintegrasi secara cerdas.
            </p>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold">Aman & Terpercaya</p>
                <p className="text-sm text-green-200">Data tersimpan dengan enkripsi</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
