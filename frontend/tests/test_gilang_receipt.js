import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve('test_screenshots');

async function testGilangMultiSantri() {
  console.log('🧪 PENGUJIAN KHUSUS: GILANG PERMATASARI (4 SANTRI & PRESTASI SULTAN)');
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

  try {
    // 1. Login
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="Email"], input[type="text"]', 'superadmin@higopondok.id');
    await page.fill('input[type="password"]', 'password');
    await page.click('button[type="submit"], button:has-text("Masuk")');
    await page.waitForTimeout(2000);

    // 2. Ke Admin Pesanan
    await page.goto(`${BASE_URL}/dashboard/admin/pesanan`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    // 3. Ubah filter tanggal ke "Semua" atau cari "Gilang"
    console.log('Mencari pesanan Gilang permatasari...');
    const searchInput = page.locator('input[placeholder*="Cari santri, toko, ID"]');
    await searchInput.fill('Gilang');
    await page.waitForTimeout(1500);

    // Klik tombol filter "Semua" tanggal jika belum
    const allDateBtn = page.locator('button:has-text("Semua")').first();
    if (await allDateBtn.isVisible()) {
      await allDateBtn.click();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_gilang_filtered_cards.png') });
    console.log('✅ Screenshot filter Gilang: 06_gilang_filtered_cards.png');

    // 4. Klik tombol Prestasi Wali pada card Gilang
    const gilangPrestasiBtn = page.locator('button:has-text("Prestasi Wali")').first();
    if (await gilangPrestasiBtn.isVisible()) {
      const btnText = await gilangPrestasiBtn.innerText();
      console.log(`Teks Tombol Gilang: "${btnText}"`);
      await gilangPrestasiBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_gilang_achievement_modal.png') });
      console.log('✅ Screenshot Modal Prestasi Gilang (Sultan): 07_gilang_achievement_modal.png');

      const closeBtn = page.locator('button[title="Tutup Modal"], button:has-text("Tutup")').first();
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }

    // 5. Cetak Struk Batch dari Gilang
    const cetakBtn = page.locator('button:has-text("Cetak")').first();
    if (await cetakBtn.isVisible()) {
      await cetakBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_gilang_thermal_receipt.png') });
      console.log('✅ Screenshot Struk Gilang: 08_gilang_thermal_receipt.png');

      const receiptText = await page.locator('.thermal-receipt-printable').innerText();
      console.log('--- POTONGAN ISI STRUK THERMAL ---');
      console.log(receiptText.substring(0, 500));
      console.log('---------------------------------');

      const hasRouf = receiptText.includes('ROUF') || receiptText.includes('Rouf');
      const hasSilvia = receiptText.includes('SILVIA') || receiptText.includes('Silvia');
      const hasQeyla = receiptText.includes('QEYLA') || receiptText.includes('Qeyla');
      const hasTalitha = receiptText.includes('TALITHA') || receiptText.includes('Talitha');

      console.log(`Apakah ROUF tercetak di struk? ${hasRouf ? 'YA ✅' : 'TIDAK ❌'}`);
      console.log(`Apakah SILVIA tercetak di struk? ${hasSilvia ? 'YA ✅' : 'TIDAK ❌'}`);
      console.log(`Apakah QEYLA tercetak di struk? ${hasQeyla ? 'YA ✅' : 'TIDAK ❌'}`);
      console.log(`Apakah TALITHA tercetak di struk? ${hasTalitha ? 'YA ✅' : 'TIDAK ❌'}`);
    }

    console.log('🎉 PENGUJIAN GILANG BERHASIL!');
  } catch (err) {
    console.error('Error saat pengujian:', err);
  } finally {
    await browser.close();
  }
}

testGilangMultiSantri();

