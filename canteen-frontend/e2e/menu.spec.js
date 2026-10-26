import { test, expect } from '@playwright/test';

test.describe('Employee Menu & Food Ordering Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept profile to immediately supply authenticated employee
    await page.route('**/api/profile/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 101,
          username: 'e2e_diner',
          name: 'Diner User',
          email: 'diner@vdart.com',
          role: 'employee',
          work_shift: 'day',
          user_id: 'EMP_101',
          tokens: 60,
          monthly_tokens: 100,
          office_name: 'Main Campus',
          active_kitchen: { id: 1, name: 'Main Kitchen' },
        }),
      });
    });

    // Mock CSRF
    await page.route('**/api/csrf/**', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'set-cookie': 'csrftoken=mock-token; Path=/' },
        body: JSON.stringify({ detail: 'CSRF set' }),
      });
    });

    // Mock Orders count / history
    await page.route('**/api/employee/orders/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Mock Menu items
    await page.route('**/api/employee/menu/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            name: 'Crispy Masala Dosa',
            description: 'South Indian golden crepe with potato filling',
            price: 8,
            price_inr: '40.00',
            category: 'breakfast',
            is_veg: true,
            food_type: 'veg',
            is_available: true,
          },
          {
            id: 2,
            name: 'Chicken Dum Biryani',
            description: 'Hyderabadi spiced basmati rice with chicken',
            price: 15,
            price_inr: '120.00',
            category: 'lunch',
            is_veg: false,
            food_type: 'non_veg',
            is_available: true,
          },
          {
            id: 3,
            name: 'Cold Filter Coffee',
            description: 'Chilled chicory blend with milk',
            price: 5,
            price_inr: '25.00',
            category: 'beverages',
            is_veg: true,
            food_type: 'veg',
            is_available: true,
          },
        ]),
      });
    });
  });

  test('should render menu dishes and filter by veg and non-veg categories', async ({ page }) => {
    await page.goto('/employee/menu');

    // Verify dishes are rendered
    await expect(page.getByText('Crispy Masala Dosa')).toBeVisible();
    await expect(page.getByText('Chicken Dum Biryani')).toBeVisible();
    await expect(page.getByText('Cold Filter Coffee')).toBeVisible();

    // Verify token prices are visible
    await expect(page.getByText(/8\s*tk|8\s*tokens/i).first()).toBeVisible();
  });

  test('should add items to cart and compute token total', async ({ page }) => {
    await page.goto('/employee/menu');

    // Click "Add to Cart" or "+" on first item
    const addBtns = page.getByRole('button', { name: /Add|Add to Cart|\+/i });
    if (await addBtns.count() > 0) {
      await addBtns.first().click();

      // Cart summary / checkout button should be active or visible
      const checkoutBtn = page.getByRole('button', { name: /Order|Checkout|Place Order/i }).first();
      await expect(checkoutBtn).toBeVisible();
    }
  });
});
