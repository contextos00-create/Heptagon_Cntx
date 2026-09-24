import { chromium } from 'playwright';
import fs from 'fs';
const outDir = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);
const dock = page.locator('[aria-label="Canvas AI forever composer"]');
await page.screenshot({ path: `${outDir}/ai-dock-framed-01-collapsed.png`, fullPage: false });

await dock.locator('textarea').click();
await dock.locator('textarea').fill('What is on this board?');
await dock.locator('button[aria-label="Send"]').click();
await page.waitForTimeout(2000);
await page.screenshot({ path: `${outDir}/ai-dock-framed-02-open.png`, fullPage: false });

// Click away on canvas
await page.mouse.click(200, 200);
await page.waitForTimeout(5200);
await page.screenshot({ path: `${outDir}/ai-dock-framed-03-folded.png`, fullPage: false });
const maxH = await dock.evaluate((el) => {
  const panel = el.querySelector('[aria-hidden]');
  return panel ? getComputedStyle(panel).maxHeight : 'n/a';
});
console.log('after fold maxHeight', maxH);
await browser.close();
