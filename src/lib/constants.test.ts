import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the environment variables and window.location
const mockEnv = {
  VITE_NONPROD_HOSTED_ZONE: 'dev.rafflewinnerpicker.com',
  VITE_PROD_HOSTED_ZONE: 'rafflewinnerpicker.com',
  VITE_AUTH0_CLIENT_ID_PROD: 'prod-client-id-123',
  VITE_AUTH0_CLIENT_ID_DEV: 'dev-client-id-456',
  VITE_SPA_AUTH0_CLIENT_ID: 'fallback-client-id-789',
};

// Mock import.meta.env
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: mockEnv
    }
  },
  writable: true
});

// Mock window.location
const mockLocation = {
  hostname: '',
  origin: 'https://example.com'
};

Object.defineProperty(globalThis, 'window', {
  value: {
    location: mockLocation
  },
  writable: true
});

describe('Environment Detection', () => {
  beforeEach(() => {
    // Reset console.log and console.error mocks
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('getAuth0ClientId', () => {
    it('should return production client ID for production hostname', async () => {
      // Set production hostname
      mockLocation.hostname = 'rafflewinnerpicker.com';
      
      // Dynamic import to get fresh module after mocking
      const { getAuth0ClientId } = await import('./constants');
      const clientId = getAuth0ClientId();
      
      expect(clientId).toBe('prod-client-id-123');
    });

    it('should return production client ID for production subdomain', async () => {
      // Set production subdomain hostname
      mockLocation.hostname = 'www.rafflewinnerpicker.com';
      
      const { getAuth0ClientId } = await import('./constants');
      const clientId = getAuth0ClientId();
      
      expect(clientId).toBe('prod-client-id-123');
    });

    it('should return dev client ID for non-production hostname', async () => {
      // Set non-production hostname
      mockLocation.hostname = 'pr25.dev.rafflewinnerpicker.com';
      
      const { getAuth0ClientId } = await import('./constants');
      const clientId = getAuth0ClientId();
      
      expect(clientId).toBe('dev-client-id-456');
    });

    it('should return dev client ID for local development hostname', async () => {
      // Set local development hostname
      mockLocation.hostname = 'local.dev.rafflewinnerpicker.com';
      
      const { getAuth0ClientId } = await import('./constants');
      const clientId = getAuth0ClientId();
      
      expect(clientId).toBe('dev-client-id-456');
    });

    it('should return fallback client ID for localhost', async () => {
      // Set localhost
      mockLocation.hostname = 'localhost';
      
      const { getAuth0ClientId } = await import('./constants');
      const clientId = getAuth0ClientId();
      
      expect(clientId).toBe('fallback-client-id-789');
    });

    it('should return fallback client ID for unknown domain', async () => {
      // Set unknown domain
      mockLocation.hostname = 'unknown.example.com';
      
      const { getAuth0ClientId } = await import('./constants');
      const clientId = getAuth0ClientId();
      
      expect(clientId).toBe('fallback-client-id-789');
    });

    it('should log environment detection details', async () => {
      mockLocation.hostname = 'rafflewinnerpicker.com';
      
      const { getAuth0ClientId } = await import('./constants');
      getAuth0ClientId();
      
      expect(console.log).toHaveBeenCalledWith('🔐 Auth0 Environment Detection:');
      expect(console.log).toHaveBeenCalledWith('   Hostname: rafflewinnerpicker.com');
      expect(console.log).toHaveBeenCalledWith('   Environment: production');
      expect(console.log).toHaveBeenCalledWith('   Client ID: prod-cli...');
    });

    it('should handle missing environment variables gracefully', async () => {
      // Test with missing PROD client ID
      const originalProdId = mockEnv.VITE_AUTH0_CLIENT_ID_PROD;
      delete (mockEnv as any).VITE_AUTH0_CLIENT_ID_PROD;
      
      mockLocation.hostname = 'rafflewinnerpicker.com';
      
      const { getAuth0ClientId } = await import('./constants');
      const clientId = getAuth0ClientId();
      
      expect(clientId).toBe(''); // Should return empty string when missing
      expect(console.error).toHaveBeenCalledWith('❌ Auth0 client ID is missing for environment:', 'production');
      
      // Restore the value
      mockEnv.VITE_AUTH0_CLIENT_ID_PROD = originalProdId;
    });
  });

  describe('getHostedZone', () => {
    it('should return production hosted zone for production hostname', async () => {
      mockLocation.hostname = 'rafflewinnerpicker.com';
      
      const { getHostedZone } = await import('./constants');
      const zone = getHostedZone();
      
      expect(zone).toBe('rafflewinnerpicker.com');
    });

    it('should return non-production hosted zone for dev hostname', async () => {
      mockLocation.hostname = 'pr25.dev.rafflewinnerpicker.com';
      
      const { getHostedZone } = await import('./constants');
      const zone = getHostedZone();
      
      expect(zone).toBe('dev.rafflewinnerpicker.com');
    });

    it('should log environment detection', async () => {
      mockLocation.hostname = 'local.dev.rafflewinnerpicker.com';
      
      const { getHostedZone } = await import('./constants');
      getHostedZone();
      
      expect(console.log).toHaveBeenCalledWith('Running in environment:', 'non-production');
    });
  });
});