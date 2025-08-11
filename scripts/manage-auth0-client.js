const https = require('https');
const fs = require('fs');
const path = require('path');

// Import shared environment configuration
const { 
  resolveDeploymentEnvironment, 
  getEnvironmentConfig, 
  getFrontendUrl,
  getApiBaseUrl,
  DEPLOYMENT_ENVIRONMENTS
} = require(path.resolve(process.cwd(), 'shared/environments.js'));

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
 * bunx scripts/manage-auth0-client.js create
 * bunx scripts/manage-auth0-client.js read <client_id>
 * bunx scripts/manage-auth0-client.js update <client_id>
 * bunx scripts/manage-auth0-client.js delete <client_id>
 * bunx scripts/manage-auth0-client.js ensure-client
 * bunx scripts/manage-auth0-client.js ensure-api
 * bunx scripts/manage-auth0-client.js ensure-test-client
 * bunx scripts/manage-auth0-client.js setup-integration-testing
 */

class Auth0ClientManager {
  constructor() {
    this.domain = process.env.AUTH0_DOMAIN;
    this.clientId = process.env.AUTH0_CLIENT_ID;
    this.clientSecret = process.env.AUTH0_CLIENT_SECRET;
    this.deployEnv = process.env.DEPLOY_ENV;
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
  getCallbackUrl() {
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
  getAllCallbackUrls() {
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
  getAllowedOrigins() {
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
      grant_types: ['authorization_code', 'implicit', 'refresh_token'],
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
    
    try {
      // Check if API already exists
      const existingApi = await this.makeRequest('GET', `/resource-servers/${encodeURIComponent(apiIdentifier)}`);
      console.log(`📝 Found existing API: ${existingApi.name}`);
      
      // Update the API
      const updatedApi = await this.updateApi(apiIdentifier);
      return updatedApi;
    } catch (error) {
      if (error.message.includes('404')) {
        console.log('🆕 No existing API found, creating new one...');
        return await this.createApi();
      } else {
        throw error;
      }
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
   * Get API identifier based on environment
   */
  getApiIdentifier() {
    const staticEnv = this.getStaticEnvironment();
    const apiBaseUrl = getApiBaseUrl({
      deploymentEnv: staticEnv,
      hostedZone: staticEnv === 'prod' ? process.env.PROD_HOSTED_ZONE : process.env.NONPROD_HOSTED_ZONE,
      envName: this.deployEnv // Use actual deployment environment, not static environment
    });
    
    if (apiBaseUrl && !apiBaseUrl.includes('localhost')) {
      return apiBaseUrl;
    }
    
    // Fallback for localhost/testing - use actual deployment environment
    return `https://${this.deployEnv}.api.winners.dev.rafflewinnerpicker.com`;
  }

  /**
   * Get API name based on environment
   */
  getApiName() {
    const config = getEnvironmentConfig(this.deployEnv);
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
      this.writeTestClientToEnv(updatedClient.client_id, updatedClient.client_secret);
      return updatedClient;
    } else {
      console.log('🆕 No existing test client found, creating new one...');
      return await this.createTestClient();
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
      console.error('❌ Failed to update Auth0 test client:', error.message);
      throw error;
    }
  }

  /**
   * Find existing test client by name pattern
   */
  async findTestClient() {
    try {
      const clients = await this.makeRequest('GET', '/clients?app_type=non_interactive');
      const testClientName = this.getTestClientName();
      
      return clients.find(client => 
        client.name === testClientName ||
        (client.client_metadata?.purpose === 'integration_testing' && 
         client.client_metadata?.environment === this.deployEnv)
      );
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
      // First, try to find existing grants for this client
      const existingGrants = await this.makeRequest('GET', `/client-grants?client_id=${clientId}`);
      
      // Check if there's already a grant for this API
      const existingGrant = existingGrants.find(grant => grant.audience === apiIdentifier);
      
      if (existingGrant) {
        console.log(`ℹ️  Client ${clientId} already has access to API ${apiIdentifier}`);
        
        // Update existing grant to ensure scopes are current
        const updateData = {
          scope: ['read:raffles', 'write:raffles']
        };
        
        await this.makeRequest('PATCH', `/client-grants/${existingGrant.id}`, updateData);
        console.log(`✅ Updated API access scopes for client ${clientId}`);
        return;
      }
      
      // If no existing grant, create a new one
      const grantData = {
        client_id: clientId,
        audience: apiIdentifier,
        scope: ['read:raffles', 'write:raffles']
      };
      
      await this.makeRequest('POST', '/client-grants', grantData);
      console.log(`✅ Granted API access to client ${clientId}`);
    } catch (error) {
      if (error.message.includes('409') || error.message.includes('already exists')) {
        console.log(`ℹ️  Client ${clientId} already has API access`);
      } else {
        console.error('❌ Failed to grant API access:', error.message);
        throw error;
      }
    }
  }

  /**
   * Get test client name
   */
  getTestClientName() {
    const config = getEnvironmentConfig(this.deployEnv);
    return `Raffle Winner Picker Integration Tests (${config.name})`;
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
    updateEnvVar(`AUTH0_TEST_CLIENT_SECRET_${this.deployEnv.toUpperCase()}`, clientSecret);
    updateEnvVar('AUTH0_TEST_CLIENT_ID', clientId);
    updateEnvVar('AUTH0_TEST_CLIENT_SECRET', clientSecret);
    updateEnvVar('AUTH0_TEST_AUDIENCE', this.getApiIdentifier());

    fs.writeFileSync(envFile, lines.filter(line => line.trim()).join('\n') + '\n');
    console.log(`📝 Updated ${envFile} with test client credentials`);
  }

  /**
   * Setup complete integration testing environment
   */
  async setupIntegrationTesting() {
    console.log('🚀 Setting up complete integration testing environment...');
    
    try {
      // 1. Ensure API exists
      console.log('\n1️⃣ Setting up Auth0 API...');
      await this.ensureApi();
      
      // 2. Ensure SPA client exists
      console.log('\n2️⃣ Setting up SPA client...');
      await this.ensureClient();
      
      // 3. Ensure test client exists
      console.log('\n3️⃣ Setting up integration test client...');
      await this.ensureTestClient();
      
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
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('Usage: bunx scripts/manage-auth0-client.cjs <command> [options]');
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
      case 'ensure-test-client':
        await manager.ensureTestClient();
        break;
      case 'setup-integration-testing':
        await manager.setupIntegrationTesting();
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

if (require.main === module) {
  main();
}

module.exports = Auth0ClientManager;