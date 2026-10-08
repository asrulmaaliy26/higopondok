export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
  KANTIN: 'kantin',
  KURIR: 'kurir',
};

export const getUserRole = (user) => {
  if (!user) return null;

  // 1. Direct role property as string
  if (typeof user.role === 'string' && user.role.trim() !== '') {
    return user.role.trim().toLowerCase();
  }

  // 2. Roles array (handle both string array ['kurir'] and object array [{ name: 'kurir' }])
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    const firstRole = user.roles[0];
    if (typeof firstRole === 'string' && firstRole.trim() !== '') {
      return firstRole.trim().toLowerCase();
    }
    if (firstRole && typeof firstRole.name === 'string' && firstRole.name.trim() !== '') {
      return firstRole.name.trim().toLowerCase();
    }
  }

  // 3. Fallback based on specific user associations
  if (user.assigned_canteens?.length > 0 || user.assignedCanteens?.length > 0) {
    return ROLES.KURIR;
  }
  if (user.canteens?.length > 0) {
    return ROLES.KANTIN;
  }

  return ROLES.USER;
};

/**
 * Mendapatkan label tampilan yang ramah pengguna untuk setiap role
 * @param {string} role - Role string dari sistem
 * @returns {string} Label ramah pengguna
 */
export const getRoleLabel = (role) => {
  const labels = {
    [ROLES.SUPER_ADMIN]: 'Super Admin',
    [ROLES.ADMIN]: 'Admin (Pengelola Kantin)',
    [ROLES.USER]: 'Santri / Wali',
    [ROLES.KANTIN]: 'Pemilik Toko',
    [ROLES.KURIR]: 'Kurir',
  };
  return labels[role] || role || 'Pengguna';
};

/**
 * Mendapatkan warna badge untuk setiap role
 * @param {string} role - Role string
 * @returns {string} Tailwind class string
 */
export const getRoleBadgeClass = (role) => {
  const classes = {
    [ROLES.SUPER_ADMIN]: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    [ROLES.ADMIN]: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    [ROLES.USER]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    [ROLES.KANTIN]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    [ROLES.KURIR]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };
  return classes[role] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
};

/**
 * Helper function to check if a user has at least one of the required roles
 * @param {string} userRole - Current user's role
 * @param {string|string[]} allowedRoles - Role or array of roles allowed
 * @returns {boolean}
 */
export const hasRole = (userRole, allowedRoles) => {
  if (!userRole) return false;
  if (Array.isArray(allowedRoles)) {
    return allowedRoles.includes(userRole);
  }
  return userRole === allowedRoles;
};

/**
 * Check if user has admin-level access (admin or super_admin)
 * @param {string} userRole
 * @returns {boolean}
 */
export const isAdminLevel = (userRole) => {
  return userRole === ROLES.ADMIN || userRole === ROLES.SUPER_ADMIN;
};
