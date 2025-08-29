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
    
    // Test that the sign-in button triggers auth flow
    let popupOpened = false;
    let auth0UrlDetected = false;
    let popupNavigatedToAuth0 = false;
    
    const [popup] = await Promise.all([
      page.waitForEvent('popup').then(async (popup) => {
        popupOpened = true;
        
        try {
          // Wait for popup to navigate to Auth0 (or timeout after 10 seconds)
          await popup.waitForURL(url => {
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
              popupNavigatedToAuth0 = true;
              console.log('✅ Popup successfully navigated to Auth0:', urlString);
            }
            return isAuth0Domain;
          }, { timeout: 10000 });
        } catch (error) {
          // Check final URL even if waitForURL times out
          const finalUrl = popup.url();
          console.log('Popup final URL after timeout/error:', finalUrl);
          
          let isAuth0Domain = false;
          try {
            const parsedUrl = new URL(finalUrl);
            // Check if hostname ends with auth0.com (proper domain validation)
            isAuth0Domain = parsedUrl.hostname.endsWith('.auth0.com') || parsedUrl.hostname === 'auth0.com';
          } catch {
            // If URL parsing fails, it's definitely not a valid Auth0 URL
            isAuth0Domain = false;
          }
          
          if (isAuth0Domain) {
            auth0UrlDetected = true;
            popupNavigatedToAuth0 = true;
            console.log('✅ Popup did navigate to Auth0 (detected in final URL)');
          } else {
            console.log('❌ Popup did not navigate to Auth0. Error:', error.message);
          }
        }
        
        return popup;
      }),
      signInButton.click()
    ]);
    
    // Verify that the popup was opened (indicating auth flow was triggered)
    expect(popupOpened).toBe(true);
    
    // Verify that the popup navigated to Auth0 (indicating proper auth configuration)
    expect(popupNavigatedToAuth0).toBe(true);
    
    // Clean up if popup is still open
    if (!popup.isClosed()) {
      await popup.close();
    }
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