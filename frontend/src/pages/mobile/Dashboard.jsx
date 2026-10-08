import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { ROLES, getUserRole } from '../../config/roles';

import AdminDashboard from '../../components/dashboard/mobile/AdminDashboard';
import UserDashboard from '../../components/dashboard/mobile/UserDashboard';
import KantinDashboard from '../../components/dashboard/mobile/KantinDashboard';
import KurirDashboard from '../../components/dashboard/mobile/KurirDashboard';

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const originalAdmin = useAuthStore((state) => state.originalAdmin);
  const role = getUserRole(user) || (originalAdmin ? ROLES.USER : ROLES.ADMIN);

  if (role === ROLES.USER) {
    return <UserDashboard user={user} />;
  }

  return (
    <div className="space-y-2 animate-fade-in-up pb-12 max-w-7xl mx-auto px-1 sm:px-2">
      {role === ROLES.SUPER_ADMIN && <AdminDashboard user={user} />}
      {(role === ROLES.ADMIN || role === ROLES.KANTIN) && <KantinDashboard user={user} />}
      {role === ROLES.KURIR && <KurirDashboard user={user} />}
    </div>
  );
}

