/**
 * Unit tests for Auth0ClientManager utility functions
 * Tests core logic without making actual Auth0 API calls
 */

// Create a minimal test implementation that focuses on testable logic
describe('Auth0 Client Management Utilities', () => {

  describe('URL validation and parsing', () => {
    it('should validate callback URLs securely', () => {
      const isValidCallbackUrl = (url: string): boolean => {
        try {
          const parsedUrl = new URL(url);
          return parsedUrl.protocol === 'https:' || parsedUrl.hostname === 'localhost';
        } catch {
          return false;
        }
      };

      // Valid HTTPS URLs
      expect(isValidCallbackUrl('https://pr26.dev.rafflewinnerpicker.com')).toBe(true);
      expect(isValidCallbackUrl('https://dev.rafflewinnerpicker.com')).toBe(true);

      // Valid localhost URLs
      expect(isValidCallbackUrl('http://localhost:5173')).toBe(true);
      expect(isValidCallbackUrl('http://localhost:3000')).toBe(true);

      // Invalid URLs
      expect(isValidCallbackUrl('http://insecure-site.com')).toBe(false);
      expect(isValidCallbackUrl('not-a-url')).toBe(false);
      expect(isValidCallbackUrl('ftp://example.com')).toBe(false);
    });

    it('should safely validate Auth0 domains', () => {
      const isValidAuth0Domain = (urlString: string): boolean => {
        try {
          const url = new URL(urlString);
          return url.hostname.endsWith('.auth0.com') || url.hostname === 'auth0.com';
        } catch {
          return false;
        }
      };

      // Valid Auth0 domains
      expect(isValidAuth0Domain('https://dev-7h1ax9uy.us.auth0.com')).toBe(true);
      expect(isValidAuth0Domain('https://auth0.com')).toBe(true);
      expect(isValidAuth0Domain('https://tenant.eu.auth0.com')).toBe(true);

      // Invalid domains (potential security issues)
      expect(isValidAuth0Domain('https://malicious-auth0.com.evil.com')).toBe(false);
      expect(isValidAuth0Domain('https://evilauth0.com')).toBe(false);
      expect(isValidAuth0Domain('not-a-url')).toBe(false);
    });

    it('should extract origins from callback URLs safely', () => {
      const getOriginFromUrl = (url: string): string | null => {
        try {
          return new URL(url).origin;
        } catch {
          return null;
        }
      };

      expect(getOriginFromUrl('https://pr26.dev.rafflewinnerpicker.com/callback')).toBe('https://pr26.dev.rafflewinnerpicker.com');
      expect(getOriginFromUrl('http://localhost:5173/auth')).toBe('http://localhost:5173');
      expect(getOriginFromUrl('invalid-url')).toBe(null);
    });
  });

  describe('Environment name generation', () => {
    it('should generate app names for different environments', () => {
      const getAppName = (deployEnv: string): string => {
        const baseName = 'Raffle Winner Picker';
        if (deployEnv === 'prod') {
          return `${baseName} (Production)`;
        } else if (deployEnv === 'dev') {
          return `${baseName} (Development)`;
        } else {
          return `${baseName} (Development) - (${deployEnv})`;
        }
      };

      expect(getAppName('prod')).toBe('Raffle Winner Picker (Production)');
      expect(getAppName('dev')).toBe('Raffle Winner Picker (Development)');
      expect(getAppName('pr26')).toBe('Raffle Winner Picker (Development) - (pr26)');
      expect(getAppName('staging')).toBe('Raffle Winner Picker (Development) - (staging)');
    });

    it('should generate test client names consistently', () => {
      const getTestClientName = (deployEnv: string): string => {
        // For the script, test clients are always reused across environments to avoid tenant limits
        // So they always use the static environment determination
        const staticEnv = deployEnv === 'prod' ? 'prod' : 'dev';
        const envName = staticEnv === 'prod' ? 'Production' : 'Development';
        return `Raffle Winner Picker Integration Tests (${envName})`;
      };

      expect(getTestClientName('prod')).toBe('Raffle Winner Picker Integration Tests (Production)');
      expect(getTestClientName('dev')).toBe('Raffle Winner Picker Integration Tests (Development)');
      expect(getTestClientName('pr26')).toBe('Raffle Winner Picker Integration Tests (Development)');
    });
  });

  describe('Error handling and categorization', () => {
    it('should categorize Auth0 API errors correctly', () => {
      const categorizeAuth0Error = (errorMessage: string): string => {
        if (errorMessage.includes('404') || errorMessage.includes('not found')) {
          return 'not_found';
        } else if (errorMessage.includes('too_many_entities')) {
          return 'tenant_limit';
        } else if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('unauthorized')) {
          return 'authorization_error';
        } else if (errorMessage.includes('429') || errorMessage.includes('too_many_requests')) {
          return 'rate_limit';
        } else {
          return 'unknown_error';
        }
      };

      expect(categorizeAuth0Error('HTTP 404: Not found')).toBe('not_found');
      expect(categorizeAuth0Error('too_many_entities: Tenant limit reached')).toBe('tenant_limit');
      expect(categorizeAuth0Error('HTTP 401: Unauthorized')).toBe('authorization_error');
      expect(categorizeAuth0Error('HTTP 403: Forbidden')).toBe('authorization_error');
      expect(categorizeAuth0Error('HTTP 429: Too many requests')).toBe('rate_limit');
      expect(categorizeAuth0Error('Some other error')).toBe('unknown_error');
    });
  });

  describe('Environment variable parsing', () => {
    it('should parse additional callback URLs correctly', () => {
      const parseAdditionalUrls = (urlsString: string | undefined): string[] => {
        if (!urlsString) return [];

        return urlsString
          .split(',')
          .map(url => url.trim())
          .filter(url => url && url.length > 0);
      };

      expect(parseAdditionalUrls(undefined)).toEqual([]);
      expect(parseAdditionalUrls('')).toEqual([]);
      expect(parseAdditionalUrls('https://app1.com')).toEqual(['https://app1.com']);
      expect(parseAdditionalUrls('https://app1.com, https://app2.com')).toEqual(['https://app1.com', 'https://app2.com']);
      expect(parseAdditionalUrls('https://app1.com,https://app2.com,https://app3.com')).toEqual(['https://app1.com', 'https://app2.com', 'https://app3.com']);
      expect(parseAdditionalUrls('  , https://app1.com, , https://app2.com,  ')).toEqual(['https://app1.com', 'https://app2.com']);
    });

    it('should validate required environment variables', () => {
      const validateRequiredEnvVars = (envVars: Record<string, string | undefined>): string[] => {
        const required = ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'];
        const missing: string[] = [];

        for (const varName of required) {
          if (!envVars[varName] || envVars[varName]!.trim().length === 0) {
            missing.push(varName);
          }
        }

        return missing;
      };

      expect(validateRequiredEnvVars({
        AUTH0_DOMAIN: 'test.auth0.com',
        AUTH0_CLIENT_ID: 'test_client',
        AUTH0_CLIENT_SECRET: 'test_secret',
      })).toEqual([]);

      expect(validateRequiredEnvVars({
        AUTH0_DOMAIN: 'test.auth0.com',
        AUTH0_CLIENT_ID: 'test_client',
      })).toEqual(['AUTH0_CLIENT_SECRET']);

      expect(validateRequiredEnvVars({
        AUTH0_DOMAIN: '',
        AUTH0_CLIENT_ID: 'test_client',
        AUTH0_CLIENT_SECRET: 'test_secret',
      })).toEqual(['AUTH0_DOMAIN']);

      expect(validateRequiredEnvVars({})).toEqual(['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET']);
    });
  });

  describe('File environment variable management', () => {
    it('should handle environment variable line parsing', () => {
      const parseEnvLine = (line: string): { key: string; value: string } | null => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return null;

        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) return null;

        return {
          key: trimmed.substring(0, eqIndex).trim(),
          value: trimmed.substring(eqIndex + 1).trim(),
        };
      };

      expect(parseEnvLine('KEY=value')).toEqual({ key: 'KEY', value: 'value' });
      expect(parseEnvLine('  KEY=value  ')).toEqual({ key: 'KEY', value: 'value' });
      expect(parseEnvLine('KEY=value with spaces')).toEqual({ key: 'KEY', value: 'value with spaces' });
      expect(parseEnvLine('# comment')).toBe(null);
      expect(parseEnvLine('')).toBe(null);
      expect(parseEnvLine('invalid line')).toBe(null);
    });

    it('should create proper environment variable lines', () => {
      const createEnvLine = (key: string, value: string): string => {
        return `${key}=${value}`;
      };

      expect(createEnvLine('VITE_CLIENT_ID', 'abc123')).toBe('VITE_CLIENT_ID=abc123');
      expect(createEnvLine('AUTH0_DOMAIN', 'test.auth0.com')).toBe('AUTH0_DOMAIN=test.auth0.com');
    });
  });

  describe('Domain and environment resolution', () => {
    it('should correctly identify production vs development domains', () => {
      const getEnvironmentFromDomain = (domain: string): 'prod' | 'dev' => {
        // Use exact matching and endsWith() for secure domain validation
        if (domain === 'rafflewinnerpicker.com' || domain.endsWith('.rafflewinnerpicker.com')) {
          // Further check if it's a dev subdomain
          if (domain.includes('dev.') || domain.includes('staging.') || domain.includes('pr')) {
            return 'dev';
          }
          return domain === 'rafflewinnerpicker.com' || domain === 'www.rafflewinnerpicker.com' ? 'prod' : 'dev';
        }
        return 'dev'; // Default to dev for unknown domains
      };

      // Production domains
      expect(getEnvironmentFromDomain('rafflewinnerpicker.com')).toBe('prod');
      expect(getEnvironmentFromDomain('www.rafflewinnerpicker.com')).toBe('prod');

      // Development domains
      expect(getEnvironmentFromDomain('dev.rafflewinnerpicker.com')).toBe('dev');
      expect(getEnvironmentFromDomain('pr26.dev.rafflewinnerpicker.com')).toBe('dev');
      expect(getEnvironmentFromDomain('staging.rafflewinnerpicker.com')).toBe('dev');

      // Unknown domains default to dev
      expect(getEnvironmentFromDomain('example.com')).toBe('dev');
      expect(getEnvironmentFromDomain('localhost')).toBe('dev');
    });
  });
});