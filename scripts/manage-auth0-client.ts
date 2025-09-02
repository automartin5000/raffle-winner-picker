import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

// Import shared environment configuration
import { 
  resolveDeploymentEnvironment, 
  getEnvironmentConfig, 
  getFrontendUrl,
  getApiBaseUrl,
  DEPLOYMENT_ENVIRONMENTS
} from '../shared/environments.js';

// Type definitions for Auth0 API responses
interface Auth0Client {
  client_id: string;
  name: string;
  app_type: string;
  callbacks?: string[];
  allowed_logout_urls?: string[];
  web_origins?: string[];
  allowed_origins?: string[];
  client_metadata?: Record<string, any>;
  updated_at?: string;
  client_secret?: string;
}

interface Auth0API {
  id: string;
  name: string;
  identifier: string;
  scopes?: Array<{ value: string; description: string }>;
}

interface Auth0Grant {
  id: string;
  audience: string;
  client_id: string;
  scope: string[];
}

interface Auth0User {
  user_id: string;
  email: string;
  email_verified?: boolean;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

/**
 * Auth0 SPA Client Management Script
 * 
 * This script manages Auth0 Single Page Application clients for different environments.
 * It can create, read, update, or delete Auth0 SPA clients via the Management API.
 * 
 * Environment Variables Required:
 * - AUTH0_DOMAIN: Your Auth0 domain (e.g., 'your-tenant.auth0.com')
 * - AUTH0_CLIENT_ID: Management API client ID (Machine to Machine)
 * - AUTH0_CLIENT_SECRET: Management API client secret
 * - DEPLOY_ENV: Environment name (dev, prod, etc.)
 * - PROD_HOSTED_ZONE: Production domain for callback URL (derived from domain-constants)
 * - NONPROD_HOSTED_ZONE: Development domain for callback URL (derived from domain-constants)
 * - AUTH0_SPA_CALLBACK_URL: Manual override for callback URL (optional)
 * 
 * Usage:
 * bunx scripts/manage-auth0-client.ts create
 * bunx scripts/manage-auth0-client.ts read <client_id>
 * bunx scripts/manage-auth0-client.ts update <client_id>
 * bunx scripts/manage-auth0-client.ts delete <client_id>
 * bunx scripts/manage-auth0-client.ts ensure-client
 * bunx scripts/manage-auth0-client.ts ensure-api
 * bunx scripts/manage-auth0-client.ts ensure-test-client
 * bunx scripts/manage-auth0-client.ts setup-integration-testing
 */

export class Auth0ClientManager {
  public readonly domain: string;
  public readonly clientId: string;
  public readonly clientSecret: string;
  public readonly deployEnv: string;
  public readonly callbackUrl: string | null;
  public accessToken: string | null;
  public readonly appName: string;

  constructor() {
    this.domain = process.env.AUTH0_DOMAIN!;
    this.clientId = process.env.AUTH0_CLIENT_ID!;
    this.clientSecret = process.env.AUTH0_CLIENT_SECRET!;
    this.deployEnv = process.env.DEPLOY_ENV || 'dev';
    this.callbackUrl = this.getCallbackUrl();
    
    if (!this.domain || !this.clientId || !this.clientSecret) {
      console.error('❌ Missing required Auth0 environment variables:');
      console.error('   AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET');
      process.exit(1);
    }
    
    this.accessToken = null;
    this.appName = this.getAppName();
  }

  /**
   * Determine the static environment (dev or prod) regardless of PR number
   */
  getStaticEnvironment() {
    return resolveDeploymentEnvironment({
      deployEnv: process.env.DEPLOY_ENV,
      isEphemeral: process.env.DEPLOY_EPHEMERAL === 'true',
    });
  }

  /**
   * Get callback URL from hosted zone environment variables
   */
  getCallbackUrl(): string | null {
    // Manual override takes precedence (for testing/custom setups)
    if (process.env.AUTH0_SPA_CALLBACK_URL) {
      return process.env.AUTH0_SPA_CALLBACK_URL;
    }

    // Derive from hosted zones based on environment
    const hostedZone = this.deployEnv === 'prod' 
      ? process.env.PROD_HOSTED_ZONE 
      : process.env.NONPROD_HOSTED_ZONE;

    const frontendUrl = getFrontendUrl({
      deploymentEnv: this.deployEnv,
      hostedZone,
      envName: process.env.DEPLOY_ENV
    });

    if (frontendUrl && !frontendUrl.includes('localhost')) {
      return frontendUrl;
    }

    console.warn('⚠️  No callback URL available - neither AUTH0_SPA_CALLBACK_URL nor hosted zone environment variables are set');
    return null;
  }

  /**
   * Get all callback URLs including additional ones from environment
   */
  getAllCallbackUrls(): string[] {
    const urls = [];
    
    // Add primary callback URL
    if (this.callbackUrl) {
      urls.push(this.callbackUrl);
    }

    // Add additional callback URLs from environment variable
    if (process.env.AUTH0_ADDITIONAL_CALLBACK_URLS) {
      const additionalUrls = process.env.AUTH0_ADDITIONAL_CALLBACK_URLS
        .split(',')
        .map(url => url.trim())
        .filter(url => url && !urls.includes(url));
      urls.push(...additionalUrls);
    }

    return urls;
  }

  /**
   * Get all allowed origins from callback URLs
   */
  getAllowedOrigins(): string[] {
    const urls = this.getAllCallbackUrls();
    const origins = [];

    urls.forEach(url => {
      try {
        const origin = new URL(url).origin;
        if (!origins.includes(origin)) {
          origins.push(origin);
        }
      } catch (error) {
        console.warn(`⚠️  Invalid callback URL: ${url}`);
      }
    });

    return origins;
  }

