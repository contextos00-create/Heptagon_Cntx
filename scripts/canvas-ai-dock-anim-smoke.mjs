import { chromium } from 'playwright';
import fs from 'fs';
const outDir = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1200);
const dock = page.locator('[aria-label="Canvas AI forever composer"]');
await page.screenshot({ path: `${outDir}/ai-dock-anim-01-collapsed.png`, fullPage: false });
await dock.locator('textarea').click();
await page.waitForTimeout(180); // mid slide-up
await page.screenshot({ path: `${outDir}/ai-dock-anim-02-sliding-up.png`, fullPage: false });
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/ai-dock-anim-03-open.png`, fullPage: false });
await page.mouse.click(180, 180);
await page.waitForTimeout(5100);
await page.waitForTimeout(160); // mid slide-down
await page.screenshot({ path: `${outDir}/ai-dock-anim-04-sliding-down.png`, fullPage: false });
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/ai-dock-anim-05-folded.png`, fullPage: false });
await browser.close();
console.log('anim smoke done');
