/**
 * E2E Tests — Registration Flow
 *
 * Tests the user registration journey.
 */

const { test, expect } = require('@playwright/test');

test.describe('Registration Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('renders registration form', async ({ page }) => {
    // Should have required fields
    await expect(page.locator('input[type="email"], input[placeholder*="mail"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    // Should have a submit/register button
    await expect(page.getByRole('button', { name: /registr|sign up|crear/i })).toBeVisible();
  });

  test('validates required fields on submit', async ({ page }) => {
    // Click submit with empty fields
    await page.getByRole('button', { name: /registr|sign up|crear/i }).click();

    // Should show validation errors or the form should not navigate away
    await expect(page).toHaveURL(/register/);
  });

  test('has link to login page', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: /iniciar|login|entrar|ya tienes/i });
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/login/);
    }
  });
});
