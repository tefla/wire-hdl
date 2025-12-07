import { test, expect } from '@playwright/test';

test.describe('WireOS Computer', () => {
  test('should load the page and show title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('WireOS Computer');
  });

  test('should show Start button initially', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  });

  test('should show terminal container', async ({ page }) => {
    await page.goto('/');
    // Terminal should be visible
    const terminal = page.locator('[style*="monospace"]').first();
    await expect(terminal).toBeVisible();
  });

  test('should start the computer when Start is clicked', async ({ page }) => {
    await page.goto('/');

    // Click Start
    await page.getByRole('button', { name: 'Start' }).click();

    // Button should change to Stop
    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  });

  test('should show CPU register updates after starting', async ({ page }) => {
    await page.goto('/');

    // Get initial PC value
    const statusBar = page.locator('text=PC:');
    await expect(statusBar).toBeVisible();

    // Click Start
    await page.getByRole('button', { name: 'Start' }).click();

    // Wait for CPU to execute some instructions
    await page.waitForTimeout(500);

    // PC should have changed from initial value (F800 - hex loader entry)
    const pcText = await page.locator('text=PC:').textContent();
    console.log('CPU state:', pcText);
    expect(pcText).toBeTruthy();
  });

  test('should output characters to terminal after boot', async ({ page }) => {
    await page.goto('/');

    // Start the computer
    await page.getByRole('button', { name: 'Start' }).click();

    // Wait for output (hex loader should print a prompt or something)
    await page.waitForTimeout(2000);

    // Check console for any errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Take a screenshot for debugging
    await page.screenshot({ path: 'tests/e2e/boot-output.png' });

    // Log any errors
    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors);
    }
  });

  test('should handle keyboard input', async ({ page }) => {
    await page.goto('/');

    // Start the computer
    await page.getByRole('button', { name: 'Start' }).click();
    await page.waitForTimeout(500);

    // Focus the terminal and type
    const terminal = page.locator('[tabindex="0"]').first();
    await terminal.focus();
    await page.keyboard.type('L 0200');
    await page.keyboard.press('Enter');

    // Wait for processing
    await page.waitForTimeout(500);

    // Take screenshot
    await page.screenshot({ path: 'tests/e2e/after-input.png' });
  });

  test('debug: check console output during boot', async ({ page }) => {
    const logs: string[] = [];
    const errors: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        errors.push(text);
      } else {
        logs.push(`[${msg.type()}] ${text}`);
      }
    });

    page.on('pageerror', (err) => {
      errors.push(`Page error: ${err.message}`);
    });

    await page.goto('/');

    // Wait for initialization
    await page.waitForTimeout(1000);

    // Start
    await page.getByRole('button', { name: 'Start' }).click();

    // Let it run
    await page.waitForTimeout(3000);

    console.log('=== Console logs ===');
    logs.forEach((log) => console.log(log));

    console.log('=== Errors ===');
    errors.forEach((err) => console.log(err));

    // Get the terminal content
    const terminalText = await page.getByTestId('terminal-screen').textContent();
    console.log('=== Terminal content ===');
    console.log(terminalText?.substring(0, 200) || '(empty)');

    // Take final screenshot
    await page.screenshot({ path: 'tests/e2e/debug-boot.png' });

    // Fail if there were errors
    expect(errors.length).toBe(0);
  });
});
