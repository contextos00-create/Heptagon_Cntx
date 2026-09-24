import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];

  try {
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, '01_app_loaded.png'), fullPage: false });
    results.push('loaded');

    // Open Google import
    const googleBtn = page.getByRole('button', { name: /Google/i }).first();
    await googleBtn.click({ timeout: 10000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, '02_google_import_modal.png'), fullPage: false });
    results.push('modal-open');

    // Load sample notes
    await page.getByRole('button', { name: /Load sample Google notes/i }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, '03_sample_notes_preview.png'), fullPage: false });
    results.push('sample-loaded');

    // Organize with AI
    await page.getByRole('button', { name: /Organize with AI/i }).click();
    await page.waitForSelector('text=Intelligence overview', { timeout: 30000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, '04_ai_organize_results.png'), fullPage: false });
    results.push('organized');

    // Place on canvas
    await page.getByRole('button', { name: /Place on canvas/i }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, '05_canvas_after_placement.png'), fullPage: false });
    results.push('placed');

    // Chat about Google notes
    const summarize = page.getByRole('button', { name: /Summarize Google notes/i });
    if (await summarize.count()) {
      await summarize.click();
    } else {
      const input = page.locator('input[placeholder*="Ask"], input[placeholder*="ask"], form input').last();
      await input.fill('Summarize the main themes across my imported Google notes');
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT, '06_chat_google_summary.png'), fullPage: false });
    results.push('chat');

    console.log(JSON.stringify({ ok: true, results }, null, 2));
  } catch (err) {
    await page.screenshot({ path: path.join(OUT, '99_error_state.png'), fullPage: false }).catch(() => {});
    console.error('TEST_FAILED', err);
    console.log(JSON.stringify({ ok: false, results, error: String(err) }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
