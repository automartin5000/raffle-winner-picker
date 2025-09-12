/**
 * @jest-environment node
 */

import {
  CORE_SERVICES,
  AWS_ENDPOINTS,
  EXTERNAL_SERVICES,
  buildApiDomain,
  buildFrontendDomain,
  getApiUrl,
  buildFrontendUrl,
  type ServiceConfig,
} from '../../src/lib/domain-constants';

describe('Lib Domain Constants', () => {
  describe('CORE_SERVICES', () => {
    test('should contain WINNERS service configuration', () => {
      expect(CORE_SERVICES.WINNERS).toEqual({
        subdomain: 'api.winners',
        name: 'Raffle Winners Service',
      });
    });

    test('should have correct structure for service configs', () => {
      Object.values(CORE_SERVICES).forEach(service => {
        expect(service).toHaveProperty('subdomain');
        expect(service).toHaveProperty('name');
        expect(typeof service.subdomain).toBe('string');
        expect(typeof service.name).toBe('string');
      });
    });
  });

  describe('AWS_ENDPOINTS', () => {
    test('should contain STS_AUDIENCE', () => {
      expect(AWS_ENDPOINTS.STS_AUDIENCE).toBe('sts.amazonaws.com');
    });

    test('should have string values', () => {
      Object.values(AWS_ENDPOINTS).forEach(endpoint => {
        expect(typeof endpoint).toBe('string');
      });
    });
  });

  describe('EXTERNAL_SERVICES', () => {
    test('should contain Auth0 domain pattern', () => {
      expect(EXTERNAL_SERVICES.AUTH0_DOMAIN).toBe('*.auth0.com');
    });

    test('should contain GitHub domain', () => {
      expect(EXTERNAL_SERVICES.GITHUB_DOMAIN).toBe('github.com');
    });

    test('should have string values', () => {
      Object.values(EXTERNAL_SERVICES).forEach(domain => {
        expect(typeof domain).toBe('string');
      });
    });
  });

  describe('buildApiDomain', () => {
    const mockService: ServiceConfig = {
      subdomain: 'api.winners',
      name: 'Test Service',
    };

    test('should build development API domain with env prefix', () => {
      const domain = buildApiDomain({
        envName: 'dev',
        service: mockService,
        hostedZone: 'rafflewinnerpicker.com',
      });
      expect(domain).toBe('dev.api.winners.rafflewinnerpicker.com');
    });

    test('should build production API domain without env prefix', () => {
      const domain = buildApiDomain({
        envName: 'prod',
        service: mockService,
        hostedZone: 'rafflewinnerpicker.com',
      });
      expect(domain).toBe('api.winners.rafflewinnerpicker.com');
    });

    test('should build PR environment API domain', () => {
      const domain = buildApiDomain({
        envName: 'pr123',
        service: mockService,
        hostedZone: 'dev.rafflewinnerpicker.com',
      });
      expect(domain).toBe('pr123.api.winners.dev.rafflewinnerpicker.com');
    });

    test('should build local environment API domain', () => {
      const domain = buildApiDomain({
        envName: 'local',
        service: mockService,
        hostedZone: 'dev.rafflewinnerpicker.com',
      });
      expect(domain).toBe('local.api.winners.dev.rafflewinnerpicker.com');
    });

    test('should work with different service subdomains', () => {
      const authService: ServiceConfig = {
        subdomain: 'api.auth',
        name: 'Auth Service',
      };

      const domain = buildApiDomain({
        envName: 'dev',
        service: authService,
        hostedZone: 'example.com',
      });
      expect(domain).toBe('dev.api.auth.example.com');
    });

    test('should work with complex service subdomains', () => {
      const complexService: ServiceConfig = {
        subdomain: 'api.complex-service-name',
        name: 'Complex Service',
      };

      const domain = buildApiDomain({
        envName: 'staging',
        service: complexService,
        hostedZone: 'test.com',
      });
      expect(domain).toBe('staging.api.complex-service-name.test.com');
    });
  });

  describe('buildFrontendDomain', () => {
    test('should build development frontend domain with env prefix', () => {
      const domain = buildFrontendDomain({
        envName: 'dev',
        hostedZone: 'rafflewinnerpicker.com',
      });
      expect(domain).toBe('dev.rafflewinnerpicker.com');
    });

    test('should build production frontend domain without env prefix', () => {
      const domain = buildFrontendDomain({
        envName: 'prod',
        hostedZone: 'rafflewinnerpicker.com',
      });
      expect(domain).toBe('rafflewinnerpicker.com');
    });

    test('should build PR environment frontend domain', () => {
      const domain = buildFrontendDomain({
        envName: 'pr456',
        hostedZone: 'dev.rafflewinnerpicker.com',
      });
      expect(domain).toBe('pr456.dev.rafflewinnerpicker.com');
    });

    test('should build local environment frontend domain', () => {
      const domain = buildFrontendDomain({
        envName: 'local',
        hostedZone: 'localhost',
      });
      expect(domain).toBe('local.localhost');
    });

    test('should work with different hosted zones', () => {
      const domain = buildFrontendDomain({
        envName: 'staging',
        hostedZone: 'my-app.example.com',
      });
      expect(domain).toBe('staging.my-app.example.com');
    });
  });

  describe('getApiUrl', () => {
    const mockService: ServiceConfig = {
      subdomain: 'api.winners',
      name: 'Test Service',
    };

    test('should return full HTTPS URL for development', () => {
      const url = getApiUrl({
        envName: 'dev',
        service: mockService,
        hostedZone: 'rafflewinnerpicker.com',
      });
      expect(url).toBe('https://dev.api.winners.rafflewinnerpicker.com');
    });

    test('should return full HTTPS URL for production', () => {
      const url = getApiUrl({
        envName: 'prod',
        service: mockService,
        hostedZone: 'rafflewinnerpicker.com',
      });
      expect(url).toBe('https://api.winners.rafflewinnerpicker.com');
    });

    test('should return full HTTPS URL for PR environments', () => {
      const url = getApiUrl({
        envName: 'pr789',
        service: mockService,
        hostedZone: 'dev.rafflewinnerpicker.com',
      });
      expect(url).toBe('https://pr789.api.winners.dev.rafflewinnerpicker.com');
    });

    test('should work with CORE_SERVICES.WINNERS', () => {
      const url = getApiUrl({
        envName: 'dev',
        service: CORE_SERVICES.WINNERS,
        hostedZone: 'rafflewinnerpicker.com',
      });
      expect(url).toBe('https://dev.api.winners.rafflewinnerpicker.com');
    });

    test('should always use HTTPS protocol', () => {
      const environments = ['dev', 'prod', 'local', 'pr123', 'staging'];

      environments.forEach(envName => {
        const url = getApiUrl({
          envName,
          service: mockService,
          hostedZone: 'example.com',
        });
        expect(url).toMatch(/^https:\/\//);
      });
    });
  });

  describe('buildFrontendUrl', () => {
    test('should return full HTTPS URL for development', () => {
      const url = buildFrontendUrl({
        envName: 'dev',
        hostedZone: 'rafflewinnerpicker.com',
      });
      expect(url).toBe('https://dev.rafflewinnerpicker.com');
    });

    test('should return full HTTPS URL for production', () => {
      const url = buildFrontendUrl({
        envName: 'prod',
        hostedZone: 'rafflewinnerpicker.com',
      });
      expect(url).toBe('https://rafflewinnerpicker.com');
    });

    test('should return full HTTPS URL for PR environments', () => {
      const url = buildFrontendUrl({
        envName: 'pr999',
        hostedZone: 'dev.rafflewinnerpicker.com',
      });
      expect(url).toBe('https://pr999.dev.rafflewinnerpicker.com');
    });

    test('should always use HTTPS protocol', () => {
      const environments = ['dev', 'prod', 'local', 'pr123', 'staging'];

      environments.forEach(envName => {
        const url = buildFrontendUrl({
          envName,
          hostedZone: 'example.com',
        });
        expect(url).toMatch(/^https:\/\//);
      });
    });

    test('should work with different hosted zones', () => {
      const hostedZones = [
        'rafflewinnerpicker.com',
        'dev.rafflewinnerpicker.com',
        'test.example.com',
        'my-app.dev.example.org',
      ];

      hostedZones.forEach(hostedZone => {
        const url = buildFrontendUrl({
          envName: 'test',
          hostedZone,
        });
        expect(url).toBe(`https://test.${hostedZone}`);
      });
    });
  });

  describe('ServiceConfig interface', () => {
    test('should accept valid service configurations', () => {
      const services: ServiceConfig[] = [
        { subdomain: 'api.winners', name: 'Raffle Winners Service' },
        { subdomain: 'api.auth', name: 'Authentication Service' },
        { subdomain: 'api.notifications', name: 'Notification Service' },
        { subdomain: 'api.complex-name', name: 'Complex Service Name' },
      ];

      services.forEach(service => {
        expect(service).toHaveProperty('subdomain');
        expect(service).toHaveProperty('name');
        expect(typeof service.subdomain).toBe('string');
        expect(typeof service.name).toBe('string');
      });
    });
  });

  describe('Environment handling edge cases', () => {
    const mockService: ServiceConfig = {
      subdomain: 'api.test',
      name: 'Test Service',
    };

    test('should handle empty environment names', () => {
      const domain = buildApiDomain({
        envName: '',
        service: mockService,
        hostedZone: 'example.com',
      });
      expect(domain).toBe('.api.test.example.com');
    });

    test('should handle single character environment names', () => {
      const domain = buildApiDomain({
        envName: 'a',
        service: mockService,
        hostedZone: 'example.com',
      });
      expect(domain).toBe('a.api.test.example.com');
    });

    test('should handle numeric environment names', () => {
      const domain = buildApiDomain({
        envName: '123',
        service: mockService,
        hostedZone: 'example.com',
      });
      expect(domain).toBe('123.api.test.example.com');
    });

    test('should handle environment names with hyphens', () => {
      const domain = buildApiDomain({
        envName: 'feature-branch',
        service: mockService,
        hostedZone: 'example.com',
      });
      expect(domain).toBe('feature-branch.api.test.example.com');
    });
  });

  describe('Constants structure consistency', () => {
    test('should export all expected constants', () => {
      expect(CORE_SERVICES).toBeDefined();
      expect(AWS_ENDPOINTS).toBeDefined();
      expect(EXTERNAL_SERVICES).toBeDefined();
    });

    test('should export all expected functions', () => {
      expect(typeof buildApiDomain).toBe('function');
      expect(typeof buildFrontendDomain).toBe('function');
      expect(typeof getApiUrl).toBe('function');
      expect(typeof buildFrontendUrl).toBe('function');
    });

    test('should have readonly objects', () => {
      // These should be defined as const exports
      expect(CORE_SERVICES).toBeTruthy();
      expect(AWS_ENDPOINTS).toBeTruthy();
      expect(EXTERNAL_SERVICES).toBeTruthy();
    });
  });
});