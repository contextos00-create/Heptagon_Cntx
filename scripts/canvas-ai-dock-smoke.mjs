import { chromium } from 'playwright';
import fs from 'fs';
const outDir = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

const dock = page.locator('[aria-label="Canvas AI forever composer"]');
console.log('dock count', await dock.count());
await page.screenshot({ path: `${outDir}/ai-dock-01-forever.png`, fullPage: false });

// Type in forever composer
const ta = dock.locator('textarea').first();
await ta.click();
await ta.fill('Summarize the board briefly');
await dock.locator('button[aria-label="Send"]').click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/ai-dock-02-answer.png`, fullPage: false });
console.log('DOCK_TEXT', (await dock.innerText()).slice(0, 500));

// Pan canvas and confirm dock still visible / same place
await page.mouse.move(400, 300);
await page.mouse.down();
await page.mouse.move(200, 200);
await page.mouse.up();
await page.waitForTimeout(400);
const box = await dock.boundingBox();
console.log('dock box after pan', box);
await page.screenshot({ path: `${outDir}/ai-dock-03-after-pan.png`, fullPage: false });

await browser.close();
