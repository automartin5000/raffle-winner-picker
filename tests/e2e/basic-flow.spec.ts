import { test, expect } from '@playwright/test';

const DEPLOYED_APP_URL = process.env.BASE_URL || 'https://local.dev.rafflewinnerpicker.com';

test.describe('Basic Application Flow Tests', () => {
  test('should load the application and display sign-in screen', async ({ page }) => {
    await page.goto(DEPLOYED_APP_URL);
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveTitle(/Raffle Winner Picker/i);
    
    await expect(page.getByRole('heading', { name: /raffle winner picker/i })).toBeVisible();
    
    await expect(page.getByText(/create fair, transparent raffles/i)).toBeVisible();
    
    await expect(page.getByRole('button', { name: /sign in to continue/i })).toBeVisible();
  });

  test('should have responsive design on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(DEPLOYED_APP_URL);
    await page.waitForLoadState('networkidle');
    
    await expect(page.getByRole('heading', { name: /raffle winner picker/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in to continue/i })).toBeVisible();
  });

  test('should display app information correctly', async ({ page }) => {
    await page.goto(DEPLOYED_APP_URL);
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('.app-logo')).toBeVisible();
    await expect(page.getByText(/Fair & Transparent Drawings/i)).toBeVisible();
  });

  test('should have working sign-in button (redirects to auth)', async ({ page }) => {
    await page.goto(DEPLOYED_APP_URL);
    await page.waitForLoadState('networkidle');
    
    const signInButton = page.getByRole('button', { name: /sign in to continue/i });
    await expect(signInButton).toBeVisible();
    
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      signInButton.click()
    ]);
    
    await newPage.waitForLoadState();
    
    expect(newPage.url()).toContain('auth0.com');
    
    await newPage.close();
  });

  test('should have proper meta tags and SEO', async ({ page }) => {
    await page.goto(DEPLOYED_APP_URL);
    
    const title = await page.title();
    expect(title).toContain('Raffle Winner Picker');
    
    const metaDescription = await page.locator('meta[name="description"]').getAttribute('content');
    if (metaDescription) {
      expect(metaDescription.length).toBeGreaterThan(0);
    }
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (exception) => {
      errors.push(exception.toString());
    });
    
    await page.goto(DEPLOYED_APP_URL);
    await page.waitForLoadState('networkidle');
    
    expect(errors).toEqual([]);
  });

  test('should have proper security headers', async ({ page }) => {
    const response = await page.goto(DEPLOYED_APP_URL);
    expect(response).toBeTruthy();
    
    const headers = response!.headers();
    
    expect(headers['x-frame-options'] || headers['x-content-type-options']).toBeTruthy();
  });

  test('should serve static assets correctly', async ({ page }) => {
    await page.goto(DEPLOYED_APP_URL);
    
    const favicon = page.locator('link[rel="icon"]').first();
    if (await favicon.count() > 0) {
      const faviconHref = await favicon.getAttribute('href');
      expect(faviconHref).toBeTruthy();
    }
  });
});