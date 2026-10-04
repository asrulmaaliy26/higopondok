import React from 'react';
import { Navigate } from '@tanstack/react-router';
import { useAuthStore } from '../store/authStore';
import { hasRole, getUserRole } from '../config/roles';

export default function RoleGuard({ allowedRoles, children }) {
  const user = useAuthStore((state) => state.user);
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  const userRole = getUserRole(user) || 'user';
  
  if (!hasRole(userRole, allowedRoles)) {
    // If the user doesn't have the required role, redirect to their default dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
