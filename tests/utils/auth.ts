import { jest } from '@jest/globals';

interface Auth0TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

interface Auth0ClientCredentials {
  clientId: string;
  clientSecret: string;
  audience: string;
  domain: string;
}

// Token cache to avoid unnecessary Auth0 requests
let tokenCache: CachedToken | null = null;

/**
 * Get Auth0 client credentials from environment variables
 */
export function getAuth0Credentials(): Auth0ClientCredentials {
  const clientId = process.env.AUTH0_TEST_CLIENT_ID;
  const clientSecret = process.env.AUTH0_TEST_CLIENT_SECRET;
  const audience = process.env.AUTH0_TEST_AUDIENCE;
  const domain = process.env.AUTH0_DOMAIN;

  if (!clientId || !clientSecret || !audience || !domain) {
    throw new Error(
      'Missing Auth0 credentials. Ensure AUTH0_TEST_CLIENT_ID, AUTH0_TEST_CLIENT_SECRET, AUTH0_TEST_AUDIENCE, and AUTH0_DOMAIN are set in .env file'
    );
  }

  return { clientId, clientSecret, audience, domain };
}

/**
 * Obtain access token using Auth0 client credentials flow
 * Caches tokens to avoid unnecessary requests within the same test run
 */
export async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    console.log('♻️ Using cached Auth0 access token');
    return tokenCache.token;
  }

  const { clientId, clientSecret, audience, domain } = getAuth0Credentials();

  console.log('🔍 Auth0 token request details:');
  console.log(`   Domain: ${domain}`);
  console.log(`   Client ID: ${clientId}`);
  console.log(`   Audience: ${audience}`);
  console.log(`   Client Secret: ${clientSecret ? '[REDACTED]' : 'MISSING'}`);

  const tokenUrl = `https://${domain}/oauth/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    audience: audience,
  });

  try {
    console.log(`🌐 Making token request to: ${tokenUrl}`);
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    console.log(`📡 Token response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Token request failed with body:', body.toString());
      throw new Error(`Auth0 token request failed: ${response.status} ${errorText}`);
    }

    const tokenData: Auth0TokenResponse = await response.json();
    
    if (!tokenData.access_token) {
      throw new Error('No access token received from Auth0');
    }

    // Cache the token with a 5-minute buffer before expiration
    const bufferSeconds = 300; // 5 minutes
    const expiresAt = Date.now() + ((tokenData.expires_in - bufferSeconds) * 1000);
    
    tokenCache = {
      token: tokenData.access_token,
      expiresAt: expiresAt
    };

    console.log('✅ Successfully obtained and cached Auth0 access token');
    console.log(`   Token type: ${tokenData.token_type}`);
    console.log(`   Expires in: ${tokenData.expires_in}s`);
    console.log(`   Cached until: ${new Date(expiresAt).toISOString()}`);
    console.log(`   Scopes: ${tokenData.scope || 'none'}`);
    
    return tokenData.access_token;

  } catch (error) {
    console.error('❌ Failed to obtain Auth0 access token:', error);
    throw error;
  }
}

/**
 * Create authorization headers with Bearer token
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();
  
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

/**
 * Clear the token cache (useful for testing or forcing a fresh token)
 */
export function clearTokenCache(): void {
  tokenCache = null;
  console.log('🗑️ Auth0 token cache cleared');
}