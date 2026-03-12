import { test, expect } from '@playwright/test';

test('Canvas visual rendering matches baseline', async ({ page }) => {
  await page.goto('/');

  // Wait a brief moment to ensure sprites and the initial game loop frame are drawn
  await page.waitForTimeout(500);

  const canvas = page.locator('canvas');

  // This will take a screenshot of JUST the canvas element.
  // On the first run, it generates a baseline image.
  // On subsequent runs, if the pixel difference is too high, it fails.
  await expect(canvas).toHaveScreenshot('office-canvas-baseline.png', {
    maxDiffPixelRatio: 0.05, // Allow 5% variance for anti-aliasing differences
  });
});
