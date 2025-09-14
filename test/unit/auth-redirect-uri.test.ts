import { describe, test, expect, mock, beforeEach } from "bun:test";

// Mock the Auth0 client and environment
const mockAuth0Client = {
  loginWithRedirect: mock(),
  handleRedirectCallback: mock(),
  isAuthenticated: mock(),
  getUser: mock(),
  logout: mock(),
  getTokenSilently: mock(),
};

const mockAuth0Constructor = mock(() => mockAuth0Client);

// Mock window.location
const mockLocation = {
  hostname: 'dev.rafflewinnerpicker.com',
  origin: 'https://dev.rafflewinnerpicker.com',
  search: '',
  pathname: '/',
};

(global as any).window = {
  location: mockLocation,
  history: {
    replaceState: mock(),
  },
};

// Mock document
(global as any).document = {
  title: 'Test Document',
};

// Mock import.meta.env
const mockImportMeta = {
  env: {
    VITE_AUTH0_DOMAIN: 'rafflewinner.us.auth0.com',
    nonprod_hosted_zone: 'dev.rafflewinnerpicker.com',
    prod_hosted_zone: 'rafflewinnerpicker.com',
  },
};

(global as any).importMeta = mockImportMeta;

// Mock Auth0 constructor
mock.module('@auth0/auth0-spa-js', () => ({
  Auth0Client: mockAuth0Constructor,
}));

// Mock svelte store
mock.module('svelte/store', () => ({
  writable: mock((initial: any) => ({
    set: mock(),
    update: mock(),
    subscribe: mock(),
  })),
}));

// Mock the constants module
mock.module('../../src/lib/constants', () => ({
  getAuth0ClientId: mock(() => 'dev_client_123'),
  getHostedZone: mock(() => 'dev.rafflewinnerpicker.com'),
}));

// Mock the domain constants module  
mock.module('../../src/lib/domain-constants', () => ({
  getApiUrl: mock(() => 'https://dev.api.winners.dev.rafflewinnerpicker.com'),
  CORE_SERVICES: {
    WINNERS: 'winners',
  },
}));

