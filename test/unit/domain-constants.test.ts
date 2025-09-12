/**
 * @jest-environment node
 */

import {
  buildApiDomain,
  buildFrontendDomain,
  buildApiUrl,
  buildFrontendUrl,
  DOMAIN_STRUCTURE,
  AWS_ENDPOINTS,
  EXTERNAL_SERVICES,
  type DomainBuildOptions,
} from '../../shared/domain-constants';

describe('Domain Constants', () => {
  describe('Constants', () => {
    test('DOMAIN_STRUCTURE should contain API_SUBDOMAIN', () => {
      expect(DOMAIN_STRUCTURE).toHaveProperty('API_SUBDOMAIN', 'api.winners');
    });

    test('AWS_ENDPOINTS should contain STS_AUDIENCE', () => {
      expect(AWS_ENDPOINTS).toHaveProperty('STS_AUDIENCE', 'sts.amazonaws.com');
    });

    test('EXTERNAL_SERVICES should contain expected domains', () => {
      expect(EXTERNAL_SERVICES).toHaveProperty('AUTH0_DOMAIN', '*.auth0.com');
      expect(EXTERNAL_SERVICES).toHaveProperty('GITHUB_DOMAIN', 'github.com');
    });
  });

  describe('buildApiDomain', () => {
    test('should build production API domain without environment prefix', () => {
      const options: DomainBuildOptions = {
        envName: 'prod',
        hostedZone: 'rafflewinnerpicker.com',
        isProd: true,
      };

      const result = buildApiDomain(options);
      expect(result).toBe('api.winners.rafflewinnerpicker.com');
    });

    test('should build development API domain with environment prefix', () => {
      const options: DomainBuildOptions = {
        envName: 'dev',
        hostedZone: 'dev.rafflewinnerpicker.com',
        isProd: false,
      };

      const result = buildApiDomain(options);
      expect(result).toBe('dev.api.winners.dev.rafflewinnerpicker.com');
    });

    test('should build staging API domain with environment prefix', () => {
      const options: DomainBuildOptions = {
        envName: 'staging',
        hostedZone: 'dev.rafflewinnerpicker.com',
        isProd: false,
      };

      const result = buildApiDomain(options);
      expect(result).toBe('staging.api.winners.dev.rafflewinnerpicker.com');
    });

    test('should handle PR environments with numeric names', () => {
      const options: DomainBuildOptions = {
        envName: 'pr123',
        hostedZone: 'dev.rafflewinnerpicker.com',
        isProd: false,
      };

      const result = buildApiDomain(options);
      expect(result).toBe('pr123.api.winners.dev.rafflewinnerpicker.com');
    });

    test('should handle custom hosted zones', () => {
      const options: DomainBuildOptions = {
        envName: 'test',
        hostedZone: 'custom.example.com',
        isProd: false,
      };

      const result = buildApiDomain(options);
      expect(result).toBe('test.api.winners.custom.example.com');
    });
  });

  describe('buildFrontendDomain', () => {
    test('should build production frontend domain without environment prefix', () => {
      const options: DomainBuildOptions = {
        envName: 'prod',
        hostedZone: 'rafflewinnerpicker.com',
        isProd: true,
      };

      const result = buildFrontendDomain(options);
      expect(result).toBe('rafflewinnerpicker.com');
    });

    test('should build development frontend domain with environment prefix', () => {
      const options: DomainBuildOptions = {
        envName: 'dev',
        hostedZone: 'dev.rafflewinnerpicker.com',
        isProd: false,
      };

      const result = buildFrontendDomain(options);
      expect(result).toBe('dev.dev.rafflewinnerpicker.com');
    });

    test('should build staging frontend domain with environment prefix', () => {
      const options: DomainBuildOptions = {
        envName: 'staging',
        hostedZone: 'dev.rafflewinnerpicker.com',
        isProd: false,
      };

      const result = buildFrontendDomain(options);
      expect(result).toBe('staging.dev.rafflewinnerpicker.com');
    });

    test('should handle PR environments with numeric names', () => {
      const options: DomainBuildOptions = {
        envName: 'pr456',
        hostedZone: 'dev.rafflewinnerpicker.com',
        isProd: false,
      };

      const result = buildFrontendDomain(options);
      expect(result).toBe('pr456.dev.rafflewinnerpicker.com');
    });

    test('should handle custom hosted zones', () => {
      const options: DomainBuildOptions = {
        envName: 'test',
        hostedZone: 'custom.example.com',
        isProd: false,
      };

      const result = buildFrontendDomain(options);
      expect(result).toBe('test.custom.example.com');
    });
  });

  describe('buildApiUrl', () => {
    test('should build production API URL with HTTPS protocol', () => {
      const options: DomainBuildOptions = {
        envName: 'prod',
        hostedZone: 'rafflewinnerpicker.com',
        isProd: true,
      };

      const result = buildApiUrl(options);
      expect(result).toBe('https://api.winners.rafflewinnerpicker.com');
    });

    test('should build development API URL with HTTPS protocol', () => {
      const options: DomainBuildOptions = {
        envName: 'dev',
        hostedZone: 'dev.rafflewinnerpicker.com',
        isProd: false,
      };

      const result = buildApiUrl(options);
      expect(result).toBe('https://dev.api.winners.dev.rafflewinnerpicker.com');
    });

    test('should build staging API URL with HTTPS protocol', () => {
      const options: DomainBuildOptions = {
        envName: 'staging',
        hostedZone: 'dev.rafflewinnerpicker.com',
        isProd: false,
      };

      const result = buildApiUrl(options);
      expect(result).toBe('https://staging.api.winners.dev.rafflewinnerpicker.com');
    });

    test('should handle PR environment URLs', () => {
      const options: DomainBuildOptions = {
        envName: 'pr789',
        hostedZone: 'dev.rafflewinnerpicker.com',
        isProd: false,
      };

      const result = buildApiUrl(options);
      expect(result).toBe('https://pr789.api.winners.dev.rafflewinnerpicker.com');
    });
  });

  describe('buildFrontendUrl', () => {
    test('should build production frontend URL with HTTPS protocol', () => {
      const options: DomainBuildOptions = {
        envName: 'prod',
        hostedZone: 'rafflewinnerpicker.com',
        isProd: true,
      };

      const result = buildFrontendUrl(options);
      expect(result).toBe('https://rafflewinnerpicker.com');
    });

    test('should build development frontend URL with HTTPS protocol', () => {
      const options: DomainBuildOptions = {
        envName: 'dev',
        hostedZone: 'dev.rafflewinnerpicker.com',
        isProd: false,
      };

      const result = buildFrontendUrl(options);
      expect(result).toBe('https://dev.dev.rafflewinnerpicker.com');
    });

    test('should build staging frontend URL with HTTPS protocol', () => {
      const options: DomainBuildOptions = {
        envName: 'staging',
        hostedZone: 'dev.rafflewinnerpicker.com',
        isProd: false,
      };

      const result = buildFrontendUrl(options);
      expect(result).toBe('https://staging.dev.rafflewinnerpicker.com');
    });

    test('should handle PR environment URLs', () => {
      const options: DomainBuildOptions = {
        envName: 'pr999',
        hostedZone: 'dev.rafflewinnerpicker.com',
        isProd: false,
      };

      const result = buildFrontendUrl(options);
      expect(result).toBe('https://pr999.dev.rafflewinnerpicker.com');
    });
  });

  describe('Domain Construction Consistency', () => {
    test('buildApiUrl should be consistent with buildApiDomain', () => {
      const options: DomainBuildOptions = {
        envName: 'test',
        hostedZone: 'example.com',
        isProd: false,
      };

      const domain = buildApiDomain(options);
      const url = buildApiUrl(options);

      expect(url).toBe(`https://${domain}`);
    });

    test('buildFrontendUrl should be consistent with buildFrontendDomain', () => {
      const options: DomainBuildOptions = {
        envName: 'test',
        hostedZone: 'example.com',
        isProd: false,
      };

      const domain = buildFrontendDomain(options);
      const url = buildFrontendUrl(options);

      expect(url).toBe(`https://${domain}`);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty envName for production', () => {
      const options: DomainBuildOptions = {
        envName: '',
        hostedZone: 'example.com',
        isProd: true,
      };

      const apiDomain = buildApiDomain(options);
      const frontendDomain = buildFrontendDomain(options);

      expect(apiDomain).toBe('api.winners.example.com');
      expect(frontendDomain).toBe('example.com');
    });

    test('should handle empty envName for non-production', () => {
      const options: DomainBuildOptions = {
        envName: '',
        hostedZone: 'example.com',
        isProd: false,
      };

      const apiDomain = buildApiDomain(options);
      const frontendDomain = buildFrontendDomain(options);

      expect(apiDomain).toBe('.api.winners.example.com');
      expect(frontendDomain).toBe('.example.com');
    });

    test('should handle single-character envName', () => {
      const options: DomainBuildOptions = {
        envName: 'x',
        hostedZone: 'example.com',
        isProd: false,
      };

      const apiDomain = buildApiDomain(options);
      const frontendDomain = buildFrontendDomain(options);

      expect(apiDomain).toBe('x.api.winners.example.com');
      expect(frontendDomain).toBe('x.example.com');
    });
  });

  describe('Type Exports', () => {
    test('should properly export DomainBuildOptions type', () => {
      // This test ensures TypeScript types are properly exported
      const testOptions: DomainBuildOptions = {
        envName: 'test',
        hostedZone: 'example.com',
        isProd: false,
      };

      // If this compiles, the type is properly exported
      expect(testOptions).toHaveProperty('envName');
      expect(testOptions).toHaveProperty('hostedZone');
      expect(testOptions).toHaveProperty('isProd');
    });
  });
});