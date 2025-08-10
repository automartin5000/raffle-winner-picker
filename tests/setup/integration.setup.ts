import { jest } from '@jest/globals';

beforeAll(async () => {
  jest.setTimeout(30000);
  
  console.log('Setting up integration tests...');
  console.log(`API Base URL: ${process.env.API_BASE_URL || 'https://local.api.winners.dev.rafflewinnerpicker.com'}`);
  
  const apiHealthCheck = async () => {
    try {
      const response = await fetch(process.env.API_BASE_URL || 'https://local.api.winners.dev.rafflewinnerpicker.com');
      if (!response.ok) {
        console.warn('API health check failed, but continuing with tests...');
      } else {
        console.log('API health check passed');
      }
    } catch (error) {
      console.warn('API health check failed with error:', error);
      console.warn('Continuing with tests anyway...');
    }
  };
  
  await apiHealthCheck();
});

afterAll(async () => {
  console.log('Integration tests completed');
});

export {};