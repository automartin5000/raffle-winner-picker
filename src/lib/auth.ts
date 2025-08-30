/// <reference types="vite/client" />
import { Auth0Client } from '@auth0/auth0-spa-js';
import { writable } from 'svelte/store';
import { getAuth0ClientId, getHostedZone } from './constants';
import { getApiUrl, CORE_SERVICES } from './domain-constants';

interface User {
  sub: string;
  name: string;
  email: string;
}

export const auth0Client = writable<Auth0Client | null>(null);
export const isAuthenticated = writable(false);
export const user = writable<User | null>(null);
export const isLoading = writable(true);

let auth0: Auth0Client;

export async function initAuth0() {
  try {
    const domain = import.meta.env.VITE_AUTH0_DOMAIN || '';
    const clientId = getAuth0ClientId();

    // Dynamically construct audience from the current URL's hostname
    const hostedZone = getHostedZone();
    const currentHostname = window.location.hostname;

    // Determine environment from hostname, not from build-time variable
    let apiEnvName: string;

    console.log('🔍 Environment Detection Debug:');
    console.log('   nonprod_hosted_zone:', import.meta.env.nonprod_hosted_zone);
    console.log('   prod_hosted_zone:', import.meta.env.prod_hosted_zone);
    console.log('   VITE_NONPROD_HOSTED_ZONE:', import.meta.env.VITE_NONPROD_HOSTED_ZONE);
    console.log('   VITE_PROD_HOSTED_ZONE:', import.meta.env.VITE_PROD_HOSTED_ZONE);
    console.log('   All env vars:', Object.keys(import.meta.env).reduce((acc, key) => {
      acc[key] = import.meta.env[key];
      return acc;
    }, {}));

    if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
      // For local development, use local API environment
      apiEnvName = 'local';
      console.log('   → Detected: localhost (using local API)');
    } else if (currentHostname.endsWith(import.meta.env.nonprod_hosted_zone)) {
      // Non-production domains - extract the environment prefix
      // Examples: pr26.dev.rafflewinnerpicker.com → pr26, dev.rafflewinnerpicker.com → dev
      const nonprodHostedZone = import.meta.env.nonprod_hosted_zone;
      const prefix = currentHostname.replace(`.${nonprodHostedZone}`, '');
      apiEnvName = prefix || 'dev'; // fallback to 'dev' if no prefix
      console.log(`   → Detected: nonprod domain (using ${apiEnvName} API)`);
    } else if (currentHostname.endsWith(import.meta.env.prod_hosted_zone)) {
      // Production domain (rafflewinnerpicker.com)
      apiEnvName = 'prod';
      console.log('   → Detected: prod domain (using prod API)');
    } else {
      // Fallback to dev for unknown domains
      apiEnvName = 'dev';
      console.log('   → Detected: unknown domain (fallback to dev API)');
    }

    const audience = getApiUrl({
      envName: apiEnvName,
      service: CORE_SERVICES.WINNERS,
      hostedZone,
    });

    console.log('🔧 Auth0 Configuration Debug:');
    console.log('   Domain:', domain);
    console.log('   Client ID:', clientId);
    console.log('   Current Hostname:', currentHostname);
    console.log('   API Environment:', apiEnvName);
    console.log('   Hosted Zone:', hostedZone);
    console.log('   Audience (API URL):', audience);
    console.log('   Redirect URI:', window.location.origin);

    if (!domain) {
      console.error('❌ Auth0 domain is missing! Check VITE_AUTH0_DOMAIN environment variable.');
    }
    if (!clientId) {
      console.error('❌ Auth0 client ID is missing! Check VITE_SPA_AUTH0_CLIENT_ID environment variable.');
    }

    auth0 = new Auth0Client({
      domain,
      clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience,
      },
    });

    auth0Client.set(auth0);

    // Handle redirect callback
    if (window.location.search.includes('code=') && window.location.search.includes('state=')) {
      await auth0.handleRedirectCallback();
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check if user is authenticated
    const authenticated = await auth0.isAuthenticated();
    isAuthenticated.set(authenticated);

    if (authenticated) {
      const userData = await auth0.getUser();
      user.set(userData as User);
    }

    isLoading.set(false);
  } catch (error) {
    console.error('Auth0 initialization error:', error);
    isLoading.set(false);
  }
}

export async function loginWithPopup() {
  try {
    console.log('🔐 Attempting login with popup...');
    if (!auth0) {
      console.error('❌ Auth0 client not initialized! Cannot login.');
      return;
    }
    console.log('✅ Auth0 client available, calling loginWithPopup...');
    try {
      const result = await auth0.loginWithPopup();
      console.log('✅ loginWithPopup returned:', result);
    } catch (popupError) {
      console.error('❌ loginWithPopup failed:', popupError);
      throw popupError;
    }
    isAuthenticated.set(true);
    const userData = await auth0.getUser();
    user.set(userData as User);
    console.log('✅ Login successful');
  } catch (error) {
    console.error('❌ Login error:', error);
  }
}

export async function logout() {
  void auth0.logout({
    logoutParams: {
      returnTo: window.location.origin,
    },
  });
  isAuthenticated.set(false);
  user.set(null);
}

export async function getAccessToken() {
  try {
    return await auth0.getTokenSilently();
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}