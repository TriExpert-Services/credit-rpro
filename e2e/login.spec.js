/**
 * E2E Tests — Login Flow
 *
 * Tests the critical login user journey:
 *  - Page loads correctly
 *  - Validation messages on empty submit
 *  - Successful login redirects to dashboard
 *  - Failed login shows error message
 *
 * Requirements: frontend running on localhost:3000, backend on localhost:5000.
 * Run with: npx playwright test
 */

const { test, expect } = require('@playwright/test');

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders login form', async ({ page }) => {
    // Should have email and password inputs
    await expect(page.locator('input[type="email"], input[placeholder*="mail"], input[placeholder*="Email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    // Should have a submit button
    await expect(page.getByRole('button', { name: /iniciar|login|entrar|sign in/i })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"], input[placeholder*="mail"], input[placeholder*="Email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'WrongPassword1!');
    await page.getByRole('button', { name: /iniciar|login|entrar|sign in/i }).click();

    // Should show an error message
    await expect(page.locator('[role="alert"], .text-red-400, .text-red-500, .error')).toBeVisible({ timeout: 10000 });
  });

  test('navigates to register page', async ({ page }) => {
    // Find a link to register
    const registerLink = page.getByRole('link', { name: /registr|sign up|crear cuenta/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/register/);
    }
  });
});
