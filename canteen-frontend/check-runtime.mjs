import { chromium } from 'playwright';

const routes = ['/login', '/employee/menu', '/staff/orders', '/admin/users', '/nope'];

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
const context = await browser.newContext();
const page = await context.newPage();

page.on('pageerror', (error) => {
  console.log(`[pageerror] ${page.url()} :: ${error.stack || error.message}`);
});
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    console.log(`[console.error] ${page.url()} :: ${msg.text()}`);
  }
});

for (const route of routes) {
  await page.goto(`http://localhost:3001${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch((e) => {
    console.log(`[goto failed] ${route} :: ${e.message}`);
  });
  await page.waitForTimeout(2500);
  const hiccup = await page.getByText('Kitchen Hiccup').count();
  console.log(`ROUTE ${route} url=${page.url()} hiccup=${hiccup}`);
}

await browser.close();
console.log('DONE');
