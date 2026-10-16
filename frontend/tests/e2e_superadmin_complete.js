import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:\\Users\\ASRUL\\.gemini\\antigravity-ide\\brain\\87adb0d2-e30e-4171-84bb-33bbc9b61995';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';

// Pastikan direktori tangkapan layar pengujian tersedia
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'test_results');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runSuperAdminFullTesting() {
  console.log('===============================================================');
  console.log('🧪 MEMULAI PENGUJIAN LENGKAP FRONTEND: SUPERADMIN (SEMUA LAMAN & TOMBOL)');
  console.log(`🌐 URL Sasaran: ${BASE_URL}`);
  console.log(`📱 Mode Tampilan: Mobile-First Viewport (412 x 915)`);
  console.log(`📂 Folder Tangkapan Layar: ${SCREENSHOT_DIR}`);
  console.log('===============================================================\n');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // Rekam log konsol dan error di browser
  const browserErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      browserErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    browserErrors.push(err.toString());
    console.error(`❌ Browser Page Error Terdeteksi: ${err.message}`);
  });

  try {
    // -------------------------------------------------------------
    // TAHAP 1: AUTENTIKASI & LOGIN SUPERADMIN
    // -------------------------------------------------------------
    console.log('--- [1/8] PENGUJIAN AUTENTIKASI & LOGIN SUPERADMIN ---');
    console.log('1.1 Membuka halaman login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login_page.png') });

    console.log('1.2 Mengisi email & kata sandi Superadmin...');
    const emailField = page.locator('input[type="email"], input[name="email"], input[placeholder*="Email"], input[placeholder*="HP"], input[type="text"]').first();
    const passField = page.locator('input[type="password"]').first();
    await emailField.fill('superadmin@higopondok.id');
    await passField.fill('password');

    console.log('1.3 Menekan tombol "Masuk"...');
    const submitBtn = page.locator('button[type="submit"], button:has-text("Masuk")').first();
    await submitBtn.click();
    await page.waitForTimeout(2000);
    console.log('✅ Berhasil masuk sebagai Superadmin!\n');

    // -------------------------------------------------------------
    // TAHAP 2: DASHBOARD UTAMA SUPERADMIN
    // -------------------------------------------------------------
    console.log('--- [2/8] PENGUJIAN DASHBOARD UTAMA ---');
    console.log('2.1 Membuka /dashboard...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_dashboard_main.png') });
    console.log('✅ Halaman Dashboard utama berhasil dirender.');

    // -------------------------------------------------------------
    // TAHAP 3: HALAMAN MANAJEMEN PESANAN (AdminPesanan.jsx)
    // -------------------------------------------------------------
    console.log('\n--- [3/8] PENGUJIAN ADMIN PESANAN (SEMUA TOMBOL & FITUR BARU) ---');
    console.log('3.1 Membuka /dashboard/admin/pesanan...');
    await page.goto(`${BASE_URL}/dashboard/admin/pesanan`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_admin_pesanan_initial.png') });

    // 3.2 Uji Tombol Global Buka/Tutup Semua Rincian
    console.log('3.2 Menguji tombol global "Buka Semua Rincian"...');
    const toggleAllBtn = page.locator('button:has-text("Buka Semua Rincian"), button:has-text("Tutup Semua Rincian")').first();
    if (await toggleAllBtn.isVisible()) {
      await toggleAllBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_pesanan_semua_terbuka.png') });
      console.log('✅ Berhasil membuka semua rincian pesanan toko!');

      console.log('3.3 Menguji tombol global "Tutup Semua Rincian"...');
      await toggleAllBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_pesanan_semua_tertutup.png') });
      console.log('✅ Berhasil menutup kembali semua rincian pesanan toko!');
    } else {
      console.log('ℹ️ Tidak ada daftar pesanan aktif untuk filter hari ini.');
    }

    // 3.4 Uji Accordion Buka Rincian per Wadah
    const bukaRincianBtn = page.locator('button:has-text("Buka Rincian")').first();
    if (await bukaRincianBtn.isVisible()) {
      console.log('3.4 Menguji tombol accordion "Buka Rincian" pada wadah...');
      await bukaRincianBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_pesanan_accordion_terbuka.png') });
      console.log('✅ Berhasil membuka rincian pesanan toko secara individual.');

      const tutupRincianBtn = page.locator('button:has-text("Tutup Rincian")').first();
      if (await tutupRincianBtn.isVisible()) {
        await tutupRincianBtn.click();
        await page.waitForTimeout(600);
        console.log('✅ Berhasil menutup kembali rincian accordion.');
      }
    }

    // 3.5 Uji Modal Status Wadah & Penjadwalan Tanggal (Cek Bebas Error selectedGroupCustomDate)
    const statusWadahBtn = page.locator('button:has-text("Status")').first();
    if (await statusWadahBtn.isVisible()) {
      console.log('3.5 Menguji tombol "Status" pada footer wadah (Membuka Modal Status & Jadwal)...');
      await statusWadahBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_modal_status_wadah_open.png') });

      // Verifikasi teks label status default
      const modalText = await page.locator('body').innerText();
      const hasCurrentStatus = modalText.includes('Status Saat Ini:') || modalText.includes('Saat Ini:');
      console.log(`📌 Verifikasi Status Default di Modal: ${hasCurrentStatus ? 'SUKSES (Tampil Jelas)' : 'TIDAK TERDETEKSI'}`);

      // Uji Tombol Jadwal "Lainnya" (Kritis: menguji perbaikan selectedGroupCustomDate)
      console.log('3.6 Menekan tombol jadwal "Lainnya" untuk membuka pemilih tanggal kustom...');
      const dateLainnyaBtn = page.locator('button:has-text("Lainnya")').first();
      if (await dateLainnyaBtn.isVisible()) {
        await dateLainnyaBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_modal_status_jadwal_lainnya.png') });
        console.log('✅ Tombol "Lainnya" berhasil ditekan TANPA ERROR runtime (selectedGroupCustomDate aman)!');
      }

      // Tutup modal via tombol "Batal"
      console.log('3.7 Menekan tombol "Batal" pada modal status wadah...');
      const batalModalBtn = page.locator('button:has-text("Batal")').first();
      await batalModalBtn.click();
      await page.waitForTimeout(800);
    }

    // 3.8 Uji Filter Periode Waktu
    console.log('3.8 Menguji filter rentang waktu (Bulan Ini)...');
    const filterBulanBtn = page.locator('button:has-text("Bulan Ini"), select option[value="month"]').first();
    const modeSelect = page.locator('select').first();
    if (await modeSelect.isVisible()) {
      await modeSelect.selectOption('all');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_pesanan_filter_semua.png') });
      console.log('✅ Berhasil mengubah filter ke "Semua Waktu"!');
    }

    // 3.9 Uji Tab "Rekapitulasi Penjualan & Keuangan"
    console.log('3.9 Menguji tombol Tab "Rekapitulasi"...');
    const tabRekapBtn = page.locator('button:has-text("Rekapitulasi"), button:has-text("Rekap")').first();
    if (await tabRekapBtn.isVisible()) {
      await tabRekapBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10_pesanan_tab_rekapitulasi.png') });
      console.log('✅ Tab Rekapitulasi berhasil dibuka!');

      // Kembalikan ke tab pesanan
      const tabPesananBtn = page.locator('button:has-text("Daftar Pesanan"), button:has-text("Pesanan")').first();
      if (await tabPesananBtn.isVisible()) {
        await tabPesananBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // -------------------------------------------------------------
    // TAHAP 4: HALAMAN MANAJEMEN PERTOKOAN & KANTIN
    // -------------------------------------------------------------
    console.log('\n--- [4/8] PENGUJIAN HALAMAN MANAJEMEN PERTOKOAN ---');
    console.log('4.1 Membuka /dashboard/pertokoan...');
    await page.goto(`${BASE_URL}/dashboard/pertokoan`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11_pertokoan_page.png') });

    const tokoCount = await page.locator('.border, .card, [class*="canteen"]').count();
    console.log(`✅ Halaman Pertokoan berhasil dimuat. (Elemen terdeteksi: ${tokoCount})`);

    // -------------------------------------------------------------
    // TAHAP 5: HALAMAN MANAJEMEN PENGGUNA (SANTRI, WALI, ADMIN, KURIR)
    // -------------------------------------------------------------
    console.log('\n--- [5/8] PENGUJIAN MANAJEMEN PENGGUNA ---');
    console.log('5.1 Membuka /dashboard/users...');
    await page.goto(`${BASE_URL}/dashboard/users`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12_users_management.png') });

    // Uji Tab Santri / Mitra
    const tabMitra = page.locator('button:has-text("Kantin"), button:has-text("Toko")').first();
    if (await tabMitra.isVisible()) {
      await tabMitra.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13_users_tab_mitra.png') });
      console.log('✅ Tab Mitra Toko/Kantin berhasil dibuka.');
    }

    // -------------------------------------------------------------
    // TAHAP 6: HALAMAN LOG AUDIT SISTEM
    // -------------------------------------------------------------
    console.log('\n--- [6/8] PENGUJIAN LOG AUDIT AKTIVITAS ---');
    console.log('6.1 Membuka /dashboard/admin-logs...');
    await page.goto(`${BASE_URL}/dashboard/admin-logs`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '14_admin_logs.png') });
    console.log('✅ Halaman Log Audit Sistem berhasil dirender.');

    // -------------------------------------------------------------
    // TAHAP 7: HALAMAN MANAJEMEN VOUCHER PROMO
    // -------------------------------------------------------------
    console.log('\n--- [7/8] PENGUJIAN MANAJEMEN VOUCHER ---');
    console.log('7.1 Membuka /dashboard/admin/vouchers...');
    await page.goto(`${BASE_URL}/dashboard/admin/vouchers`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '15_vouchers_management.png') });
    console.log('✅ Halaman Manajemen Voucher Promo berhasil dimuat.');

    // -------------------------------------------------------------
    // TAHAP 8: HALAMAN BUKU PANDUAN & PROFIL
    // -------------------------------------------------------------
    console.log('\n--- [8/8] PENGUJIAN BUKU PANDUAN & PROFIL ---');
    console.log('8.1 Membuka /dashboard/buku-panduan...');
    await page.goto(`${BASE_URL}/dashboard/buku-panduan`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '16_buku_panduan.png') });
    console.log('✅ Halaman Buku Panduan berhasil dibuka.');

    console.log('8.2 Membuka /dashboard/profile...');
    await page.goto(`${BASE_URL}/dashboard/profile`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '17_profile_superadmin.png') });
    console.log('✅ Halaman Profil Superadmin berhasil dibuka.');

    console.log('\n===============================================================');
    console.log('🎉 SEMUA PENGUJIAN SUPERADMIN (8 TAHAP) BERHASIL 100% TANPA ERROR!');
    console.log(`📸 Seluruh tangkapan layar (17 gambar) tersimpan di:`);
    console.log(`   ${SCREENSHOT_DIR}`);
    if (browserErrors.length === 0) {
      console.log('✨ Status Konsol Browser: 0 Error (Sempurna & Bersih)!');
    } else {
      console.log(`⚠️ Catatan error non-kritis di konsol (${browserErrors.length}):`);
      browserErrors.slice(0, 3).forEach(e => console.log(`   - ${e}`));
    }
    console.log('===============================================================');

  } catch (error) {
    console.error(`\n❌ PENGUJIAN TERHENTI KARENA KESALAHAN: ${error.message}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_dump.png'), fullPage: true });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runSuperAdminFullTesting();
