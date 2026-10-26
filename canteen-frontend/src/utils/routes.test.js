import { describe, it, expect } from 'vitest';
import { getDefaultRoute } from './routes';

describe('getDefaultRoute', () => {
  it.each([
    ['admin', '/admin/dashboard'],
    ['staff_admin', '/staff-admin/dashboard'],
    ['staff', '/staff/orders'],
    ['employee', '/employee/menu'],
    ['guest', '/guest/menu'],
    ['unknown_role', '/login'],
    [null, '/login'],
    [undefined, '/login'],
  ])('maps role "%s" to default route "%s"', (role, expectedRoute) => {
    expect(getDefaultRoute(role)).toBe(expectedRoute);
  });
});
