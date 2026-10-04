export const ROLES = {
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
