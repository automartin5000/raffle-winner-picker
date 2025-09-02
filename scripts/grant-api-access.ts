#!/usr/bin/env node
// Grant API access to management client for integration testing

import * as https from 'https';

// Type definitions
interface Auth0TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface Auth0API {
  id: string;
  name: string;
  identifier: string;
  scopes?: Array<{ value: string; description: string }>;
}

interface Auth0Grant {
  id: string;
  client_id: string;
  audience: string;
  scope: string[];
}

class Auth0Manager {
  public readonly domain: string;
  public readonly clientId: string;
  public readonly clientSecret: string;
  public readonly apiAudience: string;
  private accessToken: string | null = null;

  constructor() {
    this.domain = process.env.AUTH0_DOMAIN?.replace('https://', '').replace('/', '') || '';
    this.clientId = process.env.AUTH0_CLIENT_ID || '';
    this.clientSecret = process.env.AUTH0_CLIENT_SECRET || '';
    this.apiAudience = process.env.AUTH0_TEST_AUDIENCE || 'https://local.api.winners.dev.rafflewinnerpicker.com';
    
    if (!this.domain || !this.clientId || !this.clientSecret) {
      console.error('❌ Missing required Auth0 environment variables');
      process.exit(1);
    }
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;

    const data = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      audience: `https://${this.domain}/api/v2/`
    });

    const options = {
      hostname: this.domain,
      port: 443,
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.toString().length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            const tokenData: Auth0TokenResponse = JSON.parse(body);
            this.accessToken = tokenData.access_token;
            resolve(this.accessToken);
          } else {
            reject(new Error(`Token request failed: ${res.statusCode} ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data.toString());
      req.end();
    });
  }

  async makeRequest(method: string, path: string, data: any = null): Promise<any> {
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

  async grantApiAccess(): Promise<Auth0Grant> {
    console.log('🔐 Granting API access to management client...');
    console.log(`   Client ID: ${this.clientId}`);
    console.log(`   API Audience: ${this.apiAudience}`);
    
    try {
      // Get all APIs to find the API ID
      const apis: Auth0API[] = await this.makeRequest('GET', '/resource-servers');
      const api = apis.find(api => api.identifier === this.apiAudience);
      
      if (!api) {
        throw new Error(`API not found: ${this.apiAudience}`);
      }
      
      console.log(`✅ Found API: ${api.name} (ID: ${api.id})`);
      
      // Check existing grants
      const grants: Auth0Grant[] = await this.makeRequest('GET', '/client-grants');
      const existingGrant = grants.find(grant => 
        grant.client_id === this.clientId && grant.audience === this.apiAudience
      );
      
      if (existingGrant) {
        console.log(`✅ Grant already exists: ${existingGrant.id}`);
        return existingGrant;
      }
      
      // Create new grant
      const grantData = {
        client_id: this.clientId,
        audience: this.apiAudience,
        scope: ['read:raffles', 'write:raffles']
      };
      
      const grant: Auth0Grant = await this.makeRequest('POST', '/client-grants', grantData);
      console.log(`✅ Created grant: ${grant.id}`);
      console.log(`   Scopes: ${grant.scope.join(', ')}`);
      
      return grant;
      
    } catch (error) {
      console.error('❌ Failed to grant API access:', error.message);
      throw error;
    }
  }
}

async function main(): Promise<void> {
  const manager = new Auth0Manager();
  await manager.grantApiAccess();
  console.log('🎉 Management client now has access to the API!');
}

// Run the CLI if this script is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}