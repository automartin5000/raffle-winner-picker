import { describe, it, expect } from 'vitest';

describe('Environment Variable Debug', () => {
  it('should show what environment variables are available', () => {
    console.log('=== Environment Variables Debug ===');
    console.log('import.meta.env:', import.meta.env);
    console.log('VITE_NONPROD_HOSTED_ZONE:', import.meta.env.VITE_NONPROD_HOSTED_ZONE);
    console.log('VITE_PROD_HOSTED_ZONE:', import.meta.env.VITE_PROD_HOSTED_ZONE);
    console.log('VITE_AUTH0_CLIENT_ID_PROD:', import.meta.env.VITE_AUTH0_CLIENT_ID_PROD);
    console.log('VITE_AUTH0_CLIENT_ID_DEV:', import.meta.env.VITE_AUTH0_CLIENT_ID_DEV);
    console.log('VITE_SPA_AUTH0_CLIENT_ID:', import.meta.env.VITE_SPA_AUTH0_CLIENT_ID);
    console.log('===============================');
    
    // Just pass the test - we're using this for debugging
    expect(true).toBe(true);
  });
});