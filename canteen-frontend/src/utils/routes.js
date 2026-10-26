/**
 * Route resolution utilities
 */

export const getDefaultRoute = (role) => {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'staff_admin':
      return '/staff-admin/dashboard';
    case 'staff':
      return '/staff/orders';
    case 'employee':
      return '/employee/menu';
    case 'guest':
      return '/guest/menu';
    default:
      return '/login';
  }
};
