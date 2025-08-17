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
    await page.evaluate(({ accessToken, idToken, user }) => {
      // Simulate what Auth0 SPA SDK stores
      const auth0Key = `@@auth0spajs@@::${process.env.VITE_SPA_AUTH0_CLIENT_ID || 'unknown'}::${window.location.origin}::openid profile email`;
      const cacheData = {
        body: {
          client_id: process.env.VITE_SPA_AUTH0_CLIENT_ID,
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
    }, { accessToken: authData.accessToken, idToken: authData.idToken, user: authData.user });
    
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
  // In CI or when we have test credentials, use programmatic auth
  if (process.env.CI || process.env.AUTH0_TEST_USER_EMAIL) {
    const success = await loginProgrammatically(page, baseUrl);
    if (success) {
      return;
    }
    console.log('Programmatic auth failed, falling back to UI auth...');
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
  
  await popup.fill('input[name="email"]', testEmail);
  await popup.fill('input[name="password"]', testPassword);
  
  // Click continue/submit button
  const continueButton = popup.locator('button[type="submit"]').first();
  await continueButton.click();
  
  // Wait for the popup to close (indicating successful auth)
  try {
    await popup.waitForEvent('close', { timeout: 10000 });
  } catch {
    // If popup doesn't close, auth might have failed, try to sign up
    if (await signUpTab.isVisible()) {
      await signUpTab.click();
      await popup.fill('input[name="email"]', testEmail);
      await popup.fill('input[name="password"]', testPassword);
      
      const signUpButton = popup.locator('button[type="submit"]').first();
      await signUpButton.click();
      
      // Wait for popup to close
      await popup.waitForEvent('close', { timeout: 10000 });
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