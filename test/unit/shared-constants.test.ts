/**
 * @jest-environment node
 */

import {
  DEPLOYMENT_ENVIRONMENTS,
  type DeploymentEnvironment,
  getEnvironmentConfig,
  resolveAwsAccount,
  getAllEnvironments,
  isProductionEnvironment,
  isEphemeralEnvironment,
  getFrontendUrl,
} from '../../src/lib/shared-constants';

describe('Shared Constants', () => {
  describe('DEPLOYMENT_ENVIRONMENTS', () => {
    test('should contain dev environment configuration', () => {
      expect(DEPLOYMENT_ENVIRONMENTS.dev).toEqual({
        name: 'Development',
        description: 'Development environment for testing and PRs',
        auth0ClientName: 'Raffle Winner Picker (Development)',
        auth0Description: 'Development environment for Raffle Winner Picker application',
        isProd: false,
        isEphemeral: false,
      });
    });

    test('should contain prod environment configuration', () => {
      expect(DEPLOYMENT_ENVIRONMENTS.prod).toEqual({
        name: 'Production',
        description: 'Production environment for live users',
        auth0ClientName: 'Raffle Winner Picker (Production)',
        auth0Description: 'Production environment for Raffle Winner Picker application',
        isProd: true,
        isEphemeral: false,
      });
    });

    test('should have exactly two environments', () => {
      const keys = Object.keys(DEPLOYMENT_ENVIRONMENTS);
      expect(keys).toHaveLength(2);
      expect(keys).toContain('dev');
      expect(keys).toContain('prod');
    });
  });

  describe('getEnvironmentConfig', () => {
    test('should return dev environment config', () => {
      const config = getEnvironmentConfig('dev');
      expect(config.name).toBe('Development');
      expect(config.isProd).toBe(false);
      expect(config.isEphemeral).toBe(false);
    });

    test('should return prod environment config', () => {
      const config = getEnvironmentConfig('prod');
      expect(config.name).toBe('Production');
      expect(config.isProd).toBe(true);
      expect(config.isEphemeral).toBe(false);
    });

    test('should return correct auth0 client names', () => {
      expect(getEnvironmentConfig('dev').auth0ClientName).toBe('Raffle Winner Picker (Development)');
      expect(getEnvironmentConfig('prod').auth0ClientName).toBe('Raffle Winner Picker (Production)');
    });

    test('should return correct auth0 descriptions', () => {
      expect(getEnvironmentConfig('dev').auth0Description).toBe('Development environment for Raffle Winner Picker application');
      expect(getEnvironmentConfig('prod').auth0Description).toBe('Production environment for Raffle Winner Picker application');
    });
  });

  describe('resolveAwsAccount', () => {
    test('should return dev for ephemeral environments', () => {
      const result = resolveAwsAccount({ isEphemeral: true });
      expect(result).toBe('dev');
    });

    test('should return dev for ephemeral environments even with prod deployEnv', () => {
      const result = resolveAwsAccount({ deployEnv: 'prod', isEphemeral: true });
      expect(result).toBe('dev');
    });

    test('should return prod for explicit prod environment', () => {
      const result = resolveAwsAccount({ deployEnv: 'prod' });
      expect(result).toBe('prod');
    });

    test('should return prod for explicit production environment', () => {
      const result = resolveAwsAccount({ deployEnv: 'production' });
      expect(result).toBe('prod');
    });

    test('should return dev for dev environment', () => {
      const result = resolveAwsAccount({ deployEnv: 'dev' });
      expect(result).toBe('dev');
    });

    test('should return dev for unknown environments', () => {
      const result = resolveAwsAccount({ deployEnv: 'unknown' });
      expect(result).toBe('dev');
    });

    test('should return dev when no options provided', () => {
      const result = resolveAwsAccount({});
      expect(result).toBe('dev');
    });

    test('should return dev for local development', () => {
      const result = resolveAwsAccount({ deployEnv: 'local' });
      expect(result).toBe('dev');
    });

    test('should return dev for PR environments', () => {
      const result = resolveAwsAccount({ deployEnv: 'pr123' });
      expect(result).toBe('dev');
    });
  });

  describe('getAllEnvironments', () => {
    test('should return all environment keys', () => {
      const environments = getAllEnvironments();
      expect(environments).toEqual(['dev', 'prod']);
    });

    test('should return array of correct length', () => {
      const environments = getAllEnvironments();
      expect(environments).toHaveLength(2);
    });

    test('should return typed array', () => {
      const environments = getAllEnvironments();
      environments.forEach(env => {
        expect(typeof env).toBe('string');
        expect(['dev', 'prod']).toContain(env);
      });
    });
  });

  describe('isProductionEnvironment', () => {
    test('should return false for dev environment', () => {
      expect(isProductionEnvironment('dev')).toBe(false);
    });

    test('should return true for prod environment', () => {
      expect(isProductionEnvironment('prod')).toBe(true);
    });
  });

  describe('isEphemeralEnvironment', () => {
    test('should return false for dev environment', () => {
      expect(isEphemeralEnvironment('dev')).toBe(false);
    });

    test('should return false for prod environment', () => {
      expect(isEphemeralEnvironment('prod')).toBe(false);
    });
  });

  describe('getFrontendUrl', () => {
    test('should return localhost fallback when no hosted zone provided', () => {
      const url = getFrontendUrl({});
      expect(url).toBe('http://localhost:5173');
    });

    test('should return localhost fallback when hosted zone is undefined', () => {
      const url = getFrontendUrl({ hostedZone: undefined });
      expect(url).toBe('http://localhost:5173');
    });

    test('should build URL with deployment environment', () => {
      const url = getFrontendUrl({
        deploymentEnv: 'dev',
        hostedZone: 'rafflewinnerpicker.com',
      });
      expect(url).toBe('https://dev.rafflewinnerpicker.com');
    });

    test('should build URL with env name', () => {
      const url = getFrontendUrl({
        envName: 'pr123',
        hostedZone: 'dev.rafflewinnerpicker.com',
      });
      expect(url).toBe('https://pr123.dev.rafflewinnerpicker.com');
    });

    test('should build production URL correctly', () => {
      const url = getFrontendUrl({
        deploymentEnv: 'prod',
        hostedZone: 'rafflewinnerpicker.com',
      });
      expect(url).toBe('https://rafflewinnerpicker.com');
    });

    test('should prefer envName over deploymentEnv', () => {
      const url = getFrontendUrl({
        deploymentEnv: 'dev',
        envName: 'pr456',
        hostedZone: 'dev.rafflewinnerpicker.com',
      });
      expect(url).toBe('https://pr456.dev.rafflewinnerpicker.com');
    });

    test('should default to dev when no environment specified', () => {
      const url = getFrontendUrl({
        hostedZone: 'test.com',
      });
      expect(url).toBe('https://dev.test.com');
    });

    test('should handle empty strings gracefully', () => {
      const url = getFrontendUrl({
        deploymentEnv: undefined,
        envName: '',
        hostedZone: 'example.com',
      });
      expect(url).toBe('https://dev.example.com');
    });

    test('should work with complex hosted zones', () => {
      const url = getFrontendUrl({
        envName: 'staging',
        hostedZone: 'my-app.dev.example.com',
      });
      expect(url).toBe('https://staging.my-app.dev.example.com');
    });
  });

  describe('DeploymentEnvironment type', () => {
    test('should accept valid environment strings', () => {
      const validEnvs: DeploymentEnvironment[] = ['dev', 'prod'];
      validEnvs.forEach(env => {
        expect(['dev', 'prod']).toContain(env);
      });
    });
  });

  describe('Environment configuration consistency', () => {
    test('should have matching isProd flags', () => {
      expect(DEPLOYMENT_ENVIRONMENTS.dev.isProd).toBe(false);
      expect(DEPLOYMENT_ENVIRONMENTS.prod.isProd).toBe(true);
    });

    test('should have both environments as non-ephemeral', () => {
      expect(DEPLOYMENT_ENVIRONMENTS.dev.isEphemeral).toBe(false);
      expect(DEPLOYMENT_ENVIRONMENTS.prod.isEphemeral).toBe(false);
    });

    test('should have unique names', () => {
      const names = getAllEnvironments().map(env => getEnvironmentConfig(env).name);
      expect(new Set(names).size).toBe(names.length);
    });

    test('should have unique auth0 client names', () => {
      const clientNames = getAllEnvironments().map(env => getEnvironmentConfig(env).auth0ClientName);
      expect(new Set(clientNames).size).toBe(clientNames.length);
    });
  });
});