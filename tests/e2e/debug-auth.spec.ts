import { test, expect } from '@playwright/test';

const DEPLOYED_APP_URL = process.env.BASE_URL || 'https://local.dev.rafflewinnerpicker.com';

test.describe('Auth Debug Tests', () => {
  test('should debug Auth0 configuration', async ({ page, context }) => {
    // Allow popups by setting a different user agent
    await context.addInitScript(() => {
      // Override the popup blocking
      window.open = new Proxy(window.open, {
        apply: function(target, thisArg, argumentsList) {
          console.log('window.open called with:', argumentsList);
          return target.apply(thisArg, argumentsList);
        }
      });
    });
    
    // Enable console logging
    page.on('console', msg => {
      console.log(`BROWSER CONSOLE: ${msg.text()}`);
    });
    
    // Enable error logging
    page.on('pageerror', err => {
      console.error(`BROWSER ERROR: ${err.message}`);
    });

    console.log(`Loading page: ${DEPLOYED_APP_URL}`);
    await page.goto(DEPLOYED_APP_URL);
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for auth initialization
    await page.waitForTimeout(2000);
    
    // Try to find and click the sign-in button
    console.log('Looking for sign-in button...');
    const signInButton = page.getByRole('button', { name: /sign in to continue/i });
    await expect(signInButton).toBeVisible();
    
    console.log('Clicking sign-in button...');
    
    // Listen for popup events
    const popupPromise = page.waitForEvent('popup');
    
    await signInButton.click();
    
    try {
      console.log('Waiting for popup to appear...');
      const popup = await popupPromise;
      console.log(`Popup opened with URL: ${popup.url()}`);
      
      // Wait for the popup to navigate to Auth0
      await popup.waitForLoadState('networkidle');
      console.log(`Popup final URL: ${popup.url()}`);
      
      if (popup.url().includes('auth0.com')) {
        console.log('✅ Auth0 popup opened successfully!');
      } else {
        console.log('❌ Popup did not navigate to Auth0');
      }
      
      await popup.close();
    } catch (popupError) {
      console.error('❌ Popup error:', popupError.message);
    }
    
    // Wait a bit to see what happens
    await page.waitForTimeout(2000);
    
    console.log(`Current URL after clicking: ${page.url()}`);
  });
});