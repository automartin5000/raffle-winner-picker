import { test, expect } from '@playwright/test';

test('should test environment detection directly in browser', async ({ page }) => {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
  
  // Capture all console logs
  const allLogs: string[] = [];
  page.on('console', msg => {
    allLogs.push(`${msg.type()}: ${msg.text()}`);
  });
  
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  
  // Test what environment variables are available in the browser
  const envTest = await page.evaluate(() => {
    const hostname = window.location.hostname;
    return {
      hostname,
      windowKeys: Object.keys(window).filter(key => key.includes('VITE') || key.includes('AUTH0')),
    };
  });
  
  console.log('=== Direct Environment Detection Test ===');
  console.log('Hostname:', envTest.hostname);
  console.log('Window keys with VITE/AUTH0:', envTest.windowKeys);
  console.log('==========================================');
  
  console.log('=== Browser Console Logs ===');
  allLogs.forEach(log => console.log(log));
  console.log('==============================');
  
  expect(true).toBe(true);
});