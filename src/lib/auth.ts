/// <reference types="vite/client" />
import { Auth0Client } from '@auth0/auth0-spa-js';
import { writable } from 'svelte/store';

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
    auth0 = new Auth0Client({
      domain: import.meta.env.VITE_AUTH0_DOMAIN || '',
      clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || '',
      authorizationParams: {
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE || '',
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
    await auth0.loginWithPopup();
    isAuthenticated.set(true);
    const userData = await auth0.getUser();
    user.set(userData as User);
  } catch (error) {
    console.error('Login error:', error);
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