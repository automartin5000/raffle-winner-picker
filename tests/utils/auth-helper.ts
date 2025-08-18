import { Page } from '@playwright/test';

/**
 * Auth0 Test Helper for E2E Tests
 * 
 * This helper handles authentication for e2e tests using programmatic login
 * or UI-based login depending on environment.
 */

/**
 * Get Auth0 access token programmatically using client credentials or user credentials
 */
async function getAuth0AccessToken() {
  const domain = process.env.VITE_AUTH0_DOMAIN;
  const clientId = process.env.VITE_SPA_AUTH0_CLIENT_ID;
  // Dynamically construct audience from environment (same as frontend)
  const { getHostedZone } = await import('../../src/lib/constants');
  const { getApiUrl, CORE_SERVICES } = await import('../../src/lib/domain-constants');
  const hostedZone = getHostedZone();
  const envName = process.env.VITE_DEPLOY_ENV || 'local';
  const audience = getApiUrl({
    envName,
    service: CORE_SERVICES.WINNERS,
    hostedZone,
  });
  
  // For CI, use dedicated test user credentials
  const testEmail = process.env.AUTH0_TEST_USER_EMAIL || 'e2etest@example.com';
  const testPassword = process.env.AUTH0_TEST_USER_PASSWORD || 'TestPassword123!';
  
  if (!domain || !clientId) {
    throw new Error('Missing Auth0 configuration for programmatic login');
  }

  try {
    // Use Resource Owner Password Grant for test user
    const response = await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: testEmail,
        password: testPassword,
        client_id: clientId,
        audience: audience || '',
        scope: 'openid profile email',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Auth0 token request failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      user: {
        sub: 'test-user-123',
        name: 'Test User',
        email: testEmail,
      }
    };
  } catch (error) {
    console.error('Programmatic auth failed:', error);
    throw error;
  }
}

/**
 * Login using programmatic authentication (preferred for CI)
 */
async function loginProgrammatically(page: Page, baseUrl: string) {
  try {
    const authData = await getAuth0AccessToken();
    
    // Inject the auth tokens into the page's local storage
    await page.goto(baseUrl);
    
    // Set up the Auth0 SPA SDK state
    await page.evaluate(({ accessToken, idToken, user, clientId }) => {
      // Simulate what Auth0 SPA SDK stores
      const auth0Key = `@@auth0spajs@@::${clientId}::${window.location.origin}::openid profile email`;
      const cacheData = {
        body: {
          client_id: clientId,
          access_token: accessToken,
          id_token: idToken,
          scope: 'openid profile email',
          expires_in: 86400,
          token_type: 'Bearer',
          decodedToken: {
            user: user
          }
        },
        expiresAt: Math.floor(Date.now() / 1000) + 86400
      };
      
      localStorage.setItem(auth0Key, JSON.stringify(cacheData));
      
      // Also set user data
      localStorage.setItem('auth0.user', JSON.stringify(user));
      localStorage.setItem('auth0.isAuthenticated', 'true');
      
      console.log('✅ Auth tokens injected into localStorage');
    }, { 
      accessToken: authData.accessToken, 
      idToken: authData.idToken, 
      user: authData.user,
      clientId: clientId
    });
    
    // Reload to pick up the auth state
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Programmatic authentication successful');
    return true;
  } catch (error) {
    console.error('❌ Programmatic authentication failed:', error);
    return false;
  }
}

/**
 * Main login function that tries programmatic auth first, falls back to UI
 */
export async function loginWithAuth0(page: Page, baseUrl: string) {
  console.log('🔐 Starting authentication process...');
  
  // In CI or when we have test credentials, use programmatic auth
  if (process.env.CI || process.env.AUTH0_TEST_USER_EMAIL) {
    console.log('📋 Using programmatic authentication (CI environment detected)');
    const success = await loginProgrammatically(page, baseUrl);
    if (success) {
      return;
    }
    console.log('❌ Programmatic auth failed, falling back to UI auth...');
  } else {
    console.log('🖱️ Using UI-based authentication (local environment)');
  }
  
  // Fallback to UI-based authentication
  await loginWithUI(page, baseUrl);
}

/**
 * UI-based login (original implementation)
 */
