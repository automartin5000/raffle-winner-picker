import { test, expect } from '@playwright/test';

test.describe('Auth0 Configuration Debug', () => {
  test('should log Auth0 environment detection details', async ({ page }) => {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
    
    // Capture console logs
    const logs: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'log' && msg.text().includes('Auth0')) {
        logs.push(msg.text());
      }
    });
    
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Trigger Auth0 initialization by checking if Auth0 config is logged
    // The auth.ts file should log configuration details when initAuth0() is called
    
    await page.waitForTimeout(2000); // Give time for auth initialization
    
    // Check if we got Auth0 configuration logs
    console.log('=== Auth0 Configuration Logs from Browser ===');
    logs.forEach(log => console.log(log));
    console.log('============================================');
    
    // Also check what environment variables are available in the browser
    const envDebug = await page.evaluate(() => {
      return {
        hostname: window.location.hostname,
        origin: window.location.origin,
        // Check what import.meta.env contains in the browser
        env: typeof (globalThis as any).import !== 'undefined' ? (globalThis as any).import.meta?.env : 'import.meta not available'
      };
    });
    
    console.log('=== Browser Environment Debug ===');
    console.log('Hostname:', envDebug.hostname);
    console.log('Origin:', envDebug.origin);
    console.log('Environment:', envDebug.env);
    console.log('==================================');
    
    // Test should always pass - we're using this for debugging
    expect(true).toBe(true);
  });
  
  test('should show Auth0 client selection in browser console', async ({ page }) => {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
    
    // Capture all console logs related to Auth0
    const authLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Auth0') || text.includes('Client ID') || text.includes('Environment Detection')) {
        authLogs.push(text);
      }
    });
    
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Try to trigger the sign-in button to see what Auth0 configuration is used
    const signInButton = page.getByRole('button', { name: /sign in to continue/i });
    if (await signInButton.isVisible()) {
      // Don't actually click - just having the page load should trigger Auth0 init logging
      await page.waitForTimeout(1000);
    }
    
    console.log('=== Auth0 Client Selection Debug ===');
    authLogs.forEach(log => console.log(log));
    console.log('====================================');
    
    // Check if Auth0 logs show environment detection
    const hasEnvironmentDetection = authLogs.some(log => 
      log.includes('Environment Detection') || log.includes('Client ID')
    );
    
    // Log whether we found environment detection logs
    console.log('Found Auth0 environment detection logs:', hasEnvironmentDetection);
    
    expect(true).toBe(true);
  });
});