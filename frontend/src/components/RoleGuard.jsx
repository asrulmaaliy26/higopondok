import React, { useEffect } from 'react';
import { Navigate } from '@tanstack/react-router';
import { useAuthStore } from '../store/authStore';
import { hasRole, getUserRole, ROLES } from '../config/roles';
import toast from 'react-hot-toast';

export default function RoleGuard({ allowedRoles, children }) {
  const user = useAuthStore((state) => state.user);
  const originalAdmin = useAuthStore((state) => state.originalAdmin);
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = getUserRole(user) || 'user';
  const originalAdminRole = originalAdmin ? getUserRole(originalAdmin) : null;

  // Super Admin (baik akun langsung maupun saat memegang akun penyamaran) memiliki HAK BYPASS PENUH ke seluruh laman
  const isSuperAdmin = userRole === ROLES.SUPER_ADMIN || originalAdminRole === ROLES.SUPER_ADMIN;
  if (isSuperAdmin) {
    return children;
  }

  // Untuk akun lain, sesuaikan strictly dengan hak akses perannya
  const isAllowed = hasRole(userRole, allowedRoles);

  useEffect(() => {
    if (!isAllowed) {
      toast.error('Anda tidak memiliki izin membuka laman ini. Dialihkan ke dashboard akun Anda.', {
        id: 'unauthorized-role-redirect',
        duration: 3500,
      });
    }
  }, [isAllowed]);

  if (!isAllowed) {
    // Jika bukan miliknya, alihkan langsung ke dashboard akun aslinya
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