async function loginWithUI(page: Page, baseUrl: string) {
  // Navigate to the app
  await page.goto(baseUrl);
  await page.waitForLoadState('networkidle');
  
  // Click the sign-in button and wait for popup
  const signInButton = page.getByRole('button', { name: /sign in to continue/i });
  
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    signInButton.click()
  ]);
  
  // Wait for Auth0 login page to load in popup
  await popup.waitForLoadState('networkidle');
  
  console.log('🔗 Auth popup URL:', popup.url());
  
  // Take a screenshot for debugging
  try {
    const screenshot = await popup.screenshot();
    console.log('📸 Auth popup screenshot captured');
  } catch (e) {
    console.log('❌ Could not capture popup screenshot:', e.message);
  }
  
  // Create or use test account credentials
  const testEmail = process.env.AUTH0_TEST_USER_EMAIL || 'e2etest@example.com';
  const testPassword = process.env.AUTH0_TEST_USER_PASSWORD || 'TestPassword123!';
  
  // Check if we need to sign up first or can sign in
  const signUpTab = popup.locator('text=Sign Up');
  const signInTab = popup.locator('text=Log In');
  
  // Try to sign in first
  if (await signInTab.isVisible()) {
    await signInTab.click();
  }
  
  // Try multiple selectors for email field
  const emailSelectors = [
    'input[name="email"]',
    'input[type="email"]',
    'input[placeholder*="email" i]',
    'input[id*="email" i]',
    '#username',
    '#email'
  ];
  
  let emailField;
  for (const selector of emailSelectors) {
    try {
      emailField = popup.locator(selector);
      if (await emailField.isVisible({ timeout: 2000 })) {
        await emailField.fill(testEmail);
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!emailField) {
    throw new Error('Could not find email input field with any known selector');
  }
  
  // Try multiple selectors for password field
  const passwordSelectors = [
    'input[name="password"]',
    'input[type="password"]',
    'input[placeholder*="password" i]',
    'input[id*="password" i]',
    '#password'
  ];
  
  let passwordField;
  for (const selector of passwordSelectors) {
    try {
      passwordField = popup.locator(selector);
      if (await passwordField.isVisible({ timeout: 2000 })) {
        await passwordField.fill(testPassword);
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  // Try multiple selectors for submit button
  const submitSelectors = [
    'button[type="submit"]',
    'button[data-action="default"]',
    'button:has-text("Continue")',
    'button:has-text("Log In")',
    'button:has-text("Sign In")',
    'button:has-text("Submit")',
    '[data-testid="submit-button"]',
    '.auth0-lock-submit'
  ];
  
  let submitButton;
  for (const selector of submitSelectors) {
    try {
      submitButton = popup.locator(selector).first();
      if (await submitButton.isVisible({ timeout: 2000 })) {
        console.log(`✅ Found submit button with selector: ${selector}`);
        await submitButton.click();
        break;
      }
    } catch (e) {
      continue;
    }
  }
  
  if (!submitButton) {
    console.log('❌ Could not find submit button with any known selector');
    // Take a screenshot for debugging
    try {
      await popup.screenshot({ path: 'auth-popup-debug.png' });
      console.log('📸 Debug screenshot saved as auth-popup-debug.png');
    } catch (e) {
      console.log('Could not save debug screenshot');
    }
    throw new Error('Could not find submit button');
  }
  
  // Wait for the popup to close (indicating successful auth)
  try {
    await popup.waitForEvent('close', { timeout: 15000 });
    console.log('✅ Auth popup closed successfully');
  } catch (e) {
    console.log('⚠️ Auth popup did not close, trying to sign up...');
    // If popup doesn't close, auth might have failed, try to sign up
    if (await signUpTab.isVisible()) {
      await signUpTab.click();
      
      // Use the same improved field detection for sign up
      for (const selector of emailSelectors) {
        try {
          const field = popup.locator(selector);
          if (await field.isVisible({ timeout: 2000 })) {
            await field.fill(testEmail);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      for (const selector of passwordSelectors) {
        try {
          const field = popup.locator(selector);
          if (await field.isVisible({ timeout: 2000 })) {
            await field.fill(testPassword);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      const signUpButton = popup.locator('button[type="submit"]').first();
      await signUpButton.click();
      
      // Wait for popup to close
      await popup.waitForEvent('close', { timeout: 15000 });
      console.log('✅ Sign up completed, popup closed');
    } else {
      console.log('❌ Could not find sign up option');
      throw new Error('Authentication failed - popup did not close and no sign up option found');
    }
  }
  
  // Wait for the app to load after authentication
  await page.waitForLoadState('networkidle');
  
  // Verify we're authenticated by checking for user interface elements
  await page.waitForSelector('.header-modern', { timeout: 15000 });
  console.log('✅ Authentication completed successfully');
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