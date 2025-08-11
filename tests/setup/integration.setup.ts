import { jest } from '@jest/globals';
import { getAuth0Credentials, getAccessToken } from '../utils/auth';

beforeAll(async () => {
  jest.setTimeout(30000);
  
  console.log('Setting up integration tests...');
  console.log(`API Base URL: ${process.env.API_BASE_URL || 'https://local.api.winners.dev.rafflewinnerpicker.com'}`);
  
  // Verify Auth0 credentials are available
  try {
    const credentials = getAuth0Credentials();
    console.log(`✅ Auth0 credentials loaded for domain: ${credentials.domain}`);
    console.log(`   Client ID: ${credentials.clientId}`);
    console.log(`   Audience: ${credentials.audience}`);
    
    // Test authentication
    console.log('🔐 Testing Auth0 authentication...');
    await getAccessToken();
    console.log('✅ Auth0 authentication successful');
    
  } catch (error) {
    console.error('❌ Auth0 setup failed:', error);
    console.error('Please run: bun run scripts/manage-auth0-client.js setup-integration-testing');
    throw error;
  }
  
  const apiHealthCheck = async () => {
    try {
      const response = await fetch(process.env.API_BASE_URL || 'https://local.api.winners.dev.rafflewinnerpicker.com');
      // Note: We expect 401 here since health check doesn't include auth headers
      console.log(`API health check response: ${response.status}`);
      if (response.status === 401) {
        console.log('✅ API is accessible (returns 401 as expected for unauthenticated requests)');
      } else if (response.ok) {
        console.log('✅ API health check passed');
      } else {
        console.warn('⚠️  API health check returned unexpected status, but continuing with tests...');
      }
    } catch (error) {
      console.warn('⚠️  API health check failed with error:', error);
      console.warn('Continuing with tests anyway...');
    }
  };
  
  await apiHealthCheck();
});

afterAll(async () => {
  console.log('Integration tests completed');
});

export {};