import { Page } from '@playwright/test';

/**
 * Auth0 Test Helper for E2E Tests
 * 
 * This helper handles authentication for e2e tests by creating a test account
 * and programmatically logging in through Auth0.
 */

export async function loginWithAuth0(page: Page, baseUrl: string) {
  // Navigate to the app
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');
  
  // Click the sign-in button
  const signInButton = page.getByRole('button', { name: /sign in to continue/i });
  await signInButton.click();
  
  // Wait for Auth0 login page to load
  await page.waitForURL(/auth0\.com/);
  await page.waitForLoadState('networkidle');
  
  // Create or use test account credentials
  const testEmail = 'e2etest@example.com';
  const testPassword = 'TestPassword123!';
  
  // Check if we need to sign up first or can sign in
  const signUpTab = page.locator('text=Sign Up');
  const signInTab = page.locator('text=Log In');
  
  // Try to sign in first
  if (await signInTab.isVisible()) {
    await signInTab.click();
  }
  
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);
  
  // Click continue/submit button
  const continueButton = page.locator('button[type="submit"]').first();
  await continueButton.click();
  
  // If sign in fails, try to sign up
  try {
    await page.waitForURL(baseUrl, { timeout: 5000 });
  } catch {
    // Sign in failed, try to sign up
    if (await signUpTab.isVisible()) {
      await signUpTab.click();
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      
      const signUpButton = page.locator('button[type="submit"]').first();
      await signUpButton.click();
      
      // Wait for redirect back to app
      await page.waitForURL(baseUrl, { timeout: 10000 });
    }
  }
  
  // Wait for the app to load after authentication
  await page.waitForLoadState('networkidle');
  
  // Verify we're authenticated by checking for user interface elements
  await page.waitForSelector('.header-modern', { timeout: 10000 });
}

/**
 * Helper to logout from the application
 */
export async function logout(page: Page) {
  const signOutButton = page.getByRole('button', { name: /sign out/i });
  if (await signOutButton.isVisible()) {
    await signOutButton.click();
  }
}