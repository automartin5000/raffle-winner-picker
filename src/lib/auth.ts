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
    
    // Dynamically construct audience from environment instead of static env var
    const hostedZone = getHostedZone();
    const envName = import.meta.env.deploy_env;
    const audience = getApiUrl({
      envName,
      service: CORE_SERVICES.WINNERS,
      hostedZone,
    });
    
    console.log('🔧 Auth0 Configuration Debug:');
    console.log('   Domain:', domain);
    console.log('   Client ID:', clientId);
    console.log('   Environment:', envName);
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