import { test, expect } from '@playwright/test';

test.describe('Authentication & Sign-in Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept profile check so AuthContext finishes loading immediately
    await page.route('**/api/profile/**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Unauthenticated' }),
      });
    });

    // Mock CSRF endpoint
    await page.route('**/api/csrf/**', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'set-cookie': 'csrftoken=mock-token; Path=/',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ detail: 'CSRF cookie set' }),
      });
    });
  });

  test('should display login form with accessible role locators', async ({ page }) => {
    await page.goto('/login');

    // Branding logo via accessible alt text
    await expect(page.getByAltText('VDart Cafe')).toBeVisible();

    // Input fields using role & label accessibility
    const userInput = page.getByRole('textbox', { name: /Username/i });
    await expect(userInput).toBeVisible();

    const passInput = page.locator('input[type="password"]');
    await expect(passInput).toBeVisible();

    // Sign in Button
    const signInBtn = page.getByRole('button', { name: /Sign in/i });
    await expect(signInBtn).toBeVisible();
    await expect(signInBtn).toBeEnabled();
  });

  test('should show validation or error when invalid credentials are provided', async ({ page }) => {
    // Intercept login endpoint to simulate 400 invalid credentials
    await page.route('**/api/login/**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials. Please try again.' }),
      });
    });

    await page.goto('/login');

    const userInput = page.getByRole('textbox', { name: /Username/i });
    await userInput.fill('wrong_user');

    const passInput = page.locator('input[type="password"]');
    await passInput.fill('WrongPassword123!');

    const signInBtn = page.getByRole('button', { name: /Sign in/i });
    await signInBtn.click();

    // Error alert is rendered
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('should open and interact with Password Reset Modal', async ({ page }) => {
    await page.goto('/login');

    // Click "Reset password?" button
    const resetBtn = page.getByRole('button', { name: /Reset password\?/i });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Modal headings & tabs should appear
    await expect(page.getByRole('heading', { name: /Forgot Password/i })).toBeVisible();
    
    // Tab switching between "Request Reset" and "Set New Password"
    const setPassTab = page.getByRole('button', { name: /Set New Password/i });
    await expect(setPassTab).toBeVisible();
    await setPassTab.click();

    const requestTab = page.getByRole('button', { name: /Request Reset/i });
    await expect(requestTab).toBeVisible();
    await requestTab.click();

    // Close modal
    const closeBtn = page.getByRole('button', { name: /Close modal|Cancel/i }).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('should redirect diner to employee dashboard on successful sign in', async ({ page }) => {
    await page.route('**/api/login/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 101,
          username: 'e2e_emp',
          name: 'E2E Employee',
          email: 'e2e.emp@vdart.com',
          role: 'employee',
          work_shift: 'day',
          user_id: 'EMP_E2E',
          tokens: 85,
          monthly_tokens: 100,
        }),
      });
    });

    await page.route('**/api/employee/menu/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/login');

    const userInput = page.getByRole('textbox', { name: /Username/i });
    await userInput.fill('EMP_E2E');

    const passInput = page.locator('input[type="password"]');
    await passInput.fill('ValidPass123!');

    await page.getByRole('button', { name: /Sign in/i }).click();

    // Verify navigation away from /login
    await expect(page).not.toHaveURL(/\/login$/);
  });
});