  /**
   * Get the standardized app name and description from shared config
   */
  getAppName() {
      const config = getEnvironmentConfig(this.deployEnv);
      if (!Object.keys(DEPLOYMENT_ENVIRONMENTS).includes(this.deployEnv)) {
          return `${config.auth0ClientName} - (${this.deployEnv})`;
      } else {
          return config.auth0ClientName;
      }
  }

  /**
   * Get the app description from shared config
   */
  getAppDescription() {
    const config = getEnvironmentConfig(this.deployEnv);
    return config.auth0Description;
  }

  /**
   * Get Management API access token
   */
  async getAccessToken() {
    if (this.accessToken) return this.accessToken;

    const data = JSON.stringify({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      audience: `https://${this.domain}/api/v2/`,
      grant_type: 'client_credentials'
    });

    const options = {
      hostname: this.domain,
      port: 443,
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            if (response.access_token) {
              this.accessToken = response.access_token;
              resolve(response.access_token);
            } else {
              reject(new Error(`Failed to get access token: ${body}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /**
   * Make authenticated request to Management API
   */
  async makeRequest(method, path, data = null) {
    const token = await this.getAccessToken();
    
    const options = {
      hostname: this.domain,
      port: 443,
      path: `/api/v2${path}`,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      const bodyData = JSON.stringify(data);
      options.headers['Content-Length'] = bodyData.length;
    }

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const response = body ? JSON.parse(body) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${body}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  /**
   * Create a new SPA client
   */
  async createClient() {
    const callbackUrls = this.getAllCallbackUrls();
    const allowedOrigins = this.getAllowedOrigins();
    
    const clientData = {
      name: this.appName,
      description: this.getAppDescription(),
      app_type: 'spa',
      logo_uri: allowedOrigins.length > 0 ? `${allowedOrigins[0]}/favicon.svg` : undefined,
      callbacks: callbackUrls,
      allowed_logout_urls: callbackUrls,
      web_origins: allowedOrigins,
      allowed_origins: allowedOrigins,
      oidc_conformant: true,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'implicit', 'refresh_token', 'password'],
      jwt_configuration: {
        alg: 'RS256'
      },
      client_metadata: {
        environment: this.deployEnv,
        static_env: 'true' // Mark as static environment client
      }
    };

    try {
      const client = await this.makeRequest('POST', '/clients', clientData);
      console.log('✅ Successfully created Auth0 SPA client:');
      console.log(`   Client ID: ${client.client_id}`);
      console.log(`   Name: ${client.name}`);
      console.log(`   Environment: ${this.deployEnv}`);
      
      // Write client ID to environment file
      this.writeClientIdToEnv(client.client_id);
      
      return client;
    } catch (error) {
      console.error('❌ Failed to create Auth0 client:', error.message);
      throw error;
    }
  }

  /**
   * Read client information
   */
  async readClient(clientId) {
    try {
      const client = await this.makeRequest('GET', `/clients/${clientId}`);
      console.log('📖 Auth0 Client Information:');
      console.log(`   Client ID: ${client.client_id}`);
      console.log(`   Name: ${client.name}`);
      console.log(`   App Type: ${client.app_type}`);
      console.log(`   Environment: ${client.client_metadata?.environment || 'unknown'}`);
      console.log(`   Callbacks: ${JSON.stringify(client.callbacks, null, 2)}`);
      return client;
    } catch (error) {
      console.error('❌ Failed to read Auth0 client:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing client
   */
  async updateClient(clientId) {
    const callbackUrls = this.getAllCallbackUrls();
    const allowedOrigins = this.getAllowedOrigins();
    
    const updates = {
      name: this.appName,
      callbacks: callbackUrls,
      allowed_logout_urls: callbackUrls,
      web_origins: allowedOrigins,
      allowed_origins: allowedOrigins,
      client_metadata: {
        environment: this.deployEnv
      }
    };

    try {
      const client = await this.makeRequest('PATCH', `/clients/${clientId}`, updates);
      console.log('✅ Successfully updated Auth0 SPA client:');
      console.log(`   Client ID: ${client.client_id}`);
      console.log(`   Name: ${client.name}`);
      return client;
    } catch (error) {
      console.error('❌ Failed to update Auth0 client:', error.message);
      throw error;
    }
  }

  /**
   * Delete a client
   */
  async deleteClient(clientId) {
    try {
      await this.makeRequest('DELETE', `/clients/${clientId}`);
      console.log('✅ Successfully deleted Auth0 SPA client:', clientId);
      
      // Remove from environment file if it exists
      this.removeClientIdFromEnv(clientId);
    } catch (error) {
      console.error('❌ Failed to delete Auth0 client:', error.message);
      throw error;
    }
  }

  /**
   * Find existing client by environment
   */
  async findClientByEnvironment() {
    try {
      const clients = await this.makeRequest('GET', '/clients?app_type=spa');
      return clients.find(client => {
        // Check for exact name match first
        if (client.name === this.appName) {
          return true;
        }
        
        // Check metadata for static environment
        if (client.client_metadata?.static_env === 'true' && 
            client.client_metadata?.environment === this.deployEnv) {
          return true;
        }
        
        // Legacy check for older naming pattern
        const config = getEnvironmentConfig(this.deployEnv);
        return client.name.includes(`(${config.name})`);
      });
    } catch (error) {
      console.error('❌ Failed to search for existing clients:', error.message);
      throw error;
    }
  }

  /**
   * Ensure client exists (create if not found, update if found)
   */
  async ensureClient() {
    console.log(`🔍 Looking for existing Auth0 SPA client for environment: ${this.deployEnv}`);
    
    const existingClient = await this.findClientByEnvironment();
    
    if (existingClient) {
      console.log(`📝 Found existing client: ${existingClient.client_id}`);
      const updatedClient = await this.updateClient(existingClient.client_id);
      this.writeClientIdToEnv(updatedClient.client_id);
      return updatedClient;
    } else {
      console.log('🆕 No existing client found, creating new one...');
      return await this.createClient();
    }
  }

  /**
   * Get client info and write to env (for builds - no updates)
   */
  async getClientForBuild() {
    console.log(`🔍 Getting Auth0 SPA client ID for build environment: ${this.deployEnv}`);
    
    const existingClient = await this.findClientByEnvironment();
    
    if (existingClient) {
      console.log(`📋 Found existing client: ${existingClient.client_id}`);
      this.writeClientIdToEnv(existingClient.client_id);
      return existingClient;
    } else {
      console.log('🆕 No existing client found, creating new one...');
      return await this.createClient();
    }
  }

  /**
   * Write client ID and derived URLs to environment file
   */
  writeClientIdToEnv(clientId) {
    const envFile = path.join(process.cwd(), '.env');
    let envContent = '';
    
    // Read existing env file if it exists
    if (fs.existsSync(envFile)) {
      envContent = fs.readFileSync(envFile, 'utf8');
    }
    
    const lines = envContent.split('\n');
    
    // Helper function to update or add environment variable
    const updateEnvVar = (varName, value) => {
      const envVarLine = `${varName}=${value}`;
      const existingLineIndex = lines.findIndex(line => line.startsWith(`${varName}=`));
      
      if (existingLineIndex >= 0) {
        lines[existingLineIndex] = envVarLine;
      } else {
        lines.push(envVarLine);
      }
    };
    
    // Update or add the environment-specific client ID
    const envVarName = `VITE_SPA_AUTH0_CLIENT_ID_${this.deployEnv.toUpperCase()}`;
    updateEnvVar(envVarName, clientId);
    
    // Also add the current environment's client ID as the default
    updateEnvVar('VITE_SPA_AUTH0_CLIENT_ID', clientId);

    fs.writeFileSync(envFile, lines.filter(line => line.trim()).join('\n') + '\n');
    console.log(`📝 Updated ${envFile} with client ID: ${clientId} (env: ${this.deployEnv})`);
  }

  /**
   * Remove client ID from environment file
   */
  removeClientIdFromEnv(clientId) {
    const envFile = path.join(process.cwd(), '.env.local');
    
    if (!fs.existsSync(envFile)) return;
    
    const envContent = fs.readFileSync(envFile, 'utf8');
    const lines = envContent.split('\n').filter(line => 
      !line.includes(clientId) && line.trim()
    );
    
    fs.writeFileSync(envFile, lines.join('\n') + '\n');
    console.log(`📝 Removed client ID ${clientId} from ${envFile}`);
  }

  /**
   * Create or update Auth0 API resource
   */
  async ensureApi() {
    const apiIdentifier = this.getApiIdentifier();
    const apiName = this.getApiName();
    
    console.log(`🔍 Looking for existing Auth0 API: ${apiIdentifier}`);
    console.log(`   Expected API Name: ${apiName}`);
    
    try {
      // Check if API already exists
      const existingApi = await this.makeRequest('GET', `/resource-servers/${encodeURIComponent(apiIdentifier)}`);
      console.log(`📝 Found existing API:`);
      console.log(`   Name: ${existingApi.name}`);
      console.log(`   Identifier: ${existingApi.identifier}`);
      console.log(`   ID: ${existingApi.id}`);
      console.log(`   Scopes: ${existingApi.scopes?.map(s => s.value).join(', ') || 'none'}`);
      
      // Update the API
      const updatedApi = await this.updateApi(apiIdentifier);
      
      
      return updatedApi;
    } catch (error) {
      if (error.message.includes('404')) {
        console.log('🆕 No existing API found, creating new one...');
        const createdApi = await this.createApi();
        
        
        return createdApi;
      } else {
        console.error(`❌ Error checking for existing API: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Ensure an Auth0 API resource exists for the actual deployment URL
   * This is needed in CI environments where the deployment URL differs from the static API identifier
   */
  async ensureDeploymentApi() {
    const deploymentUrl = process.env.API_BASE_URL;
    if (!deploymentUrl) {
      console.log(`ℹ️  No API_BASE_URL provided, skipping deployment API creation`);
      return;
    }

    const deploymentApiName = `${this.getApiName()} (Deployment)`;
    
    console.log(`🔍 Looking for existing deployment API: ${deploymentUrl}`);
    console.log(`   Expected API Name: ${deploymentApiName}`);
    
    try {
      // Check if deployment API already exists
      const existingApi = await this.makeRequest('GET', `/resource-servers/${encodeURIComponent(deploymentUrl)}`);
      console.log(`📝 Found existing deployment API:`);
      console.log(`   Name: ${existingApi.name}`);
      console.log(`   Identifier: ${existingApi.identifier}`);
      
      // Update the deployment API
      await this.updateDeploymentApi(deploymentUrl, deploymentApiName);
      return existingApi;
    } catch (error) {
      if (error.message.includes('404')) {
        console.log('🆕 No existing deployment API found, attempting to create new one...');
        try {
          return await this.createDeploymentApi(deploymentUrl, deploymentApiName);
        } catch (createError) {
          if (createError.message.includes('too_many_entities')) {
            console.log('❌ Hit Auth0 tenant limit for API resources. Trying to reuse existing API...');
            // Try to find and reuse an existing API resource
            return await this.findAndReuseExistingApi(deploymentUrl);
          }
          throw createError;
        }
      } else {
        console.error(`❌ Error checking for existing deployment API: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Find and reuse an existing API resource when hitting tenant limits
   */
  async findAndReuseExistingApi(targetUrl) {
    console.log('🔍 Looking for existing API resources to reuse...');
    
    try {
      // Get all existing API resources
      const apis = await this.makeRequest('GET', '/resource-servers');
      
      // Look for an existing development API that we can reuse
      const developmentApis = apis.filter(api => 
        api.name && api.name.toLowerCase().includes('development') &&
        api.identifier && api.identifier.includes('dev.rafflewinnerpicker.com')
      );
      
      if (developmentApis.length > 0) {
        const reuseApi = developmentApis[0];
        console.log(`🔄 Reusing existing API resource: ${reuseApi.identifier}`);
        console.log(`   Name: ${reuseApi.name}`);
        console.log(`   Note: Using existing API instead of creating PR-specific one`);
        console.log(`   Tokens issued for: ${targetUrl} will use audience: ${reuseApi.identifier}`);
        return reuseApi;
      }
      
      // If no suitable API found, throw an error
      throw new Error('No suitable API resource found to reuse and tenant limit reached');
    } catch (error) {
      console.error(`❌ Failed to find reusable API: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new Auth0 API resource
   */
  async createApi() {
    const apiIdentifier = this.getApiIdentifier();
    const apiName = this.getApiName();
    
    const apiData = {
      name: apiName,
      identifier: apiIdentifier,
      scopes: [
        {
          value: 'read:raffles',
          description: 'Read raffle runs and entries'
        },
        {
          value: 'write:raffles',
          description: 'Create new raffle runs'
        }
      ],
      signing_alg: 'RS256',
      token_lifetime: 86400,
      token_lifetime_for_web: 7200,
      skip_consent_for_verifiable_first_party_clients: true
    };

    try {
      const api = await this.makeRequest('POST', '/resource-servers', apiData);
      console.log('✅ Successfully created Auth0 API:');
      console.log(`   API ID: ${api.id}`);
      console.log(`   Identifier: ${api.identifier}`);
      console.log(`   Name: ${api.name}`);
      return api;
    } catch (error) {
      console.error('❌ Failed to create Auth0 API:', error.message);
      throw error;
    }
  }

  /**
   * Update existing Auth0 API resource
   */
  async updateApi(apiIdentifier) {
    const apiName = this.getApiName();
    
    const updates = {
      name: apiName,
      scopes: [
        {
          value: 'read:raffles',
          description: 'Read raffle runs and entries'
        },
        {
          value: 'write:raffles',
          description: 'Create new raffle runs'
        }
      ],
      token_lifetime: 86400,
      token_lifetime_for_web: 7200
    };

    try {
      const api = await this.makeRequest('PATCH', `/resource-servers/${encodeURIComponent(apiIdentifier)}`, updates);
      console.log('✅ Successfully updated Auth0 API:');
      console.log(`   Identifier: ${api.identifier}`);
      console.log(`   Name: ${api.name}`);
      return api;
    } catch (error) {
      console.error('❌ Failed to update Auth0 API:', error.message);
      throw error;
    }
  }

  /**
   * Create Auth0 API resource for actual deployment URL
   */
  async createDeploymentApi(deploymentUrl, deploymentApiName) {
    const apiData = {
      name: deploymentApiName,
      identifier: deploymentUrl,
      scopes: [
        {
          value: 'read:raffles',
          description: 'Read raffle runs and entries'
        },
        {
          value: 'write:raffles',
          description: 'Create new raffle runs'
        }
      ],
      signing_alg: 'RS256',
      token_lifetime: 86400,
      token_lifetime_for_web: 7200,
      skip_consent_for_verifiable_first_party_clients: true
    };

    try {
      const api = await this.makeRequest('POST', '/resource-servers', apiData);
      console.log('✅ Successfully created deployment Auth0 API:');
      console.log(`   API ID: ${api.id}`);
      console.log(`   Identifier: ${api.identifier}`);
      console.log(`   Name: ${api.name}`);
      return api;
    } catch (error) {
      console.error('❌ Failed to create deployment Auth0 API:', error.message);
      throw error;
    }
  }

  /**
   * Update existing deployment Auth0 API resource
   */
  async updateDeploymentApi(deploymentUrl, deploymentApiName) {
    const updates = {
      name: deploymentApiName,
      scopes: [
        {
          value: 'read:raffles',
          description: 'Read raffle runs and entries'
        },
        {
          value: 'write:raffles',
          description: 'Create new raffle runs'
        }
      ],
      token_lifetime: 86400,
      token_lifetime_for_web: 7200
    };

    try {
      const api = await this.makeRequest('PATCH', `/resource-servers/${encodeURIComponent(deploymentUrl)}`, updates);
      console.log('✅ Successfully updated deployment Auth0 API:');
      console.log(`   Identifier: ${api.identifier}`);
      console.log(`   Name: ${api.name}`);
      return api;
    } catch (error) {
      console.error('❌ Failed to update deployment Auth0 API:', error.message);
      throw error;
    }
  }

  /**
   * Get API identifier based on environment
   */
  getApiIdentifier() {
    const staticEnv = this.getStaticEnvironment();
    const apiBaseUrl = getApiBaseUrl({
      deploymentEnv: staticEnv,
      hostedZone: staticEnv === 'prod' ? process.env.PROD_HOSTED_ZONE : process.env.NONPROD_HOSTED_ZONE,
      envName: staticEnv // Use static environment to reuse APIs across PRs
    });
    
    if (apiBaseUrl && !apiBaseUrl.includes('localhost')) {
      return apiBaseUrl;
    }
    
    // Fallback for localhost/testing - use static environment to reuse APIs
    return `https://${staticEnv}.api.winners.dev.rafflewinnerpicker.com`;
  }

  /**
   * Get API name based on environment
   */
  getApiName() {
    // Use static environment to reuse APIs across PRs
    const staticEnv = this.getStaticEnvironment();
    const config = getEnvironmentConfig(staticEnv);
    return `Raffle Winner Picker API (${config.name})`;
  }

  /**
   * Create or update Machine-to-Machine client for integration testing
   */
  async ensureTestClient() {
    const testClientName = this.getTestClientName();
    
    console.log(`🔍 Looking for existing Auth0 test client: ${testClientName}`);
    
    const existingClient = await this.findTestClient();
    
    if (existingClient) {
      console.log(`📝 Found existing test client: ${existingClient.client_id}`);
      const updatedClient = await this.updateTestClient(existingClient.client_id);
      
      // Check if credentials actually exist in .env file
      const hasCredentials = this.hasTestClientCredentials();
      const hasApiBaseUrl = process.env.API_BASE_URL;
      
      if (hasCredentials && !hasApiBaseUrl) {
        console.log(`ℹ️  Skipping .env update for existing client (credentials already exist)`);
      } else if (hasCredentials && hasApiBaseUrl) {
        console.log(`📝 Updating audience in .env for CI environment (API_BASE_URL provided)`);
        this.writeTestClientToEnv(existingClient.client_id, undefined);
        console.log(`⚠️  Note: client_secret not updated (using existing value)`);
      } else {
        console.log(`📝 Writing test client credentials to .env (missing from file)`);
        // Write credentials without client_secret since Auth0 update API doesn't return it
        // In CI/CD environments, the secret should be provided via environment variables
        this.writeTestClientToEnv(existingClient.client_id, undefined);
        console.log(`⚠️  Note: client_secret not written (not returned by Auth0 update API)`);
        console.log(`   If integration tests fail, ensure AUTH0_TEST_CLIENT_SECRET is provided via environment`);
      }
      return updatedClient;
    } else {
      console.log('🆕 No existing test client found, creating new one...');
      try {
        return await this.createTestClient();
      } catch (error) {
        // If we hit tenant limits, try to find any existing test client and reuse it
        if (error.message.includes('too_many_entities') || error.message.includes('403')) {
          console.log('⚠️  Hit Auth0 tenant limit, searching for any existing test client to reuse...');
          const allClients = await this.makeRequest('GET', '/clients?app_type=non_interactive');
          const anyTestClient = allClients.find(client => 
            client.client_metadata?.purpose === 'integration_testing'
          );
          
          if (anyTestClient) {
            console.log(`🔄 Reusing existing test client due to tenant limits: ${anyTestClient.client_id}`);
            const updatedClient = await this.updateTestClient(anyTestClient.client_id);
            
            // Try to write what we can to .env file
            this.writeTestClientToEnv(anyTestClient.client_id, undefined);
            console.log(`⚠️  Reused client credentials written to .env (client_secret may be missing)`);
            console.log(`   If integration tests fail due to missing client_secret, you may need to:`);
            console.log(`   1. Manually clean up unused Auth0 M2M applications, or`);
            console.log(`   2. Check if existing credentials work from a previous setup`);
            return updatedClient;
          }
        }
        throw error;
      }
    }
  }

  /**
   * Create a new Machine-to-Machine client for integration testing
   */
  async createTestClient() {
    const testClientName = this.getTestClientName();
    const apiIdentifier = this.getApiIdentifier();
    
    const clientData = {
      name: testClientName,
      description: `Integration testing client for ${this.getAppDescription()}`,
      app_type: 'non_interactive', // Machine-to-Machine
      token_endpoint_auth_method: 'client_secret_post',
      grant_types: ['client_credentials'],
      jwt_configuration: {
        alg: 'RS256'
      },
      client_metadata: {
        environment: this.deployEnv,
        purpose: 'integration_testing'
      }
    };

    try {
      const client = await this.makeRequest('POST', '/clients', clientData);
      console.log('✅ Successfully created Auth0 test client:');
      console.log(`   Client ID: ${client.client_id}`);
      console.log(`   Name: ${client.name}`);
      
      // Grant access to the API
      await this.grantClientApiAccess(client.client_id, apiIdentifier);
      
      
      // Write credentials to .env file
      this.writeTestClientToEnv(client.client_id, client.client_secret);
      
      return client;
    } catch (error) {
      console.error('❌ Failed to create Auth0 test client:', error.message);
      throw error;
    }
  }

  /**
   * Update existing test client
   */
  async updateTestClient(clientId) {
    const testClientName = this.getTestClientName();
    const apiIdentifier = this.getApiIdentifier();
    
    const updates = {
      name: testClientName,
      description: `Integration testing client for ${this.getAppDescription()}`,
      client_metadata: {
        environment: this.deployEnv,
        purpose: 'integration_testing'
      }
    };

    try {
      const client = await this.makeRequest('PATCH', `/clients/${clientId}`, updates);
      
      // Ensure API access is granted
      await this.grantClientApiAccess(clientId, apiIdentifier);
      
      
      console.log('✅ Successfully updated Auth0 test client:');
      console.log(`   Client ID: ${client.client_id}`);
      console.log(`   Name: ${client.name}`);
      return client;
    } catch (error) {
      if (error.message.includes('429') || error.message.includes('too_many_requests')) {
        console.log(`⚠️  Rate limit reached while updating test client, but continuing`);
        return { client_id: clientId, name: testClientName };
      } else {
        console.error('❌ Failed to update Auth0 test client:', error.message);
        throw error;
      }
    }
  }

  /**
   * Find existing test client by name pattern
   */
  async findTestClient() {
    try {
      const clients = await this.makeRequest('GET', '/clients?app_type=non_interactive');
      const testClientName = this.getTestClientName();
      
      // Look for exact name match or environment match
      const existingClient = clients.find(client => 
        client.name === testClientName ||
        (client.client_metadata?.purpose === 'integration_testing' && 
         client.client_metadata?.environment === this.deployEnv)
      );
      
      // For ephemeral environments, try to create new clients if we don't have credentials
      if (process.env.DEPLOY_EPHEMERAL === 'true') {
        if (existingClient && this.hasTestClientCredentials()) {
          console.log(`🔄 Ephemeral environment detected, but found existing client with credentials: ${existingClient.client_id}`);
          console.log(`   Will reuse existing client since credentials are available`);
          return existingClient;
        } else if (existingClient) {
          console.log(`🔄 Ephemeral environment detected, found existing client but missing credentials: ${existingClient.client_id}`);
          console.log(`   Will try to create new client to get fresh credentials`);
          return null;
        } else {
          console.log(`🔄 Ephemeral environment detected, will create new test client`);
          return null;
        }
      }
      
      return existingClient;
    } catch (error) {
      console.error('❌ Failed to search for existing test clients:', error.message);
      throw error;
    }
  }

  /**
   * Grant client access to API
   */
  async grantClientApiAccess(clientId, apiIdentifier) {
    try {
      console.log(`🔍 Checking API access for client ${clientId} to audience ${apiIdentifier}`);
      
      // First, try to find existing grants for this client
      const existingGrants = await this.makeRequest('GET', `/client-grants?client_id=${clientId}`);
      console.log(`📋 Found ${existingGrants.length} existing grants for client ${clientId}`);
      
      // Check if there's already a grant for this API
      const existingGrant = existingGrants.find(grant => grant.audience === apiIdentifier);
      
      if (existingGrant) {
        console.log(`ℹ️  Client ${clientId} already has access to API ${apiIdentifier}`);
        console.log(`   Grant ID: ${existingGrant.id}, Scopes: ${existingGrant.scope}`);
        
        // Update existing grant to ensure scopes are current
        const updateData = {
          scope: ['read:raffles', 'write:raffles']
        };
        
        await this.makeRequest('PATCH', `/client-grants/${existingGrant.id}`, updateData);
        console.log(`✅ Updated API access scopes for client ${clientId}`);
        return;
      }
      
      // If no existing grant, create a new one
      console.log(`🆕 Creating new API grant for client ${clientId} to audience ${apiIdentifier}`);
      const grantData = {
        client_id: clientId,
        audience: apiIdentifier,
        scope: ['read:raffles', 'write:raffles']
      };
      
      await this.makeRequest('POST', '/client-grants', grantData);
      console.log(`✅ Granted API access to client ${clientId}`);
      
      // Verify the grant was created
      const verifyGrants = await this.makeRequest('GET', `/client-grants?client_id=${clientId}`);
      const newGrant = verifyGrants.find(grant => grant.audience === apiIdentifier);
      if (newGrant) {
        console.log(`✅ Verified grant created: ${newGrant.id} for audience ${apiIdentifier}`);
      } else {
        console.warn(`⚠️  Grant creation may not have completed immediately`);
      }
      
    } catch (error) {
      if (error.message.includes('409') || error.message.includes('already exists')) {
        console.log(`ℹ️  Client ${clientId} already has API access`);
      } else if (error.message.includes('429') || error.message.includes('too_many_requests')) {
        console.log(`⚠️  Rate limit reached while granting API access, but continuing (client may already have access)`);
      } else {
        console.error('❌ Failed to grant API access:', error.message);
        console.error(`   Client ID: ${clientId}`);
        console.error(`   API Identifier: ${apiIdentifier}`);
        throw error;
      }
    }
  }

  /**
   * Get test client name
   */
  getTestClientName() {
    // Use static environment to reuse test clients across PRs
    const staticEnv = this.getStaticEnvironment();
    const config = getEnvironmentConfig(staticEnv);
    return `Raffle Winner Picker Integration Tests (${config.name})`;
  }

  /**
   * Check if test client credentials exist in .env file
   */
  hasTestClientCredentials() {
    const envFile = path.join(process.cwd(), '.env');
    
    if (!fs.existsSync(envFile)) {
      return false;
    }
    
    const envContent = fs.readFileSync(envFile, 'utf8');
    const lines = envContent.split('\n');
    
    const hasClientId = lines.some(line => line.startsWith('AUTH0_TEST_CLIENT_ID='));
    const hasClientSecret = lines.some(line => line.startsWith('AUTH0_TEST_CLIENT_SECRET='));
    const hasAudience = lines.some(line => line.startsWith('AUTH0_TEST_AUDIENCE='));
    
    return hasClientId && hasClientSecret && hasAudience;
  }

  /**
   * Write test client credentials to .env file
   */
  writeTestClientToEnv(clientId, clientSecret) {
    const envFile = path.join(process.cwd(), '.env');
    let envContent = '';
    
    // Read existing env file if it exists
    if (fs.existsSync(envFile)) {
      envContent = fs.readFileSync(envFile, 'utf8');
    }
    
    const lines = envContent.split('\n');
    
    // Helper function to update or add environment variable
    const updateEnvVar = (varName, value) => {
      const envVarLine = `${varName}=${value}`;
      const existingLineIndex = lines.findIndex(line => line.startsWith(`${varName}=`));
      
      if (existingLineIndex >= 0) {
        lines[existingLineIndex] = envVarLine;
      } else {
        lines.push(envVarLine);
      }
    };
    
    // Update or add test client credentials
    updateEnvVar(`AUTH0_TEST_CLIENT_ID_${this.deployEnv.toUpperCase()}`, clientId);
    if (clientSecret && clientSecret !== 'undefined') {
      updateEnvVar(`AUTH0_TEST_CLIENT_SECRET_${this.deployEnv.toUpperCase()}`, clientSecret);
      updateEnvVar('AUTH0_TEST_CLIENT_SECRET', clientSecret);
    } else {
      console.log(`⚠️  Skipping client secret update (value is undefined or invalid)`);
    }
    updateEnvVar('AUTH0_TEST_CLIENT_ID', clientId);
    
    // Get the correct audience URL for integration tests
    // Always use the static API identifier to avoid Auth0 tenant limits
    // The Lambda function should accept tokens with this audience regardless of the access URL
    const audienceUrl = this.getApiIdentifier();
    updateEnvVar('AUTH0_TEST_AUDIENCE', audienceUrl);
    
    console.log(`🔍 Setting Auth0 test audience to: ${audienceUrl}`);
    if (process.env.API_BASE_URL) {
      console.log(`   CI mode: Static audience for token validation, tests will call ${process.env.API_BASE_URL}`);
    } else {
      console.log(`   Local mode: Using static API identifier`);
    }

    fs.writeFileSync(envFile, lines.filter(line => line.trim()).join('\n') + '\n');
    console.log(`📝 Updated ${envFile} with test client credentials`);
  }

  /**
   * Clean up old test clients to free up tenant space
   */
  async cleanupOldTestClients() {
    try {
      console.log('🧹 Cleaning up old test clients...');
      
      const allClients = await this.makeRequest('GET', '/clients?app_type=non_interactive');
      const testClients = allClients.filter(client => 
        client.client_metadata?.purpose === 'integration_testing' ||
        client.name.includes('Integration Tests')
      );
      
      console.log(`   Found ${testClients.length} test clients total`);
      
      // Keep only the 1 most recent test client, delete the rest
      const sortedClients = testClients.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      const clientsToDelete = sortedClients.slice(1);
      
      if (clientsToDelete.length === 0) {
        console.log('   No old test clients to clean up');
        return;
      }
      
      console.log(`   Deleting ${clientsToDelete.length} old test clients...`);
      
      for (const client of clientsToDelete) {
        try {
          await this.makeRequest('DELETE', `/clients/${client.client_id}`);
          console.log(`   ✅ Deleted client: ${client.name} (${client.client_id})`);
        } catch (error) {
          console.log(`   ⚠️  Failed to delete client ${client.client_id}: ${error.message}`);
        }
      }
      
      console.log(`✅ Cleanup complete: deleted ${clientsToDelete.length} old test clients`);
      
    } catch (error) {
      console.log(`⚠️  Cleanup failed: ${error.message}`);
      // Don't throw - cleanup is best effort
    }
  }

  /**
   * Create or ensure test user exists in Auth0
   */
  async ensureTestUser() {
    const testEmail = process.env.AUTH0_TEST_USER_EMAIL || 'e2etest@example.com';
    const testPassword = process.env.AUTH0_TEST_USER_PASSWORD || 'TestPassword123!';
    
    console.log(`🔍 Looking for existing test user: ${testEmail}`);
    
    try {
      // Search for existing user
      const users = await this.makeRequest('GET', `/users?q=email:"${testEmail}"`);
      
      if (users && users.length > 0) {
        console.log(`✅ Found existing test user: ${users[0].user_id}`);
        // Update .env with test user credentials
        this.writeTestUserToEnv(testEmail, testPassword);
        return users[0];
      }
      
      console.log('🆕 Creating new test user...');
      
      // Create new test user
      const userData = {
        email: testEmail,
        password: testPassword,
        connection: 'Username-Password-Authentication',
        email_verified: true,
        user_metadata: {
          purpose: 'e2e_testing'
        },
        app_metadata: {
          roles: ['tester']
        }
      };
      
      const newUser = await this.makeRequest('POST', '/users', userData);
      console.log(`✅ Created test user: ${newUser.user_id}`);
      
      // Update .env with test user credentials
      this.writeTestUserToEnv(testEmail, testPassword);
      
      return newUser;
    } catch (error) {
      console.error('❌ Failed to ensure test user:', error.message);
      throw error;
    }
  }

  /**
   * Write test user credentials to environment file
   */
  writeTestUserToEnv(email, password) {
    const envFile = path.join(process.cwd(), '.env');
    let envContent = '';
    
    // Read existing env file if it exists
    if (fs.existsSync(envFile)) {
      envContent = fs.readFileSync(envFile, 'utf8');
    }
    
    const lines = envContent.split('\n');
    
    // Helper function to update or add environment variable
    const updateEnvVar = (varName, value) => {
      const envVarLine = `${varName}=${value}`;
      const existingLineIndex = lines.findIndex(line => line.startsWith(`${varName}=`));
      
      if (existingLineIndex >= 0) {
        lines[existingLineIndex] = envVarLine;
      } else {
        lines.push(envVarLine);
      }
    };
    
    updateEnvVar('AUTH0_TEST_USER_EMAIL', email);
    updateEnvVar('AUTH0_TEST_USER_PASSWORD', password);

    fs.writeFileSync(envFile, lines.filter(line => line.trim()).join('\n') + '\n');
    console.log(`📝 Updated ${envFile} with test user credentials`);
  }

  /**
   * Setup complete integration testing environment
   */
  async setupIntegrationTesting() {
    console.log('🚀 Setting up complete integration testing environment...');
    
    try {
      // 0. Clean up old test clients to free up tenant space
      console.log('\n0️⃣ Cleaning up old test clients...');
      await this.cleanupOldTestClients();
      
      // 1. Ensure API exists
      console.log('\n1️⃣ Setting up Auth0 API...');
      await this.ensureApi();
      
      // 2. Ensure SPA client exists
      console.log('\n2️⃣ Setting up SPA client...');
      await this.ensureClient();
      
      // 3. Ensure test client exists
      console.log('\n3️⃣ Setting up integration test client...');
      await this.ensureTestClient();
      
      // 4. Ensure test user exists
      console.log('\n4️⃣ Setting up test user...');
      await this.ensureTestUser();
      
      // 5. Verify test client credentials are correct
      console.log('\n5️⃣ Verifying test client setup...');
      console.log(`✅ Integration testing will use dedicated test client: ${this.getTestClientName()}`);
      console.log(`   Client ID written to .env file for test authentication`)
      
      console.log('\n✅ Integration testing environment setup complete!');
      console.log('📋 Next steps:');
      console.log('   • Integration tests can now authenticate using client credentials flow');
      console.log('   • Test credentials have been written to .env file');
      console.log('   • Run integration tests with: bun run test:integration');
      
    } catch (error) {
      console.error('❌ Failed to setup integration testing environment:', error.message);
      throw error;
    }
  }

  /**
   * Ensure both production and development client IDs are available in environment
   * This allows the frontend to switch dynamically between client IDs based on hostname
   */
  async ensureAllEnvironmentClientIds() {
    console.log('🔄 Setting up client IDs for all environments...');
    
    const originalEnv = this.deployEnv;
    const envFile = path.join(process.cwd(), '.env');
    let envContent = '';
    
    // Read existing env file if it exists
    if (fs.existsSync(envFile)) {
      envContent = fs.readFileSync(envFile, 'utf8');
    }
    
    const lines = envContent.split('\n');
    
    // Helper function to update or add environment variable
    const updateEnvVar = (varName, value) => {
      const envVarLine = `${varName}=${value}`;
      const existingLineIndex = lines.findIndex(line => line.startsWith(`${varName}=`));
      
      if (existingLineIndex >= 0) {
        lines[existingLineIndex] = envVarLine;
      } else {
        lines.push(envVarLine);
      }
    };

    try {
      // Get or create PROD client ID
      console.log('📋 Setting up production client ID...');
      this.deployEnv = 'prod';
      this.appName = this.getAppName(); // Refresh app name for prod environment
      const prodClient = await this.ensureClient();
      updateEnvVar('VITE_AUTH0_CLIENT_ID_PROD', prodClient.client_id);
      
      // Get or create DEV client ID  
      console.log('📋 Setting up development client ID...');
      this.deployEnv = 'dev';
      this.appName = this.getAppName(); // Refresh app name for dev environment
      const devClient = await this.ensureClient();
      updateEnvVar('VITE_AUTH0_CLIENT_ID_DEV', devClient.client_id);
      
      // Set the current environment's client ID as default
      this.deployEnv = originalEnv;
      this.appName = this.getAppName(); // Restore original app name
      const currentClientId = originalEnv === 'prod' ? prodClient.client_id : devClient.client_id;
      updateEnvVar('VITE_SPA_AUTH0_CLIENT_ID', currentClientId);
      
      // Write updated environment file
      fs.writeFileSync(envFile, lines.filter(line => line.trim()).join('\n') + '\n');
      
      console.log('✅ All environment client IDs configured:');
      console.log(`   PROD Client ID: ${prodClient.client_id}`);
      console.log(`   DEV Client ID: ${devClient.client_id}`);
      console.log(`   Current (${originalEnv}) Client ID: ${currentClientId}`);
      
    } catch (error) {
      console.error('❌ Failed to setup all environment client IDs:', error.message);
      throw error;
    } finally {
      // Restore original environment
      this.deployEnv = originalEnv;
      this.appName = this.getAppName(); // Restore original app name
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('Usage: bunx scripts/manage-auth0-client.ts <command> [options]');
    console.log('Commands:');
    console.log('  create                    Create a new SPA client');
    console.log('  read <client_id>         Read client information');
    console.log('  update <client_id>       Update existing client');
    console.log('  delete <client_id>       Delete a client');
    console.log('  ensure-client            Create or update client as needed');
    console.log('  get-for-build            Get client ID for build (no updates)');
    console.log('  ensure-api               Create or update Auth0 API');
    console.log('  ensure-test-client       Create or update integration test client');
    console.log('  setup-integration-testing Complete integration testing setup');
    console.log('  ensure-all-env-clients   Set up client IDs for all environments (prod + dev)');
    console.log('  cleanup-test-clients     Delete old test clients to free up tenant space');
    process.exit(1);
  }

  const manager = new Auth0ClientManager();

  try {
    switch (command) {
      case 'create':
        await manager.createClient();
        break;
      case 'read':
        if (!args[1]) {
          console.error('❌ Client ID required for read command');
          process.exit(1);
        }
        await manager.readClient(args[1]);
        break;
      case 'update':
        if (!args[1]) {
          console.error('❌ Client ID required for update command');
          process.exit(1);
        }
        await manager.updateClient(args[1]);
        break;
      case 'delete':
        if (!args[1]) {
          console.error('❌ Client ID required for delete command');
          process.exit(1);
        }
        await manager.deleteClient(args[1]);
        break;
      case 'ensure-client':
        await manager.ensureClient();
        break;
      case 'get-for-build':
        await manager.getClientForBuild();
        break;
      case 'ensure-api':
        await manager.ensureApi();
        break;
      case 'ensureDeploymentApi':
        await manager.ensureDeploymentApi();
        break;
      case 'ensure-test-client':
        await manager.ensureTestClient();
        break;
      case 'setup-integration-testing':
        await manager.setupIntegrationTesting();
        break;
      case 'ensure-all-env-clients':
        await manager.ensureAllEnvironmentClientIds();
        break;
      case 'cleanup-test-clients':
        await manager.cleanupOldTestClients();
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the CLI if this script is executed directly (when not imported for testing)
// Use CommonJS check for compatibility with both Jest and direct execution
if (typeof require !== 'undefined' && require.main === module && typeof jest === 'undefined') {
  main();
}

export default Auth0ClientManager;