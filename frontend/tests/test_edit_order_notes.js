import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:\\Users\\ASRUL\\.gemini\\antigravity\\brain\\51ba3fee-5dc2-4810-8648-e79b396d3d5a';
const AUTH_JSON_PATH = path.join(ARTIFACT_DIR, 'scratch', 'test_auth.json');

async function runTestEditNotes() {
  console.log('🧪 Memulai pengujian visual: Edit Pesan Santri...');
  const authData = fs.readFileSync(AUTH_JSON_PATH, 'utf-8');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });

  // Inject auth state directly into localStorage before page loads
  await context.addInitScript((data) => {
    localStorage.setItem('auth-storage', data);
  }, authData);

  const page = await context.newPage();

  // Navigate to /dashboard/pembayaran
  await page.goto(`${BASE_URL}/dashboard/pembayaran`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Screenshot sebelum diedit
  const screenshotBefore = path.join(ARTIFACT_DIR, '08_pembayaran_before_edit_note.png');
  await page.screenshot({ path: screenshotBefore });
  console.log(`📸 Screenshot Sebelum Edit: ${screenshotBefore}`);

  // Cari tombol "Ubah Pesan" atau "+ Tambah Pesan"
  const ubahBtn = page.locator('button:has-text("Ubah Pesan"), button:has-text("+ Tambah Pesan")').first();
  await ubahBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✅ Tombol Ubah Pesan / Tambah Pesan terdeteksi di kartu pesanan!');

  await ubahBtn.click();
  await page.waitForTimeout(1000);

  // Screenshot modal
  const screenshotModal = path.join(ARTIFACT_DIR, '09_modal_ubah_pesan_santri.png');
  await page.screenshot({ path: screenshotModal });
  console.log(`📸 Screenshot Modal Edit Pesan: ${screenshotModal}`);

  // Pilih template cepat
  const templateChip = page.locator('button:has-text("Semangat belajarnya ya nak")').first();
  if (await templateChip.isVisible()) {
    await templateChip.click();
    await page.waitForTimeout(400);
  }

  // Tambahkan kalimat kustom
  const textarea = page.locator('textarea').first();
  await textarea.fill('Jangan lupa sholat dhuha & semangat hafalan juz 30 ya nak! Barakallah ❤️');
  await page.waitForTimeout(400);

  // Klik tombol "Simpan Pesan"
  const simpanBtn = page.locator('button:has-text("Simpan Pesan")').first();
  await simpanBtn.click();
  await page.waitForTimeout(2500);

  // Screenshot setelah diedit
  const screenshotAfter = path.join(ARTIFACT_DIR, '10_pembayaran_after_edit_note.png');
  await page.screenshot({ path: screenshotAfter });
  console.log(`📸 Screenshot Setelah Edit: ${screenshotAfter}`);

  const cardNoteElement = page.locator('text=Jangan lupa sholat dhuha').first();
  const isUpdatedTextVisible = await cardNoteElement.isVisible();
  console.log(`Apakah pesan baru berhasil tampil di kartu pesanan? ${isUpdatedTextVisible ? 'YA, BERHASIL 100% ✅' : 'TIDAK ❌'}`);

  await browser.close();
}

runTestEditNotes().catch(e => {
  console.error(e);
  process.exit(1);
});
