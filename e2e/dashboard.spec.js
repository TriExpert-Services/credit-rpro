/**
 * E2E Tests — Dashboard Smoke
 *
 * Verifies that authenticated users can reach the dashboard.
 * Uses a storage state approach for pre-authenticated state.
 *
 * Note: These tests require a running backend + frontend with a seeded test user.
 * In CI, use the webServer config in playwright.config.js and a seed script.
 */

const { test, expect } = require('@playwright/test');

test.describe('Dashboard (authenticated)', () => {
  // Helper: log in via the UI and store token
  async function loginAs(page, email, password) {
    await page.goto('/login');
    await page.fill('input[type="email"], input[placeholder*="mail"], input[placeholder*="Email"]', email);
    await page.fill('input[type="password"]', password);
    await page.getByRole('button', { name: /iniciar|login|entrar|sign in/i }).click();
    // Wait for navigation to dashboard
    await page.waitForURL(/dashboard/, { timeout: 15000 });
  }

  test('client can view their dashboard after login', async ({ page }) => {
    // This test requires a real user in the database.
    // Skip in environments without seeded data.
    test.skip(!process.env.E2E_TEST_EMAIL, 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars');

    await loginAs(page, process.env.E2E_TEST_EMAIL, process.env.E2E_TEST_PASSWORD);

    // Dashboard should have the user's name or dashboard-specific content
    await expect(page.locator('text=/dashboard|panel|inicio/i')).toBeVisible({ timeout: 10000 });
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Clear any stored auth
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });
});
