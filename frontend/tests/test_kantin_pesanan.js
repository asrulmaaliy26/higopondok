import { chromium } from 'playwright';
import path from 'path';

async function testKantin() {
  console.log('🧪 Memulai pengujian halaman pesanan kantin...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });

  // Buka halaman dan reset localStorage
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await page.locator('#email').fill('admin@higopondok.id');
  await page.locator('#password').fill('password');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log('Membuka /dashboard/toko-saya/pesanan...');
  await page.goto('http://localhost:5173/dashboard/toko-saya/pesanan', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.resolve('test_screenshots/kantin_02_pesanan_real.png') });
  console.log('✅ Halaman Toko Saya / Pesanan berhasil ditangkap! Screenshot: kantin_02_pesanan_real.png');

  await browser.close();
}

testKantin();
