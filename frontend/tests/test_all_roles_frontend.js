import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve('test_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testAllRolesFrontend() {
  console.log('================================================================');
  console.log('🧪 PENGUJIAN FRONTEND LENGKAP SEMUA PERAN (KURIR, USER, KANTIN)');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 950 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      // Filter out external GSI/FedCM noise if any
      const txt = msg.text();
      if (!txt.includes('GSI_LOGGER') && !txt.includes('FedCM')) {
        pageErrors.push(txt);
      }
    }
  });

  page.on('pageerror', err => {
    console.error('❌ Browser Page Error:', err.message);
    pageErrors.push(`PageError: ${err.message}`);
  });

  try {
    // =======================================================
    // 1. PENGUJIAN FRONTEND KURIR
    // =======================================================
    console.log('--- [1/3] PENGUJIAN ROLE KURIR ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    
    // Clear storage/cookies
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });

    // Login kurir
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="Email"], input[type="text"]', 'kurir@email.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"], button:has-text("Masuk")');
    await page.waitForTimeout(2000);

    // Cek Dashboard Kurir
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'kurir_01_dashboard.png') });
    console.log('✅ Dashboard Kurir terbuka. Screenshot: kurir_01_dashboard.png');

    // Buka Halaman Tugas Kurir
    console.log('Membuka halaman Tugas Kurir (/dashboard/tugas-kurir)...');
    await page.goto(`${BASE_URL}/dashboard/tugas-kurir`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'kurir_02_tugas.png') });
    console.log('✅ Halaman Tugas Kurir terbuka. Screenshot: kurir_02_tugas.png');

    // Coba buka modal struk di kurir jika ada tombol struk
    const kurirStrukBtn = page.locator('button:has-text("Struk"), button[title*="Struk"]').first();
    if (await kurirStrukBtn.isVisible()) {
      console.log('Mengeklik tombol Struk di kurir...');
      await kurirStrukBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'kurir_03_modal_struk.png') });
      console.log('✅ Modal Struk Kurir terbuka tanpa error. Screenshot: kurir_03_modal_struk.png');
      
      const closeStruk = page.locator('.receipt-modal-card button[title="Tutup Modal"], button:has-text("Tutup")').first();
      if (await closeStruk.isVisible()) {
        await closeStruk.click();
        await page.waitForTimeout(500);
      }
    }

    // =======================================================
    // 2. PENGUJIAN FRONTEND USER / WALI SANTRI
    // =======================================================
    console.log('\n--- [2/3] PENGUJIAN ROLE USER / WALI SANTRI ---');
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });

    await page.fill('input[type="email"], input[name="email"], input[placeholder*="Email"], input[type="text"]', 'wali@email.com');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"], button:has-text("Masuk")');
    await page.waitForTimeout(2000);

    // Cek Beranda User
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'user_01_home.png') });
    console.log('✅ Beranda User terbuka. Screenshot: user_01_home.png');

    // Cek Dashboard / Riwayat Pesanan User
    console.log('Membuka Dashboard / Riwayat User (/dashboard)...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'user_02_dashboard.png') });
    console.log('✅ Dashboard User terbuka. Screenshot: user_02_dashboard.png');

    // Cek Halaman Kantin & Toko
    console.log('Membuka Halaman Kantin (/kantin)...');
    await page.goto(`${BASE_URL}/kantin`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'user_03_kantin.png') });
    console.log('✅ Halaman Kantin User terbuka. Screenshot: user_03_kantin.png');

    // Cek Halaman Keranjang
    console.log('Membuka Halaman Keranjang (/keranjang)...');
    await page.goto(`${BASE_URL}/keranjang`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'user_04_keranjang.png') });
    console.log('✅ Halaman Keranjang User terbuka. Screenshot: user_04_keranjang.png');

    // =======================================================
    // 3. PENGUJIAN FRONTEND KANTIN / TOKO
    // =======================================================
    console.log('\n--- [3/3] PENGUJIAN ROLE KANTIN / TOKO ---');
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });

    await page.fill('input[type="email"], input[name="email"], input[placeholder*="Email"], input[type="text"]', 'admin@higopondok.id');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"], button:has-text("Masuk")');
    await page.waitForTimeout(2000);

    // Cek Pesanan Toko
    console.log('Membuka Halaman Pesanan Toko (/dashboard/pesanan-toko)...');
    await page.goto(`${BASE_URL}/dashboard/pesanan-toko`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'kantin_01_pesanan.png') });
    console.log('✅ Halaman Pesanan Toko terbuka. Screenshot: kantin_01_pesanan.png');

    console.log('\n================================================================');
    console.log('🎉 PENGUJIAN SEMUA FRONTEND ROLE BERHASIL DILAKSANAKAN!');
    console.log(`Total Uncaught Errors: ${pageErrors.length}`);
    if (pageErrors.length > 0) {
      console.log('Daftar Error:', pageErrors);
    } else {
      console.log('Semua halaman kurir, user/wali, dan kantin BERSIH tanpa error! ✨');
    }
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ Error saat pengujian multi-role:', err);
  } finally {
    await browser.close();
  }
}

testAllRolesFrontend();

