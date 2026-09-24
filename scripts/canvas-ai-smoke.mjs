import { chromium } from 'playwright';
import fs from 'fs';
const outDir = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2000);

// Open AI panel
const aiTab = page.locator('button[title="Open canvas AI"]');
if (await aiTab.count()) await aiTab.click();
else {
  // try toolbar sparkles / message icons
  await page.keyboard.press('Escape');
}
await page.waitForTimeout(500);

// Try open via top toolbar chat toggle - look for MessageSquare/Bot buttons
if (!(await page.locator('text=Canvas AI').count())) {
  const candidates = page.locator('button');
  const n = await candidates.count();
  for (let i = 0; i < Math.min(n, 40); i++) {
    const box = await candidates.nth(i).boundingBox();
    if (!box) continue;
    // top bar roughly y < 60
    if (box.y < 60 && box.x > 900) {
      await candidates.nth(i).click();
      await page.waitForTimeout(400);
      if (await page.locator('text=Canvas AI').count()) break;
    }
  }
}

// Click a card title on the canvas
await page.locator('text=Architecture').first().click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(300);

await page.screenshot({ path: `${outDir}/ai-canvas-02-panel.png`, fullPage: false });

const ta = page.locator('aside textarea').first();
if (await ta.count()) {
  await ta.fill('Summarize the selected note');
  await page.locator('aside button[aria-label="Send"]').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/ai-canvas-03-answer.png`, fullPage: false });
  console.log('PANEL', (await page.locator('aside').innerText()).slice(0, 700));
} else {
  console.log('no panel textarea');
  await page.screenshot({ path: `${outDir}/ai-canvas-fail.png`, fullPage: false });
}
await browser.close();
