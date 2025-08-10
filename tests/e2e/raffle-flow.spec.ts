import { test, expect } from '@playwright/test';

const DEPLOYED_APP_URL = 'https://local.dev.rafflewinnerpicker.com';
const API_BASE_URL = 'https://local.api.winners.dev.rafflewinnerpicker.com';

test.describe('Raffle Winner Picker E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEPLOYED_APP_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should load the homepage and display key elements', async ({ page }) => {
    await expect(page).toHaveTitle(/Raffle Winner Picker/i);
    
    await expect(page.getByRole('heading', { name: /raffle winner picker/i })).toBeVisible();
    
    await expect(page.getByRole('button', { name: /configure raffle/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /start raffle/i })).toBeVisible();
  });

  test('should navigate to configure page', async ({ page }) => {
    await page.getByRole('button', { name: /configure raffle/i }).click();
    
    await expect(page).toHaveURL(/.*\/configure/);
    await expect(page.getByRole('heading', { name: /configure raffle/i })).toBeVisible();
    
    await expect(page.getByText(/upload csv file/i)).toBeVisible();
    await expect(page.getByText(/select winner count/i)).toBeVisible();
  });

  test('should upload CSV file and configure raffle', async ({ page }) => {
    await page.getByRole('button', { name: /configure raffle/i }).click();
    
    const csvContent = `Name,Email
John Doe,john@example.com
Jane Smith,jane@example.com
Bob Johnson,bob@example.com
Alice Brown,alice@example.com`;
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-participants.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    
    await page.getByRole('combobox').selectOption('2');
    
    await expect(page.getByText(/4 participants loaded/i)).toBeVisible();
    await expect(page.getByText(/2 winners will be selected/i)).toBeVisible();
    
    await page.getByRole('button', { name: /save configuration/i }).click();
    
    await expect(page).toHaveURL(/.*\/raffle/);
    await expect(page.getByRole('heading', { name: /raffle/i })).toBeVisible();
  });

  test('should run raffle and display winners', async ({ page }) => {
    await page.goto(`${DEPLOYED_APP_URL}/configure`);
    
    const csvContent = `Name,Email
John Doe,john@example.com
Jane Smith,jane@example.com
Bob Johnson,bob@example.com
Alice Brown,alice@example.com
Charlie Wilson,charlie@example.com`;
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-participants.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    
    await page.getByRole('combobox').selectOption('3');
    await page.getByRole('button', { name: /save configuration/i }).click();
    
    await page.waitForURL(/.*\/raffle/);
    
    const runRaffleButton = page.getByRole('button', { name: /run raffle/i });
    await expect(runRaffleButton).toBeVisible();
    await runRaffleButton.click();
    
    await expect(page.getByText(/winners selected/i)).toBeVisible({ timeout: 10000 });
    
    const winnersList = page.locator('[data-testid="winners-list"]');
    await expect(winnersList).toBeVisible();
    
    const winners = await winnersList.locator('[data-testid="winner-item"]').count();
    expect(winners).toBe(3);
  });

  test('should display run history', async ({ page }) => {
    await page.goto(`${DEPLOYED_APP_URL}/raffle`);
    
    const historySection = page.locator('[data-testid="run-history"]');
    await expect(historySection).toBeVisible();
    
    await expect(page.getByText(/raffle history/i)).toBeVisible();
  });

  test('should handle invalid CSV format gracefully', async ({ page }) => {
    await page.goto(`${DEPLOYED_APP_URL}/configure`);
    
    const invalidCsvContent = `Invalid,Format
No Email Column,Something`;
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'invalid.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(invalidCsvContent),
    });
    
    await expect(page.getByText(/error/i)).toBeVisible({ timeout: 5000 });
  });

  test('should validate winner count selection', async ({ page }) => {
    await page.goto(`${DEPLOYED_APP_URL}/configure`);
    
    const csvContent = `Name,Email
John Doe,john@example.com
Jane Smith,jane@example.com`;
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'small-list.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    
    const selectElement = page.getByRole('combobox');
    await selectElement.selectOption('5');
    
    await expect(page.getByText(/cannot select more winners than participants/i)).toBeVisible();
  });

  test('should export winners to CSV', async ({ page }) => {
    await page.goto(`${DEPLOYED_APP_URL}/configure`);
    
    const csvContent = `Name,Email
John Doe,john@example.com
Jane Smith,jane@example.com
Bob Johnson,bob@example.com`;
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'participants.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    
    await page.getByRole('combobox').selectOption('2');
    await page.getByRole('button', { name: /save configuration/i }).click();
    
    await page.getByRole('button', { name: /run raffle/i }).click();
    await expect(page.getByText(/winners selected/i)).toBeVisible({ timeout: 10000 });
    
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export winners/i }).click();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/winners.*\.csv$/);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.route(`${API_BASE_URL}/**`, route => route.abort());
    
    await page.goto(`${DEPLOYED_APP_URL}/raffle`);
    
    await page.getByRole('button', { name: /run raffle/i }).click();
    
    await expect(page.getByText(/error.*network/i)).toBeVisible({ timeout: 10000 });
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(DEPLOYED_APP_URL);
    
    await expect(page.getByRole('heading', { name: /raffle winner picker/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /configure raffle/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /start raffle/i })).toBeVisible();
    
    await page.getByRole('button', { name: /configure raffle/i }).click();
    await expect(page).toHaveURL(/.*\/configure/);
    
    await expect(page.getByText(/upload csv file/i)).toBeVisible();
  });

  test('should persist raffle configuration across page refreshes', async ({ page }) => {
    await page.goto(`${DEPLOYED_APP_URL}/configure`);
    
    const csvContent = `Name,Email
Test User,test@example.com
Another User,another@example.com`;
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'persistent.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    
    await page.getByRole('combobox').selectOption('1');
    await page.getByRole('button', { name: /save configuration/i }).click();
    
    await page.reload();
    
    await expect(page.getByText(/2 participants/i)).toBeVisible();
  });
});