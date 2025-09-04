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

function getApiEnvironmentFromHostname(): string {
  const currentHostname = window.location.hostname;

  if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
    return 'local';
  } else if (currentHostname.endsWith(import.meta.env.nonprod_hosted_zone)) {
    const nonprodHostedZone = import.meta.env.nonprod_hosted_zone;
    const prefix = currentHostname.replace(`.${nonprodHostedZone}`, '');
    return prefix || 'dev';
  } else if (currentHostname.endsWith(import.meta.env.prod_hosted_zone)) {
    return 'prod';
  } else {
    return 'dev';
  }
}

export async function initAuth0() {
  try {
    const domain = import.meta.env.VITE_AUTH0_DOMAIN || '';
    const clientId = getAuth0ClientId();

    // Dynamically construct audience from the current URL's hostname
    const hostedZone = getHostedZone();
    const currentHostname = window.location.hostname;

    // Determine environment from hostname, not from build-time variable
    let apiEnvName: string;


    if (currentHostname === 'localhost' || currentHostname === '127.0.0.1') {
      // For local development, use local API environment
      apiEnvName = 'local';
    } else if (currentHostname.endsWith(import.meta.env.nonprod_hosted_zone)) {
      // Non-production domains - extract the environment prefix
      // Examples: pr26.dev.rafflewinnerpicker.com → pr26, dev.rafflewinnerpicker.com → dev
      const nonprodHostedZone = import.meta.env.nonprod_hosted_zone;
      const prefix = currentHostname.replace(`.${nonprodHostedZone}`, '');
      apiEnvName = prefix || 'dev'; // fallback to 'dev' if no prefix
    } else if (currentHostname.endsWith(import.meta.env.prod_hosted_zone)) {
      // Production domain (rafflewinnerpicker.com)
      apiEnvName = 'prod';
    } else {
      // Fallback to dev for unknown domains
      apiEnvName = 'dev';
    }

    const audience = getApiUrl({
      envName: apiEnvName,
      service: CORE_SERVICES.WINNERS,
      hostedZone,
    });

    // Auth0 configuration validation
    if (!domain) {
      console.error('❌ Auth0 domain is missing! Check VITE_AUTH0_DOMAIN environment variable.');
    }
    if (!clientId) {
      console.error('❌ Auth0 client ID is missing! Check Auth0 client configuration.');
    }

    auth0 = new Auth0Client({
      domain,
      clientId,
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience,
      },
      // Enable popup mode with proper configuration
      cacheLocation: 'localstorage',
      useRefreshTokens: true,
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

    // Configure popup options explicitly
    const popupOptions = {
      authorizationParams: {
        audience: getApiUrl({
          envName: getApiEnvironmentFromHostname(),
          service: CORE_SERVICES.WINNERS,
          hostedZone: getHostedZone(),
        }),
        scope: 'openid profile email',
        response_type: 'code',
      },
      popup: {
        width: 400,
        height: 600,
        left: window.screen.width / 2 - 200,
        top: window.screen.height / 2 - 300,
      },
    };


    try {
      await auth0.loginWithPopup(popupOptions);
    } catch (popupError) {
      console.error('❌ loginWithPopup failed:', popupError);

      // Check if it's a popup blocked error or user cancelled
      const errorMessage = popupError instanceof Error ? popupError.message : String(popupError);
      if (errorMessage.includes('popup_blocked')) {
        console.error('❌ Popup was blocked by browser. Please allow popups for this site.');
        throw popupError;
      } else if (errorMessage.includes('cancelled') || errorMessage.includes('user_cancelled')) {
        console.log('ℹ️ User cancelled the authentication popup');
        throw popupError;
      }

      // Check if it's a "Service not found" error - this means PR-specific API doesn't exist
      if (errorMessage.includes('Service not found')) {
        // Try with base development API as fallback
        const fallbackApiUrl = getApiUrl({
          envName: 'dev',
          service: CORE_SERVICES.WINNERS,
          hostedZone: import.meta.env.nonprod_hosted_zone,
        });

        const fallbackPopupOptions = {
          authorizationParams: {
            audience: fallbackApiUrl,
            scope: 'openid profile email',
            response_type: 'code',
          },
          popup: {
            width: 400,
            height: 600,
            left: window.screen.width / 2 - 200,
            top: window.screen.height / 2 - 300,
          },
        };

        try {
          await auth0.loginWithPopup(fallbackPopupOptions);
        } catch (fallbackError) {
          console.error('❌ Authentication failed with both primary and fallback APIs');
          throw fallbackError;
        }
      } else {
        throw popupError;
      }
    }

    // Verify authentication worked
    const authenticated = await auth0.isAuthenticated();

    isAuthenticated.set(authenticated);

    if (authenticated) {
      const userData = await auth0.getUser();
      user.set(userData as User);
      console.log('✅ Login successful, user data:', userData);
    } else {
      console.error('❌ Authentication failed - user not authenticated after popup');
    }
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