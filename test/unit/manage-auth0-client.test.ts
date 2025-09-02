/**
 * Unit tests for Auth0ClientManager class
 * Tests actual methods from the TypeScript implementation
 */

import * as fs from 'fs';
import * as path from 'path';
import { Auth0ClientManager } from '../../scripts/manage-auth0-client';

// Mock external dependencies
jest.mock('https');
jest.mock('fs');
jest.mock('path');

// Mock the shared environment module
jest.mock('../../shared/environments.js', () => ({
  resolveDeploymentEnvironment: jest.fn(() => 'dev'),
  getEnvironmentConfig: jest.fn(() => ({
    name: 'Development',
    auth0ClientName: 'Raffle Winner Picker (Development)',
    auth0Description: 'Development environment for raffle application',
  })),
  getFrontendUrl: jest.fn(() => 'https://dev.rafflewinnerpicker.com'),
  getApiBaseUrl: jest.fn(() => 'https://dev.api.winners.dev.rafflewinnerpicker.com'),
  DEPLOYMENT_ENVIRONMENTS: { prod: 'prod', dev: 'dev' },
}));

// Mock process.exit to prevent tests from actually exiting
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('Auth0ClientManager', () => {
  const validEnv = {
    AUTH0_DOMAIN: 'test.auth0.com',
    AUTH0_CLIENT_ID: 'test_client_id',
    AUTH0_CLIENT_SECRET: 'test_client_secret',
    DEPLOY_ENV: 'dev',
    NONPROD_HOSTED_ZONE: 'dev.rafflewinnerpicker.com',
    PROD_HOSTED_ZONE: 'rafflewinnerpicker.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset process.env completely, then set our valid environment
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('AUTH0_') || key === 'DEPLOY_ENV' || key.includes('HOSTED_ZONE')) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, validEnv);

    // Mock fs methods
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.readFileSync as jest.Mock).mockReturnValue('');
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (path.join as jest.Mock).mockReturnValue('/mock/.env');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with valid environment variables', () => {
      const manager = new Auth0ClientManager();

      expect(manager.domain).toBe('test.auth0.com');
      expect(manager.clientId).toBe('test_client_id');
      expect(manager.clientSecret).toBe('test_client_secret');
      expect(manager.deployEnv).toBe('dev');
    });

    it('should exit when AUTH0_DOMAIN is missing', () => {
      delete process.env.AUTH0_DOMAIN;

      expect(() => new Auth0ClientManager()).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when AUTH0_CLIENT_ID is missing', () => {
      delete process.env.AUTH0_CLIENT_ID;

      expect(() => new Auth0ClientManager()).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit when AUTH0_CLIENT_SECRET is missing', () => {
      delete process.env.AUTH0_CLIENT_SECRET;

      expect(() => new Auth0ClientManager()).toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should default to dev environment when DEPLOY_ENV is not set', () => {
      delete process.env.DEPLOY_ENV;

      const manager = new Auth0ClientManager();
      expect(manager.deployEnv).toBe('dev');
    });
  });

  describe('Callback URL methods', () => {
    let manager: Auth0ClientManager;

    beforeEach(() => {
      manager = new Auth0ClientManager();
    });

    it('should get callback URL from environment configuration', () => {
      const callbackUrl = manager.getCallbackUrl();
      expect(callbackUrl).toBe('https://dev.rafflewinnerpicker.com');
    });

    it('should use manual override when AUTH0_SPA_CALLBACK_URL is set', () => {
      process.env.AUTH0_SPA_CALLBACK_URL = 'https://custom.example.com';

      manager = new Auth0ClientManager();
      const callbackUrl = manager.getCallbackUrl();
      expect(callbackUrl).toBe('https://custom.example.com');
    });

    it('should get all callback URLs including additional ones', () => {
      process.env.AUTH0_ADDITIONAL_CALLBACK_URLS = 'https://extra1.com, https://extra2.com';

      manager = new Auth0ClientManager();
      const urls = manager.getAllCallbackUrls();

      expect(urls).toContain('https://dev.rafflewinnerpicker.com');
      expect(urls).toContain('https://extra1.com');
      expect(urls).toContain('https://extra2.com');
      expect(urls).toHaveLength(3);
    });

    it('should handle empty additional callback URLs', () => {
      const urls = manager.getAllCallbackUrls();

      expect(urls).toContain('https://dev.rafflewinnerpicker.com');
      expect(urls).toHaveLength(1);
    });

    it('should get allowed origins from callback URLs', () => {
      process.env.AUTH0_ADDITIONAL_CALLBACK_URLS = 'https://extra.com/callback';

      manager = new Auth0ClientManager();
      const origins = manager.getAllowedOrigins();

      expect(origins).toContain('https://dev.rafflewinnerpicker.com');
      expect(origins).toContain('https://extra.com');
      expect(origins).toHaveLength(2);
    });

    it('should handle invalid URLs gracefully in getAllowedOrigins', () => {
      process.env.AUTH0_ADDITIONAL_CALLBACK_URLS = 'invalid-url, https://valid.com';

      manager = new Auth0ClientManager();
      const origins = manager.getAllowedOrigins();

      expect(origins).toContain('https://dev.rafflewinnerpicker.com');
      expect(origins).toContain('https://valid.com');
      expect(origins).not.toContain('invalid-url');
    });
  });

  describe('Environment and naming methods', () => {
    let manager: Auth0ClientManager;

    beforeEach(() => {
      manager = new Auth0ClientManager();
    });

    it('should get static environment correctly', () => {
      const staticEnv = manager.getStaticEnvironment();
      expect(staticEnv).toBe('dev');
    });

    it('should generate app name from environment config', () => {
      expect(manager.appName).toBe('Raffle Winner Picker (Development)');
    });

    it('should get app description from environment config', () => {
      const description = manager.getAppDescription();
      expect(description).toBe('Development environment for raffle application');
    });

    it('should get API identifier from environment config', () => {
      const apiId = manager.getApiIdentifier();
      expect(apiId).toBe('https://dev.api.winners.dev.rafflewinnerpicker.com');
    });

    it('should get API name from environment config', () => {
      const apiName = manager.getApiName();
      expect(apiName).toBe('Raffle Winner Picker API (Development)');
    });

    it('should get test client name from environment config', () => {
      const testClientName = manager.getTestClientName();
      expect(testClientName).toBe('Raffle Winner Picker Integration Tests (Development)');
    });
  });

  describe('File operations', () => {
    let manager: Auth0ClientManager;

    beforeEach(() => {
      manager = new Auth0ClientManager();
    });

    it('should write client ID to environment file', () => {
      const clientId = 'test_client_123';

      manager.writeClientIdToEnv(clientId);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const content = writeCall[1];

      expect(content).toContain(`VITE_SPA_AUTH0_CLIENT_ID_DEV=${clientId}`);
      expect(content).toContain(`VITE_SPA_AUTH0_CLIENT_ID=${clientId}`);
    });

    it('should update existing environment file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        'EXISTING_VAR=existing_value\nVITE_SPA_AUTH0_CLIENT_ID_DEV=old_client_id\n',
      );

      const clientId = 'new_client_123';
      manager.writeClientIdToEnv(clientId);

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const content = writeCall[1];

      expect(content).toContain(`VITE_SPA_AUTH0_CLIENT_ID_DEV=${clientId}`);
      expect(content).toContain('EXISTING_VAR=existing_value');
    });

    it('should check if test client credentials exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        'AUTH0_TEST_CLIENT_ID=test_id\nAUTH0_TEST_CLIENT_SECRET=test_secret\nAUTH0_TEST_AUDIENCE=test_audience\n',
      );

      const hasCredentials = manager.hasTestClientCredentials();
      expect(hasCredentials).toBe(true);
    });

    it('should return false when test client credentials are incomplete', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        'AUTH0_TEST_CLIENT_ID=test_id\nOTHER_VAR=value\n',
      );

      const hasCredentials = manager.hasTestClientCredentials();
      expect(hasCredentials).toBe(false);
    });

    it('should return false when env file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const hasCredentials = manager.hasTestClientCredentials();
      expect(hasCredentials).toBe(false);
    });
  });
});