describe('Auth Redirect URI Configuration', () => {
  beforeEach(() => {
    mockAuth0Constructor.mockClear();
    mockAuth0Client.loginWithRedirect.mockClear();
    mockAuth0Client.handleRedirectCallback.mockClear();
    mockAuth0Client.isAuthenticated.mockClear();
    mockLocation.search = '';
  });

  describe('Auth0 Client Initialization', () => {
    test('should initialize Auth0 client with correct redirect_uri for dev environment', async () => {
      mockLocation.hostname = 'dev.rafflewinnerpicker.com';
      mockLocation.origin = 'https://dev.rafflewinnerpicker.com';

      // Import after mocks are set up
      const { initAuth0 } = await import('../../src/lib/auth');
      await initAuth0();

      expect(mockAuth0Constructor).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationParams: expect.objectContaining({
            redirect_uri: 'https://dev.rafflewinnerpicker.com',
          }),
        })
      );
    });

    test('should initialize Auth0 client with correct redirect_uri for PR environment', async () => {
      mockLocation.hostname = 'pr26.dev.rafflewinnerpicker.com';
      mockLocation.origin = 'https://pr26.dev.rafflewinnerpicker.com';

      const { initAuth0 } = await import('../../src/lib/auth');
      await initAuth0();

      expect(mockAuth0Constructor).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationParams: expect.objectContaining({
            redirect_uri: 'https://pr26.dev.rafflewinnerpicker.com',
          }),
        })
      );
    });

    test('should initialize Auth0 client with correct redirect_uri for production', async () => {
      mockLocation.hostname = 'rafflewinnerpicker.com';
      mockLocation.origin = 'https://rafflewinnerpicker.com';

      const { initAuth0 } = await import('../../src/lib/auth');
      await initAuth0();

      expect(mockAuth0Constructor).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationParams: expect.objectContaining({
            redirect_uri: 'https://rafflewinnerpicker.com',
          }),
        })
      );
    });

    test('should initialize Auth0 client with correct redirect_uri for localhost', async () => {
      mockLocation.hostname = 'localhost';
      mockLocation.origin = 'http://localhost:5173';

      const { initAuth0 } = await import('../../src/lib/auth');
      await initAuth0();

      expect(mockAuth0Constructor).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationParams: expect.objectContaining({
            redirect_uri: 'http://localhost:5173',
          }),
        })
      );
    });

    test('should handle redirect callback when URL contains code and state', async () => {
      mockLocation.search = '?code=test_code&state=test_state';
      mockAuth0Client.handleRedirectCallback.mockResolvedValue({});

      const { initAuth0 } = await import('../../src/lib/auth');
      await initAuth0();

      expect(mockAuth0Client.handleRedirectCallback).toHaveBeenCalled();
    });

    test('should not handle redirect callback when URL does not contain code and state', async () => {
      mockLocation.search = '';
      mockAuth0Client.isAuthenticated.mockResolvedValue(false);

      const { initAuth0 } = await import('../../src/lib/auth');
      await initAuth0();

      expect(mockAuth0Client.handleRedirectCallback).not.toHaveBeenCalled();
    });
  });

  describe('Login with Redirect', () => {
    test('should call loginWithRedirect with correct redirect_uri for dev environment', async () => {
      mockLocation.hostname = 'dev.rafflewinnerpicker.com';
      mockLocation.origin = 'https://dev.rafflewinnerpicker.com';
      mockAuth0Client.loginWithRedirect.mockResolvedValue({});

      const { loginWithRedirect } = await import('../../src/lib/auth');
      await loginWithRedirect();

      expect(mockAuth0Client.loginWithRedirect).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationParams: expect.objectContaining({
            redirect_uri: 'https://dev.rafflewinnerpicker.com',
          }),
        })
      );
    });

    test('should call loginWithRedirect with correct redirect_uri for PR environment', async () => {
      mockLocation.hostname = 'pr26.dev.rafflewinnerpicker.com';
      mockLocation.origin = 'https://pr26.dev.rafflewinnerpicker.com';
      mockAuth0Client.loginWithRedirect.mockResolvedValue({});

      const { loginWithRedirect } = await import('../../src/lib/auth');
      await loginWithRedirect();

      expect(mockAuth0Client.loginWithRedirect).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationParams: expect.objectContaining({
            redirect_uri: 'https://pr26.dev.rafflewinnerpicker.com',
          }),
        })
      );
    });

    test('should call loginWithRedirect with correct redirect_uri for production', async () => {
      mockLocation.hostname = 'rafflewinnerpicker.com';
      mockLocation.origin = 'https://rafflewinnerpicker.com';
      mockAuth0Client.loginWithRedirect.mockResolvedValue({});

      const { loginWithRedirect } = await import('../../src/lib/auth');
      await loginWithRedirect();

      expect(mockAuth0Client.loginWithRedirect).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationParams: expect.objectContaining({
            redirect_uri: 'https://rafflewinnerpicker.com',
          }),
        })
      );
    });

    test('should call loginWithRedirect with correct redirect_uri for localhost', async () => {
      mockLocation.hostname = 'localhost';
      mockLocation.origin = 'http://localhost:5173';
      mockAuth0Client.loginWithRedirect.mockResolvedValue({});

      const { loginWithRedirect } = await import('../../src/lib/auth');
      await loginWithRedirect();

      expect(mockAuth0Client.loginWithRedirect).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationParams: expect.objectContaining({
            redirect_uri: 'http://localhost:5173',
          }),
        })
      );
    });

    test('should handle fallback API URL when PR environment API fails', async () => {
      mockLocation.hostname = 'pr26.dev.rafflewinnerpicker.com';
      mockLocation.origin = 'https://pr26.dev.rafflewinnerpicker.com';
      
      // First call fails with "Service not found", second call succeeds
      mockAuth0Client.loginWithRedirect
        .mockRejectedValueOnce(new Error('Service not found'))
        .mockResolvedValueOnce({});

      const { loginWithRedirect } = await import('../../src/lib/auth');
      await loginWithRedirect();

      // Should be called twice - first with PR API, then with fallback dev API
      expect(mockAuth0Client.loginWithRedirect).toHaveBeenCalledTimes(2);
      
      // Both calls should have the same redirect_uri
      const calls = mockAuth0Client.loginWithRedirect.mock.calls;
      expect(calls[0][0].authorizationParams.redirect_uri).toBe('https://pr26.dev.rafflewinnerpicker.com');
      expect(calls[1][0].authorizationParams.redirect_uri).toBe('https://pr26.dev.rafflewinnerpicker.com');
    });
  });

  describe('Logout', () => {
    test('should call logout with correct returnTo URL', async () => {
      mockLocation.origin = 'https://dev.rafflewinnerpicker.com';
      mockAuth0Client.logout.mockImplementation(() => {});

      const { logout } = await import('../../src/lib/auth');
      await logout();

      expect(mockAuth0Client.logout).toHaveBeenCalledWith({
        logoutParams: {
          returnTo: 'https://dev.rafflewinnerpicker.com',
        },
      });
    });
  });

  describe('Redirect URI Validation', () => {
    test('should validate that redirect_uri matches window.location.origin', async () => {
      const testCases = [
        { hostname: 'localhost', origin: 'http://localhost:5173' },
        { hostname: 'dev.rafflewinnerpicker.com', origin: 'https://dev.rafflewinnerpicker.com' },
        { hostname: 'pr26.dev.rafflewinnerpicker.com', origin: 'https://pr26.dev.rafflewinnerpicker.com' },
        { hostname: 'rafflewinnerpicker.com', origin: 'https://rafflewinnerpicker.com' },
      ];

      for (const testCase of testCases) {
        mockLocation.hostname = testCase.hostname;
        mockLocation.origin = testCase.origin;
        mockAuth0Constructor.mockClear();

        const { initAuth0 } = await import('../../src/lib/auth');
        await initAuth0();

        expect(mockAuth0Constructor).toHaveBeenCalledWith(
          expect.objectContaining({
            authorizationParams: expect.objectContaining({
              redirect_uri: testCase.origin,
            }),
          })
        );
      }
    });
  });

  describe('Error Handling', () => {
    test('should log error when Auth0 client ID is missing', async () => {
      const originalConsoleError = console.error;
      const consoleSpy = mock();
      console.error = consoleSpy;

      // Mock getAuth0ClientId to return empty string
      const { getAuth0ClientId } = await import('../../src/lib/constants');
      (getAuth0ClientId as any).mockReturnValueOnce('');

      const { initAuth0 } = await import('../../src/lib/auth');
      await initAuth0();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auth0 client ID is missing')
      );

      // Restore
      console.error = originalConsoleError;
    });
  });
});