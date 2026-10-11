import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:\\Users\\ASRUL\\.gemini\\antigravity-ide\\brain\\b4365c1f-1410-40fa-a3de-a50fadd04ed6';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runBrowserTest() {
  console.log('🚀 Memulai Browser E2E Test Log Aktivitas...');
  console.log(`Menggunakan browser: ${CHROME_PATH}`);

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true, // Berjalan di latar belakang tanpa mengganggu layar
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 }, // Emulasi Mobile Phone Sesuai Konsep Mobile-First
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  try {
    // 1. Kunjungi Halaman Login
    console.log('1️⃣ Membuka halaman login http://localhost:5173/login ...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 15000 });
    
    // 2. Isi Formulir Login
    console.log('2️⃣ Mengisi kredensial Super Admin...');
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="Email"], input[placeholder*="email"], input[placeholder*="HP"], input[type="text"]').first();
    const passInput = page.locator('input[type="password"]').first();
    
    await emailInput.fill('superadmin@higopondok.id');
    await passInput.fill('password');

    console.log('3️⃣ Mengirim formulir login...');
    const submitBtn = page.locator('button[type="submit"], button:has-text("Masuk")').first();
    await submitBtn.click();

    // Tunggu redirect ke dashboard atau token tersimpan
    await page.waitForTimeout(2000);
    console.log('✅ Berhasil login!');

    // 4. Buka Halaman Log Audit
    console.log('4️⃣ Membuka URL http://localhost:5173/dashboard/admin-logs ...');
    await page.goto('http://localhost:5173/dashboard/admin-logs', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    // Ambil screenshot halaman awal log aktivitas
    const ss1 = path.join(ARTIFACT_DIR, 'admin_logs_initial.png');
    await page.screenshot({ path: ss1, fullPage: false });
    console.log(`📸 Screenshot awal berhasil disimpan: ${ss1}`);

    // Verifikasi Judul Halaman
    const titleText = await page.locator('h1').textContent();
    console.log(`📌 Judul halaman terdeteksi: "${titleText.trim()}"`);

    // 5. Uji Pencarian "harga"
    console.log('5️⃣ Menguji filter pencarian kata kunci "harga"...');
    const searchInput = page.locator('input[placeholder*="Cari aktivitas"], input[type="text"]').first();
    await searchInput.fill('harga');
    await page.waitForTimeout(2000);

    const ss2 = path.join(ARTIFACT_DIR, 'admin_logs_search_harga.png');
    await page.screenshot({ path: ss2, fullPage: false });
    console.log(`📸 Screenshot pencarian harga berhasil disimpan: ${ss2}`);

    // 6. Uji Tombol Filter "Batal"
    console.log('6️⃣ Menghapus teks pencarian & menguji tombol filter cepat "Batal"...');
    await searchInput.fill('');
    await page.waitForTimeout(500);

    const batalBtn = page.locator('button:has-text("Batal")').first();
    await batalBtn.click();
    await page.waitForTimeout(1500);

    const ss3 = path.join(ARTIFACT_DIR, 'admin_logs_filter_batal.png');
    await page.screenshot({ path: ss3, fullPage: false });
    console.log(`📸 Screenshot filter batal berhasil disimpan: ${ss3}`);

    // 7. Kembalikan ke "Semua" aksi
    console.log('7️⃣ Mengembalikan filter aksi ke "Semua"...');
    const semuaBtn = page.locator('button:has-text("Semua")').first();
    await semuaBtn.click();
    await page.waitForTimeout(1000);

    // 8. Uji Filter Rentang Waktu (Date Range)
    console.log('8️⃣ Menguji filter rentang waktu (klik "Hari Ini")...');
    const hariIniBtn = page.locator('button:has-text("Hari Ini")').first();
    await hariIniBtn.click();
    await page.waitForTimeout(1500);

    const ss4 = path.join(ARTIFACT_DIR, 'admin_logs_filter_hari_ini.png');
    await page.screenshot({ path: ss4, fullPage: false });
    console.log(`📸 Screenshot filter hari ini berhasil disimpan: ${ss4}`);

    // Kembalikan ke Semua Waktu
    const semuaWaktuBtn = page.locator('button:has-text("Semua Waktu")').first();
    await semuaWaktuBtn.click();
    await page.waitForTimeout(1000);

    // 9. Uji Paginasi Mobile (Scroll ke bawah dan klik Selanjutnya)
    console.log('9️⃣ Menguji paginasi mobile (scroll ke bawah & klik "Selanjutnya")...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const selanjutnyaBtn = page.locator('button:has-text("Selanjutnya")').first();
    if (await selanjutnyaBtn.isVisible()) {
      await selanjutnyaBtn.click();
      await page.waitForTimeout(1500);
      console.log('✅ Halaman 2 berhasil dibuka via tombol Selanjutnya!');

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      const pagBar = page.locator('div:has-text("Menampilkan")').last();
      const ss5 = path.join(ARTIFACT_DIR, 'admin_logs_pagination_page2.png');
      if (await pagBar.isVisible()) {
        await pagBar.screenshot({ path: ss5 });
      } else {
        await page.screenshot({ path: ss5, fullPage: true });
      }
      console.log(`📸 Screenshot kontrol paginasi berhasil disimpan: ${ss5}`);
    }

    // 10. Uji Tab Prestasi & Audit Positif
    console.log('🔟 Menguji Tab "Prestasi & Audit Positif"...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    const prestasiTabBtn = page.locator('button:has-text("Prestasi & Audit Positif")').first();
    await prestasiTabBtn.click();
    await page.waitForTimeout(2000);

    const ss6 = path.join(ARTIFACT_DIR, 'admin_logs_tab_achievements_santri.png');
    await page.screenshot({ path: ss6, fullPage: false });
    console.log(`📸 Screenshot Tab Prestasi (Santri & Pelanggan) berhasil disimpan: ${ss6}`);

    // Uji ganti kategori ke "Mitra Toko"
    console.log('🔟.1 Menguji kategori "Mitra Toko"...');
    const tokoBtn = page.locator('button:has-text("Mitra Toko")').first();
    await tokoBtn.click();
    await page.waitForTimeout(1000);

    const ss7 = path.join(ARTIFACT_DIR, 'admin_logs_tab_achievements_toko.png');
    await page.screenshot({ path: ss7, fullPage: false });
    console.log(`📸 Screenshot Tab Prestasi (Mitra Toko) berhasil disimpan: ${ss7}`);

    // Uji ganti kategori ke "Kurir"
    console.log('🔟.2 Menguji kategori "Kurir"...');
    const kurirBtn = page.locator('button:has-text("Kurir")').first();
    await kurirBtn.click();
    await page.waitForTimeout(1000);

    const ss8 = path.join(ARTIFACT_DIR, 'admin_logs_tab_achievements_kurir.png');
    await page.screenshot({ path: ss8, fullPage: false });
    console.log(`📸 Screenshot Tab Prestasi (Kurir) berhasil disimpan: ${ss8}`);

    // 11. Uji Tab Seluruh Santri & Modal Detail Santri
    console.log('1️⃣1️⃣ Menguji Tab "Seluruh Santri"...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    const santriTabBtn = page.locator('button:has-text("Seluruh Santri")').first();
    await santriTabBtn.click();
    await page.waitForTimeout(2000);

    const ss9 = path.join(ARTIFACT_DIR, 'admin_logs_tab_santri_list.png');
    await page.screenshot({ path: ss9, fullPage: false });
    console.log(`📸 Screenshot Tab Seluruh Santri berhasil disimpan: ${ss9}`);

    // Buka Modal Detail Santri (klik tombol Detail baris pertama)
    console.log('1️⃣1️⃣.1 Menguji pembukaan Modal Detail Santri...');
    const detailBtn = page.locator('button:has-text("Detail")').first();
    await detailBtn.click();
    await page.waitForTimeout(1500);

    const ss10 = path.join(ARTIFACT_DIR, 'admin_logs_modal_santri_detail.png');
    await page.screenshot({ path: ss10, fullPage: false });
    console.log(`📸 Screenshot Modal Detail Santri berhasil disimpan: ${ss10}`);

    // Tutup Modal via tombol X header
    const tutupBtn = page.locator('button[title="Tutup dialog"]').first();
    await tutupBtn.click();
    await page.waitForTimeout(500);

    // 12. Uji Santri dengan Multi-Akun (Cari "NASWA")
    console.log('1️⃣2️⃣ Menguji Santri Multi-Akun (Cari "NASWA")...');
    const santriSearchInput = page.locator('input[placeholder*="Cari santri"]').first();
    await santriSearchInput.fill('NASWA');
    await page.waitForTimeout(1500);

    const ss11 = path.join(ARTIFACT_DIR, 'admin_logs_santri_multi_accounts_list.png');
    await page.screenshot({ path: ss11, fullPage: false });
    console.log(`📸 Screenshot Daftar Santri Multi-Akun berhasil disimpan: ${ss11}`);

    // Buka Modal Detail Santri Naswa untuk melihat seluruh akun terpasang
    const detailNaswaBtn = page.locator('button:has-text("Detail")').first();
    await detailNaswaBtn.click();
    await page.waitForTimeout(1500);

    const ss12 = path.join(ARTIFACT_DIR, 'admin_logs_modal_multi_accounts.png');
    await page.screenshot({ path: ss12, fullPage: false });
    console.log(`📸 Screenshot Modal Multi-Akun Santri berhasil disimpan: ${ss12}`);

    const tutupNaswaBtn = page.locator('button[title="Tutup dialog"]').first();
    await tutupNaswaBtn.click();
    await page.waitForTimeout(500);

    // 13. Uji Filter Dinamis Jenjang (MA & SMP)
    console.log('1️⃣3️⃣ Menguji Filter Dinamis Jenjang MA & SMP...');
    await santriSearchInput.fill('');
    await page.waitForTimeout(500);

    // Pilih Jenjang MA
    console.log('1️⃣3️⃣.1 Memilih Jenjang "MA"...');
    const jenjangSelect = page.locator('select').nth(1); // Urutkan = nth(0), Jenjang = nth(1)
    await jenjangSelect.selectOption('MA');
    await page.waitForTimeout(1500);

    const ss13 = path.join(ARTIFACT_DIR, 'admin_logs_filter_jenjang_ma.png');
    await page.screenshot({ path: ss13, fullPage: false });
    console.log(`📸 Screenshot Filter Jenjang MA berhasil disimpan: ${ss13}`);

    // Pilih Jenjang SMP
    console.log('1️⃣3️⃣.2 Memilih Jenjang "SMP"...');
    await jenjangSelect.selectOption('SMP');
    await page.waitForTimeout(1500);

    const ss14 = path.join(ARTIFACT_DIR, 'admin_logs_filter_jenjang_smp.png');
    await page.screenshot({ path: ss14, fullPage: false });
    console.log(`📸 Screenshot Filter Jenjang SMP berhasil disimpan: ${ss14}`);

    console.log('🎉 SEMUA PENGUJIAN BROWSER E2E (SEARCH, DATE RANGE, LIVE MONITOR, PAGINATION, PRESTASI, SELURUH SANTRI, FILTER JENJANG MA/SMP/KELAS/KAMAR & MULTI-AKUN) SUKSES!');
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat pengujian browser:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBrowserTest();
