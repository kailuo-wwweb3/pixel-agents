import { test, expect } from '@playwright/test';

test('App boots without console errors', async ({ page }) => {
  const errors: string[] = [];

  // Listen for console errors and push them to our array
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Listen for uncaught page exceptions
  page.on('pageerror', (exception) => {
    errors.push(`Uncaught exception: ${exception.message}`);
  });

  // Navigate to the Vite app
  await page.goto('/');

  // Wait for the canvas to render (proving the React tree mounted)
  await page.waitForSelector('canvas');

  // If there are errors, format them nicely for the LLM to read and fail the test
  if (errors.length > 0) {
    throw new Error(`Browser encountered errors:\n${errors.join('\n')}`);
  }

  // Assert the canvas exists
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
});
