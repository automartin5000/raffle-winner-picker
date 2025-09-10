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
    
    // When not authenticated, should show sign-in screen with app logo
    await expect(page.locator('.app-logo')).toBeVisible();
    await expect(page.getByText(/create fair, transparent raffles/i)).toBeVisible();
  });

  test('should have working sign-in button (redirects to auth)', async ({ page }) => {
    await page.goto(DEPLOYED_APP_URL);
    await page.waitForLoadState('networkidle');
    
    const signInButton = page.getByRole('button', { name: /sign in to continue/i });
    await expect(signInButton).toBeVisible();
    
    // Test that the sign-in button triggers auth redirect flow
    let auth0UrlDetected = false;
    let redirectedToAuth0 = false;
    
    // Set up a promise to wait for the redirect to Auth0
    const redirectPromise = page.waitForURL(url => {
      const urlString = typeof url === 'string' ? url : url.toString();
      let isAuth0Domain = false;
      try {
        const parsedUrl = new URL(urlString);
        // Check if hostname ends with auth0.com (proper domain validation)
        isAuth0Domain = parsedUrl.hostname.endsWith('.auth0.com') || parsedUrl.hostname === 'auth0.com';
      } catch {
        // If URL parsing fails, it's definitely not a valid Auth0 URL
        isAuth0Domain = false;
      }
      
      if (isAuth0Domain) {
        auth0UrlDetected = true;
        redirectedToAuth0 = true;
        console.log('✅ Page successfully redirected to Auth0:', urlString);
        
        // Validate that the audience URL is properly formed
        const url = new URL(urlString);
        const audienceParam = url.searchParams.get('audience');
        if (audienceParam && audienceParam.includes('undefined')) {
          throw new Error(`❌ Auth0 audience URL is malformed: ${audienceParam}`);
        }
      }
      return isAuth0Domain;
    }, { timeout: 10000 });
    
    // Click the sign-in button and wait for redirect
    await signInButton.click();
    
    try {
      await redirectPromise;
    } catch (error) {
      // Check current URL even if waitForURL times out
      const currentUrl = page.url();
      console.log('Current URL after timeout/error:', currentUrl);
      
      let isAuth0Domain = false;
      try {
        const parsedUrl = new URL(currentUrl);
        // Check if hostname ends with auth0.com (proper domain validation)
        isAuth0Domain = parsedUrl.hostname.endsWith('.auth0.com') || parsedUrl.hostname === 'auth0.com';
      } catch {
        // If URL parsing fails, it's definitely not a valid Auth0 URL
        isAuth0Domain = false;
      }
      
      if (isAuth0Domain) {
        auth0UrlDetected = true;
        redirectedToAuth0 = true;
        console.log('✅ Page did redirect to Auth0 (detected in current URL)');
        
        // Validate that the audience URL is properly formed
        try {
          const url = new URL(currentUrl);
          const audienceParam = url.searchParams.get('audience');
          if (audienceParam && audienceParam.includes('undefined')) {
            throw new Error(`❌ Auth0 audience URL is malformed: ${audienceParam}`);
          }
        } catch (validationError) {
          console.log('❌ Audience validation failed:', validationError.message);
          throw validationError;
        }
      } else {
        console.log('❌ Page did not redirect to Auth0. Error:', error.message);
      }
    }
    
    // Verify that the page redirected to Auth0 (indicating proper auth configuration)
    expect(redirectedToAuth0).toBe(true);
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