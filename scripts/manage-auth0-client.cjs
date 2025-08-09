#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Import shared environment configuration
const { 
  resolveDeploymentEnvironment, 
  getEnvironmentConfig, 
  getFrontendUrl
} = require('../lib/environments.cjs');

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
 * node scripts/manage-auth0-client.js create
 * node scripts/manage-auth0-client.js read <client_id>
 * node scripts/manage-auth0-client.js update <client_id>
 * node scripts/manage-auth0-client.js delete <client_id>
 * node scripts/manage-auth0-client.js ensure-client
 */

class Auth0ClientManager {
  constructor() {
    this.domain = process.env.AUTH0_DOMAIN;
    this.clientId = process.env.AUTH0_CLIENT_ID;
    this.clientSecret = process.env.AUTH0_CLIENT_SECRET;
    this.deployEnv = this.getStaticEnvironment();
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
   * Get the standardized app name and description from shared config
   */
  getAppName() {
    const config = getEnvironmentConfig(this.deployEnv);
    return config.auth0ClientName;
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
    const clientData = {
      name: this.appName,
      description: this.getAppDescription(),
      app_type: 'spa',
      logo_uri: this.callbackUrl ? `${new URL(this.callbackUrl).origin}/favicon.svg` : undefined, // TODO: Update with actual logo URL
      callbacks: this.callbackUrl ? [this.callbackUrl] : [],
      allowed_logout_urls: this.callbackUrl ? [this.callbackUrl] : [],
      web_origins: this.callbackUrl ? [new URL(this.callbackUrl).origin] : [],
      allowed_origins: this.callbackUrl ? [new URL(this.callbackUrl).origin] : [],
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
    const updates = {
      name: this.appName,
      callbacks: this.callbackUrl ? [this.callbackUrl] : [],
      allowed_logout_urls: this.callbackUrl ? [this.callbackUrl] : [],
      web_origins: this.callbackUrl ? [new URL(this.callbackUrl).origin] : [],
      allowed_origins: this.callbackUrl ? [new URL(this.callbackUrl).origin] : [],
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
    const envFile = path.join(process.cwd(), '.env.local');
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
    const envVarName = `VITE_AUTH0_CLIENT_ID_${this.deployEnv.toUpperCase()}`;
    updateEnvVar(envVarName, clientId);
    
    // Also add the current environment's client ID as the default
    updateEnvVar('VITE_AUTH0_CLIENT_ID', clientId);
    
    // Add environment metadata for Vite
    updateEnvVar('VITE_DEPLOY_ENV', this.deployEnv);
    updateEnvVar('VITE_DEPLOY_EPHEMERAL', process.env.DEPLOY_EPHEMERAL || 'false');
    
    // Add hosted zone environment variables for frontend API URL derivation
    if (process.env.PROD_HOSTED_ZONE) {
      updateEnvVar('VITE_PROD_HOSTED_ZONE', process.env.PROD_HOSTED_ZONE);
    }
    if (process.env.NONPROD_HOSTED_ZONE) {
      updateEnvVar('VITE_NONPROD_HOSTED_ZONE', process.env.NONPROD_HOSTED_ZONE);
    }
    
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
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log('Usage: node scripts/manage-auth0-client.cjs <command> [options]');
    console.log('Commands:');
    console.log('  create                    Create a new SPA client');
    console.log('  read <client_id>         Read client information');
    console.log('  update <client_id>       Update existing client');
    console.log('  delete <client_id>       Delete a client');
    console.log('  ensure-client            Create or update client as needed');
    console.log('  get-for-build            Get client ID for build (no updates)');
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