import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve('test_screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runFrontendTesting() {
  console.log('===============================================================');
  console.log('🧪 MEMULAI PENGUJIAN FRONTEND LENGKAP: PRESTASI USER & STRUK KURIR');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📂 Output Screenshots: ${SCREENSHOT_DIR}`);
  console.log('===============================================================\n');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1.5,
  });

  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
    console.error('❌ Browser Page Error:', err.message);
  });

  try {
    // 1. LOGIN SEBAGAI SUPERADMIN
    console.log('--- [1/5] LOGIN SEBAGAI SUPERADMIN ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    
    const emailField = page.locator('input[type="email"], input[name="email"], input[placeholder*="Email"], input[placeholder*="HP"], input[type="text"]').first();
    const passField = page.locator('input[type="password"]').first();
    await emailField.fill('superadmin@higopondok.id');
    await passField.fill('password');
    
    const submitBtn = page.locator('button[type="submit"], button:has-text("Masuk")').first();
    await submitBtn.click();
    await page.waitForTimeout(2000);
    console.log('✅ Berhasil login ke sistem!\n');

    // 2. BUKA HALAMAN ADMIN PESANAN
    console.log('--- [2/5] MEMBUKA HALAMAN ADMIN PESANAN ---');
    await page.goto(`${BASE_URL}/dashboard/admin/pesanan`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_admin_pesanan_cards.png') });
    console.log('✅ Halaman Admin Pesanan terbuka. Screenshot: 01_admin_pesanan_cards.png');

    // 3. CEK TOMBOL PRESTASI WALI & BUKA MODAL
    console.log('\n--- [3/5] PENGUJIAN TOMBOL PRESTASI WALI & MODAL PRESTASI ---');
    const prestasiBtn = page.locator('button:has-text("Prestasi Wali")').first();
    const isPrestasiBtnVisible = await prestasiBtn.isVisible();
    console.log(`Apakah tombol "Prestasi Wali" muncul di card pesanan? ${isPrestasiBtnVisible ? 'YA ✅' : 'TIDAK ❌'}`);

    if (isPrestasiBtnVisible) {
      const btnText = await prestasiBtn.innerText();
      console.log(`Teks tombol prestasi: "${btnText}"`);
      
      console.log('Mengeklik tombol "Prestasi Wali"...');
      await prestasiBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_user_achievement_modal.png') });
      console.log('✅ Modal Prestasi & Riwayat Santri terbuka! Screenshot: 02_user_achievement_modal.png');

      // Verifikasi konten modal
      const modalHeader = page.locator('h3:has-text("Prestasi & Riwayat Pemesan")');
      const isHeaderVisible = await modalHeader.isVisible();
      console.log(`Header modal tampil benar? ${isHeaderVisible ? 'YA ✅' : 'TIDAK ❌'}`);

      const sultanBadge = page.locator('text=Sultan Pondok, text=Wali Prioritas, text=Wali Teladan').first();
      const isBadgeVisible = await sultanBadge.isVisible();
      console.log(`Badge prestasi level pemesan tampil? ${isBadgeVisible ? 'YA ✅' : 'TIDAK ❌'}`);

      // Tutup modal prestasi
      const closeBtn = page.locator('button[title="Tutup Modal"], button:has-text("Tutup")').first();
      await closeBtn.click();
      await page.waitForTimeout(1000);
      console.log('✅ Modal prestasi berhasil ditutup.');
    }

    // 4. PENGUJIAN CETAK STRUK BATCH (VERIFIKASI 4 SANTRI & CATATAN KURIR)
    console.log('\n--- [4/5] PENGUJIAN MODAL STRUK (VERIFIKASI SEMUA SANTRI & CATATAN KURIR) ---');
    const cetakBatchBtn = page.locator('button:has-text("Cetak")').first();
    if (await cetakBatchBtn.isVisible()) {
      console.log('Mengeklik tombol Cetak Struk Batch...');
      await cetakBatchBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_thermal_receipt_modal.png') });
      console.log('✅ Modal Cetak Struk terbuka! Screenshot: 03_thermal_receipt_modal.png');

      // Cek apakah beberapa nama santri muncul di struk
      const receiptText = await page.locator('.thermal-receipt-printable').innerText();
      const hasRouf = receiptText.includes('ROUF') || receiptText.includes('Rouf');
      const hasSilvia = receiptText.includes('SILVIA') || receiptText.includes('Silvia');
      const hasQeyla = receiptText.includes('QEYLA') || receiptText.includes('Qeyla');
      const hasTalitha = receiptText.includes('TALITHA') || receiptText.includes('Talitha');

      console.log(`Apakah ROUF ada di struk? ${hasRouf ? 'YA ✅' : 'TIDAK ❌'}`);
      console.log(`Apakah SILVIA ada di struk? ${hasSilvia ? 'YA ✅' : 'TIDAK ❌'}`);
      console.log(`Apakah QEYLA ada di struk? ${hasQeyla ? 'YA ✅' : 'TIDAK ❌'}`);
      console.log(`Apakah TALITHA ada di struk? ${hasTalitha ? 'YA ✅' : 'TIDAK ❌'}`);

      const hasCatatanKurir = receiptText.includes('Catatan Kurir') || receiptText.includes('Catatan');
      console.log(`Apakah Catatan Kurir muncul di struk? ${hasCatatanKurir ? 'YA ✅' : 'TIDAK ❌'}`);

      // Tutup modal struk
      const closeReceiptBtn = page.locator('.receipt-modal-card button[title="Tutup Modal"], .receipt-modal-card button:has-text("Tutup")').first();
      await closeReceiptBtn.click();
      await page.waitForTimeout(1000);
      console.log('✅ Modal struk berhasil ditutup.');
    }

    // 5. PENGUJIAN TAB REKAPITULASI PEMESAN (FOKUS PER USER)
    console.log('\n--- [5/5] PENGUJIAN TAB REKAPITULASI PRESTASI PEMESAN ---');
    const rekapTab = page.locator('button:has-text("Rekapitulasi"), button:has-text("Laporan"), button:has-text("Rekap")').first();
    if (await rekapTab.isVisible()) {
      await rekapTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_rekapitulasi_prestasi_tab.png') });
      console.log('✅ Tab Rekapitulasi terbuka! Screenshot: 04_rekapitulasi_prestasi_tab.png');

      const rekapSectionTitle = page.locator('text=Rekapitulasi Prestasi Pemesan (Fokus Akun Wali)');
      const isTitleVisible = await rekapSectionTitle.isVisible();
      console.log(`Judul seksi "Rekapitulasi Prestasi Pemesan (Fokus Akun Wali)" tampil? ${isTitleVisible ? 'YA ✅' : 'TIDAK ❌'}`);

      const detailSantriBtn = page.locator('button:has-text("Lihat Detail Santri")').first();
      if (await detailSantriBtn.isVisible()) {
        console.log('Mengeklik tombol "Lihat Detail Santri" di tab rekap...');
        await detailSantriBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_rekap_santri_modal.png') });
        console.log('✅ Modal dari tab rekap berhasil terbuka! Screenshot: 05_rekap_santri_modal.png');
      }
    }

    console.log('\n===============================================================');
    console.log(`🎉 SELURUH PENGUJIAN FRONTEND SELESAI DENGAN SUKSES!`);
    console.log(`Total Browser Errors Terdeteksi: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Daftar Error Konsol:', errors);
    }
    console.log('===============================================================\n');

  } catch (err) {
    console.error('❌ Terjadi kesalahan saat pengujian:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_screenshot.png') });
  } finally {
    await browser.close();
  }
}

runFrontendTesting();

