/**
 * @jest-environment node
 */

import {
  getEnvironmentConfig,
  resolveDeploymentEnvironment,
  getAllEnvironments,
  isProductionEnvironment,
  isEphemeralEnvironment,
  getApiBaseUrl,
  getFrontendUrl,
  DEPLOYMENT_ENVIRONMENTS,
  type DeploymentEnvironment,
  type ResolveEnvironmentOptions,
  type ApiBaseUrlOptions,
  type FrontendUrlOptions,
} from '../../shared/environments';

// Mock the domain-constants module since it's imported
jest.mock('../../shared/domain-constants', () => ({
  buildApiUrl: jest.fn(({ envName, hostedZone, isProd }) =>
    isProd
      ? `https://api.${hostedZone}`
      : `https://${envName}.api.${hostedZone}`,
  ),
  buildFrontendUrl: jest.fn(({ envName, hostedZone, isProd }) =>
    isProd
      ? `https://${hostedZone}`
      : `https://${envName}.${hostedZone}`,
  ),
}));

describe('Environments Utility Functions', () => {
  describe('getEnvironmentConfig', () => {
    test('should return dev environment config for valid dev key', () => {
      const config = getEnvironmentConfig('dev');

      expect(config).toEqual({
        name: 'Development',
        description: 'Development environment for testing and PRs',
        auth0ClientName: 'Raffle Winner Picker (Development)',
        auth0Description: 'Development environment for Raffle Winner Picker application',
        isProd: false,
        isEphemeral: true,
      });
    });

    test('should return prod environment config for valid prod key', () => {
      const config = getEnvironmentConfig('prod');

      expect(config).toEqual({
        name: 'Production',
        description: 'Production environment for live users',
        auth0ClientName: 'Raffle Winner Picker (Production)',
        auth0Description: 'Production environment for Raffle Winner Picker application',
        isProd: true,
        isEphemeral: false,
      });
    });

    test('should return dev config as fallback for unknown environment', () => {
      const config = getEnvironmentConfig('unknown');

      expect(config).toEqual(DEPLOYMENT_ENVIRONMENTS.dev);
    });

    test('should return dev config as fallback for empty string', () => {
      const config = getEnvironmentConfig('');

      expect(config).toEqual(DEPLOYMENT_ENVIRONMENTS.dev);
    });
  });

  describe('resolveDeploymentEnvironment', () => {
    test('should return "dev" when isEphemeral is true regardless of deployEnv', () => {
      const result = resolveDeploymentEnvironment({
        deployEnv: 'prod',
        isEphemeral: true,
      });

      expect(result).toBe('dev');
    });

    test('should return "prod" when deployEnv is "prod"', () => {
      const result = resolveDeploymentEnvironment({ deployEnv: 'prod' });

      expect(result).toBe('prod');
    });

    test('should return "prod" when deployEnv is "production"', () => {
      const result = resolveDeploymentEnvironment({ deployEnv: 'production' });

      expect(result).toBe('prod');
    });

    test('should return "dev" as default when no options provided', () => {
      const result = resolveDeploymentEnvironment();

      expect(result).toBe('dev');
    });

    test('should return "dev" for unknown deployEnv', () => {
      const result = resolveDeploymentEnvironment({ deployEnv: 'staging' });

      expect(result).toBe('dev');
    });

    test('should return "dev" when deployEnv is empty string', () => {
      const result = resolveDeploymentEnvironment({ deployEnv: '' });

      expect(result).toBe('dev');
    });
  });

  describe('getAllEnvironments', () => {
    test('should return all available environment keys', () => {
      const environments = getAllEnvironments();

      expect(environments).toEqual(['dev', 'prod']);
      expect(environments).toHaveLength(2);
    });
  });

  describe('isProductionEnvironment', () => {
    test('should return true for prod environment', () => {
      const result = isProductionEnvironment('prod');

      expect(result).toBe(true);
    });

    test('should return false for dev environment', () => {
      const result = isProductionEnvironment('dev');

      expect(result).toBe(false);
    });

    test('should return false for unknown environment', () => {
      const result = isProductionEnvironment('unknown');

      expect(result).toBe(false);
    });

    test('should return false for empty string', () => {
      const result = isProductionEnvironment('');

      expect(result).toBe(false);
    });
  });

  describe('isEphemeralEnvironment', () => {
    test('should return true for dev environment', () => {
      const result = isEphemeralEnvironment('dev');

      expect(result).toBe(true);
    });

    test('should return false for prod environment', () => {
      const result = isEphemeralEnvironment('prod');

      expect(result).toBe(false);
    });

    test('should return true for unknown environment (default)', () => {
      const result = isEphemeralEnvironment('unknown');

      expect(result).toBe(true);
    });

    test('should return true for empty string (default)', () => {
      const result = isEphemeralEnvironment('');

      expect(result).toBe(true);
    });
  });

  describe('getApiBaseUrl', () => {
    test('should return localhost fallback when no hostedZone provided', () => {
      const result = getApiBaseUrl();

      expect(result).toBe('https://api.localhost:3000');
    });

    test('should return localhost fallback when hostedZone is empty', () => {
      const result = getApiBaseUrl({ hostedZone: '' });

      expect(result).toBe('https://api.localhost:3000');
    });

    test('should build API URL for dev environment', () => {
      const result = getApiBaseUrl({
        deploymentEnv: 'dev',
        hostedZone: 'example.com',
        envName: 'test',
      });

      expect(result).toBe('https://test.api.example.com');
    });

    test('should build API URL for prod environment', () => {
      const result = getApiBaseUrl({
        deploymentEnv: 'prod',
        hostedZone: 'example.com',
        envName: 'prod',
      });

      expect(result).toBe('https://api.example.com');
    });

    test('should use deploymentEnv as fallback for envName', () => {
      const result = getApiBaseUrl({
        deploymentEnv: 'staging',
        hostedZone: 'example.com',
      });

      expect(result).toBe('https://staging.api.example.com');
    });

    test('should default to dev when no envName or deploymentEnv', () => {
      const result = getApiBaseUrl({
        hostedZone: 'example.com',
      });

      expect(result).toBe('https://dev.api.example.com');
    });
  });

  describe('getFrontendUrl', () => {
    test('should return localhost fallback when no hostedZone provided', () => {
      const result = getFrontendUrl();

      expect(result).toBe('http://localhost:5173');
    });

    test('should return localhost fallback when hostedZone is empty', () => {
      const result = getFrontendUrl({ hostedZone: '' });

      expect(result).toBe('http://localhost:5173');
    });

    test('should build frontend URL for dev environment', () => {
      const result = getFrontendUrl({
        deploymentEnv: 'dev',
        hostedZone: 'example.com',
        envName: 'test',
      });

      expect(result).toBe('https://test.example.com');
    });

    test('should build frontend URL for prod environment', () => {
      const result = getFrontendUrl({
        deploymentEnv: 'prod',
        hostedZone: 'example.com',
        envName: 'prod',
      });

      expect(result).toBe('https://example.com');
    });

    test('should use deploymentEnv as fallback for envName', () => {
      const result = getFrontendUrl({
        deploymentEnv: 'staging',
        hostedZone: 'example.com',
      });

      expect(result).toBe('https://staging.example.com');
    });

    test('should default to dev when no envName or deploymentEnv', () => {
      const result = getFrontendUrl({
        hostedZone: 'example.com',
      });

      expect(result).toBe('https://dev.example.com');
    });
  });

  describe('DEPLOYMENT_ENVIRONMENTS constant', () => {
    test('should contain dev and prod environments', () => {
      expect(DEPLOYMENT_ENVIRONMENTS).toHaveProperty('dev');
      expect(DEPLOYMENT_ENVIRONMENTS).toHaveProperty('prod');
    });

    test('should have correct structure for dev environment', () => {
      const dev = DEPLOYMENT_ENVIRONMENTS.dev;

      expect(dev).toHaveProperty('name');
      expect(dev).toHaveProperty('description');
      expect(dev).toHaveProperty('auth0ClientName');
      expect(dev).toHaveProperty('auth0Description');
      expect(dev).toHaveProperty('isProd', false);
      expect(dev).toHaveProperty('isEphemeral', true);
    });

    test('should have correct structure for prod environment', () => {
      const prod = DEPLOYMENT_ENVIRONMENTS.prod;

      expect(prod).toHaveProperty('name');
      expect(prod).toHaveProperty('description');
      expect(prod).toHaveProperty('auth0ClientName');
      expect(prod).toHaveProperty('auth0Description');
      expect(prod).toHaveProperty('isProd', true);
      expect(prod).toHaveProperty('isEphemeral', false);
    });
  });

  describe('Type exports', () => {
    test('should export required types', () => {
      // This test ensures TypeScript types are properly exported
      const testDeploymentEnv: DeploymentEnvironment = {
        name: 'Test',
        description: 'Test environment',
        auth0ClientName: 'Test Client',
        auth0Description: 'Test Description',
        isProd: false,
        isEphemeral: true,
      };

      const testResolveOptions: ResolveEnvironmentOptions = {
        deployEnv: 'test',
        isEphemeral: true,
      };

      const testApiOptions: ApiBaseUrlOptions = {
        deploymentEnv: 'test',
        hostedZone: 'example.com',
        envName: 'test',
      };

      const testFrontendOptions: FrontendUrlOptions = {
        deploymentEnv: 'test',
        hostedZone: 'example.com',
        envName: 'test',
      };

      // If this compiles, the types are properly exported
      expect(testDeploymentEnv).toBeDefined();
      expect(testResolveOptions).toBeDefined();
      expect(testApiOptions).toBeDefined();
      expect(testFrontendOptions).toBeDefined();
    });
  });
});