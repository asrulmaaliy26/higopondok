<?php
/**
 * HIGO PONDOK - HIDAYAH GO
 * BUMP Al Hidayah - PPTQ Al Mannan
 * 
 * Halaman Resmi: COMING SOON / SEGERA DILUNCURKAN
 * Transisi Pasca Uji Coba (Trial 1+ Bulan) di higo.lpialhidayah.or.id
 * Menuju Domain Utama Resmi: https://higopondok.id
 */

// Konfigurasi Domain & Kontak
$oldDomain = 'higo.lpialhidayah.or.id';
$newDomain = 'https://higopondok.id';
$supportWhatsApp = 'https://wa.me/6281234567890?text=Halo%20Admin%20HiGO%20Pondok%2C%20saya%20ingin%20menanyakan%20informasi%20peluncuran%20resmi%20di%20higopondok.id';

// Target Waktu Peluncuran (Default: 3 hari dari sekarang untuk countdown dinamis)
$launchTimestamp = strtotime('+3 days 09:00:00');

// Security & Caching Headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="HiGO Pondok (Hidayah Go) Segera Hadir di higopondok.id! Masa trial 1+ bulan di higo.lpialhidayah.or.id telah selesai. BUMP Al Hidayah PPTQ Al Mannan.">
    <meta name="theme-color" content="#15803d">
    <title>Segera Hadir (Coming Soon) | HiGO Pondok - higopondok.id</title>
    
    <!-- Google Fonts: Plus Jakarta Sans & JetBrains Mono -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">

    <style>
        /* CSS Reset & Variabel Tema HiGO (Flat Sharp - Rounded None) */
        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            border-radius: 0 !important; /* Sudut tegas flat rounded-none sesuai aturan */
        }

        :root {
            --color-primary: #15803d;       /* green-700 */
            --color-primary-hover: #166534; /* green-800 */
            --color-primary-light: #22c55e; /* green-500 */
            --color-primary-soft: #f0fdf4;  /* green-50 */
            --color-primary-border: #bbf7d0;/* green-200 */
            --color-dark: #0f172a;          /* slate-900 */
            --color-dark-surface: #1e293b;  /* slate-800 */
            --color-border: #e2e8f0;        /* slate-200 */
            --color-text-main: #0f172a;
            --color-text-muted: #64748b;
            --color-bg: #f8fafc;
        }

        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--color-bg);
            color: var(--color-text-main);
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .font-mono {
            font-family: 'JetBrains Mono', monospace;
        }

        /* Top Announcement Ribbon */
        .top-banner {
            background-color: var(--color-dark);
            color: #ffffff;
            font-size: 0.75rem;
            letter-spacing: 0.05em;
            padding: 0.5rem 1rem;
            text-align: center;
            border-bottom: 2px solid var(--color-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            flex-wrap: wrap;
        }

        .badge-pulse {
            background: #eab308;
            color: #713f12;
            font-weight: 800;
            padding: 0.15rem 0.5rem;
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            display: inline-block;
        }

        /* Container Layout */
        .container {
            width: 100%;
            max-width: 820px;
            margin: 0 auto;
            padding: 1.25rem 1rem;
        }

        /* Main Card */
        .main-card {
            background: #ffffff;
            border: 1px solid var(--color-border);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
            padding: 1.5rem;
            margin-bottom: 1.25rem;
        }

        @media (min-width: 640px) {
            .main-card {
                padding: 2.25rem;
            }
        }

        /* Header Section */
        .header-section {
            text-align: center;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--color-border);
            margin-bottom: 1.5rem;
        }

        .logo-wrapper {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1rem;
        }

        .logo-img {
            height: 56px;
            width: auto;
            object-fit: contain;
            display: block;
        }

        .logo-fallback {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: var(--color-primary-soft);
            border: 1px solid var(--color-primary-border);
            padding: 0.5rem 1rem;
            color: var(--color-primary);
            font-weight: 800;
            font-size: 1.25rem;
        }

        .institution-tag {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--color-primary);
            margin-bottom: 0.35rem;
        }

        .badge-coming-soon {
            display: inline-block;
            background: #dcfce7;
            color: var(--color-primary);
            border: 1px solid var(--color-primary-border);
            font-weight: 800;
            font-size: 0.75rem;
            letter-spacing: 0.08em;
            padding: 0.25rem 0.75rem;
            text-transform: uppercase;
            margin-bottom: 0.75rem;
        }

        .main-title {
            font-size: 1.625rem;
            font-weight: 800;
            color: var(--color-dark);
            line-height: 1.25;
            margin-bottom: 0.6rem;
        }

        @media (min-width: 640px) {
            .main-title {
                font-size: 2rem;
            }
        }

        .sub-title {
            font-size: 0.925rem;
            color: var(--color-text-muted);
            max-width: 640px;
            margin: 0 auto;
            line-height: 1.6;
        }

        /* Countdown Box Flat */
        .countdown-box {
            background-color: var(--color-dark);
            color: #ffffff;
            border: 2px solid var(--color-primary);
            padding: 1.25rem;
            margin-bottom: 1.75rem;
            text-align: center;
        }

        .countdown-heading {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: var(--color-primary-light);
            margin-bottom: 0.85rem;
        }

        .countdown-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 0.5rem;
            max-width: 480px;
            margin: 0 auto 1rem;
        }

        .time-card {
            background-color: var(--color-dark-surface);
            border: 1px solid var(--color-border-dark);
            padding: 0.65rem 0.25rem;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .time-value {
            font-size: 1.5rem;
            font-weight: 800;
            color: #ffffff;
            line-height: 1;
            margin-bottom: 0.25rem;
        }

        @media (min-width: 640px) {
            .time-value {
                font-size: 1.875rem;
            }
        }

        .time-label {
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #94a3b8;
            font-weight: 600;
        }

        /* Domain Target Highlight */
        .target-box {
            background: rgba(21, 128, 61, 0.15);
            border: 1px dashed var(--color-primary-light);
            padding: 0.75rem 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
            align-items: center;
            justify-content: center;
        }

        @media (min-width: 640px) {
            .target-box {
                flex-direction: row;
                gap: 0.75rem;
            }
        }

        .target-label {
            font-size: 0.8rem;
            color: #cbd5e1;
        }

        .target-link {
            font-size: 1.1rem;
            font-weight: 800;
            color: #4ade80;
            text-decoration: none;
        }

        .target-link:hover {
            text-decoration: underline;
        }

        /* Progress Launching Bar */
        .progress-section {
            background: #ffffff;
            border: 1px solid var(--color-border);
            padding: 1rem 1.25rem;
            margin-bottom: 1.5rem;
        }

        .progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.8rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            color: var(--color-dark);
        }

        .progress-track {
            width: 100%;
            height: 10px;
            background: #e2e8f0;
            overflow: hidden;
            margin-bottom: 0.5rem;
        }

        .progress-fill {
            height: 100%;
            background: var(--color-primary);
            width: 94%;
            transition: width 0.5s ease;
        }

        .progress-notes {
            font-size: 0.75rem;
            color: var(--color-text-muted);
            display: flex;
            align-items: center;
            gap: 0.35rem;
        }

        /* Section Headings */
        .section-heading {
            font-size: 0.95rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--color-dark);
            margin-bottom: 0.75rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            border-left: 4px solid var(--color-primary);
            padding-left: 0.5rem;
        }

        /* Table Rekapitulasi Flat Kompak */
        .table-container {
            overflow-x: auto;
            border: 1px solid var(--color-border);
            margin-bottom: 1.5rem;
        }

        table.rekap-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.825rem;
            text-align: left;
            background: #ffffff;
        }

        table.rekap-table th {
            background-color: #f1f5f9;
            color: var(--color-dark);
            font-weight: 700;
            padding: 0.6rem 0.75rem;
            border-bottom: 1px solid var(--color-border);
            text-transform: uppercase;
            font-size: 0.725rem;
            letter-spacing: 0.05em;
        }

        table.rekap-table td {
            padding: 0.6rem 0.75rem;
            border-bottom: 1px solid var(--color-border);
            color: #334155;
        }

        table.rekap-table tr:last-child td {
            border-bottom: none;
        }

        table.rekap-table tr:hover td {
            background-color: #f8fafc;
        }

        .badge-status {
            display: inline-block;
            padding: 0.2rem 0.45rem;
            font-size: 0.7rem;
            font-weight: 700;
            letter-spacing: 0.03em;
        }

        .badge-success {
            background: #dcfce7;
            color: #15803d;
            border: 1px solid #86efac;
        }

        .badge-warning {
            background: #fef9c3;
            color: #854d0e;
            border: 1px solid #fde047;
        }

        /* Guide Grid */
        .guide-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.75rem;
            margin-bottom: 1.5rem;
        }

        @media (min-width: 640px) {
            .guide-grid {
                grid-template-columns: 1fr 1fr;
            }
        }

        .guide-item {
            background: #f8fafc;
            border: 1px solid var(--color-border);
            padding: 0.85rem;
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
        }

        .guide-num {
            font-size: 0.7rem;
            font-weight: 800;
            color: var(--color-primary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .guide-title {
            font-size: 0.875rem;
            font-weight: 700;
            color: var(--color-dark);
        }

        .guide-desc {
            font-size: 0.8rem;
            color: var(--color-text-muted);
            line-height: 1.45;
        }

        /* Action & Contact Buttons */
        .action-box {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            margin-bottom: 1.5rem;
        }

        @media (min-width: 640px) {
            .action-box {
                flex-direction: row;
            }
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.75rem 1.25rem;
            font-size: 0.875rem;
            font-weight: 700;
            text-decoration: none;
            cursor: pointer;
            border: 1px solid transparent;
            transition: all 0.15s ease;
            flex: 1;
        }

        .btn-primary {
            background-color: var(--color-primary);
            color: #ffffff;
            border-color: var(--color-primary);
        }

        .btn-primary:hover {
            background-color: var(--color-primary-hover);
            border-color: var(--color-primary-hover);
        }

        .btn-whatsapp {
            background-color: #16a34a;
            color: #ffffff;
            border-color: #16a34a;
        }

        .btn-whatsapp:hover {
            background-color: #15803d;
        }

        /* Footer */
        footer {
            background-color: #ffffff;
            border-top: 1px solid var(--color-border);
            padding: 1.25rem 1rem;
            text-align: center;
            font-size: 0.75rem;
            color: var(--color-text-muted);
        }

        footer strong {
            color: var(--color-dark);
        }
    </style>
</head>
<body>

    <!-- Top Announcement Ribbon -->
    <div class="top-banner">
        <span class="badge-pulse">COMING SOON</span>
        <span>Masa Uji Coba Selesai • Persiapan Migrasi dari <strong class="font-mono"><?= htmlspecialchars($oldDomain) ?></strong> ke <strong class="font-mono">higopondok.id</strong></span>
    </div>

    <!-- Main Container -->
    <main class="container">
        <div class="main-card">
            
            <!-- Header Brand & Title -->
            <header class="header-section">
                <div class="logo-wrapper">
                    <?php if (file_exists(__DIR__ . '/logo.png')): ?>
                        <img src="logo.png" alt="Logo HiGO Hidayah Go" class="logo-img">
                    <?php else: ?>
                        <div class="logo-fallback">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                            </svg>
                            <span>HiGO PONDOK</span>
                        </div>
                    <?php endif; ?>
                </div>
                
                <div class="institution-tag">BUMP AL HIDAYAH • PPTQ AL MANNAN</div>
                <div class="badge-coming-soon">SEGERA HADIR • TAHAP FINALISASI</div>
                <h1 class="main-title">HiGO Pondok Segera Hadir di higopondok.id</h1>
                <p class="sub-title">
                    Masa uji coba (trial) operasional selama lebih dari 1 bulan di portal sementara <strong class="font-mono" style="color: var(--color-dark);"><?= htmlspecialchars($oldDomain) ?></strong> telah resmi selesai dengan sukses. Saat ini kami sedang mempersiapkan peluncuran penuh platform resmi di domain utama.
                </p>
            </header>

            <!-- Countdown Timer Box -->
            <section class="countdown-box" aria-label="Hitung Mundur Peluncuran">
                <div class="countdown-heading">Estimasi Peluncuran Resmi Platform:</div>
                
                <div class="countdown-grid">
                    <div class="time-card">
                        <span class="time-value font-mono" id="cdDays">03</span>
                        <span class="time-label">Hari</span>
                    </div>
                    <div class="time-card">
                        <span class="time-value font-mono" id="cdHours">12</span>
                        <span class="time-label">Jam</span>
                    </div>
                    <div class="time-card">
                        <span class="time-value font-mono" id="cdMinutes">45</span>
                        <span class="time-label">Menit</span>
                    </div>
                    <div class="time-card">
                        <span class="time-value font-mono" id="cdSeconds">00</span>
                        <span class="time-label">Detik</span>
                    </div>
                </div>

                <div class="target-box">
                    <span class="target-label">Domain Resmi Baru:</span>
                    <a href="<?= htmlspecialchars($newDomain) ?>" class="target-link font-mono" target="_blank" rel="noopener noreferrer">
                        <?= htmlspecialchars($newDomain) ?> ↗
                    </a>
                </div>
            </section>

            <!-- Progress Bar Kesiapan Sistem -->
            <div class="progress-section">
                <div class="progress-header">
                    <span>STATUS PERSIAPAN MIGRASI & DEPLOYMENT</span>
                    <span class="font-mono" style="color: var(--color-primary);">94% SELESAI</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill"></div>
                </div>
                <div class="progress-notes">
                    <span style="display: inline-block; width: 8px; height: 8px; background: #22c55e;"></span>
                    <span>Sinkronisasi database akun santri, saldo, dan merchant kantin telah rampung 100%.</span>
                </div>
            </div>

            <!-- Tabel Status Transisi Sistem -->
            <div class="section-heading">
                <span>Status Transisi Sistem</span>
            </div>
            
            <div class="table-container">
                <table class="rekap-table">
                    <thead>
                        <tr>
                            <th>Komponen Sistem</th>
                            <th>Portal Trial (Lama)</th>
                            <th>Platform Baru (Launching)</th>
                            <th class="font-mono text-right" style="text-align: right;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Akses Web / Domain</strong></td>
                            <td><del class="font-mono text-muted"><?= htmlspecialchars($oldDomain) ?></del></td>
                            <td><strong class="font-mono" style="color: var(--color-primary);">higopondok.id</strong></td>
                            <td style="text-align: right;"><span class="badge-status badge-warning">FINALISASI</span></td>
                        </tr>
                        <tr>
                            <td><strong>Evaluasi Trial (Uji Coba)</strong></td>
                            <td>&gt; 30 Hari Pengujian Terbuka</td>
                            <td>Siap Produksi Stabil</td>
                            <td style="text-align: right;"><span class="badge-status badge-success">SELESAI</span></td>
                        </tr>
                        <tr>
                            <td><strong>Data Akun & Saldo Santri</strong></td>
                            <td>Data Masa Uji Coba</td>
                            <td>Tersimpan Utuh & Terlindungi 100%</td>
                            <td style="text-align: right;"><span class="badge-status badge-success">AMAN</span></td>
                        </tr>
                        <tr>
                            <td><strong>Layanan Kantin & Jastip</strong></td>
                            <td>Kantin & Toko Asrama</td>
                            <td>Kantin, Toko, Ojek, Wali Santri & Keuangan</td>
                            <td style="text-align: right;"><span class="badge-status badge-success">LENGKAP</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Informasi Penting Selama Masa Transisi -->
            <div class="section-heading">
                <span>Pemberitahuan Selama Masa Transisi</span>
            </div>

            <div class="guide-grid">
                <div class="guide-item">
                    <span class="guide-num">INFORMASI 01</span>
                    <h3 class="guide-title">Akun & Saldo Tetap Utuh</h3>
                    <p class="guide-desc">
                        Seluruh akun santri, wali santri, admin kantin/toko, dan driver tetap sama. Anda <strong>tidak perlu mendaftar ulang</strong> saat portal baru dibuka.
                    </p>
                </div>

                <div class="guide-item">
                    <span class="guide-num">INFORMASI 02</span>
                    <h3 class="guide-title">Simpan Alamat Baru</h3>
                    <p class="guide-desc">
                        Domain resmi tunggal ke depan adalah <strong>https://higopondok.id</strong>. Harap simpan atau bookmark alamat ini di perangkat Anda.
                    </p>
                </div>

                <div class="guide-item">
                    <span class="guide-num">INFORMASI 03</span>
                    <h3 class="guide-title">Peningkatan Kecepatan & Fitur</h3>
                    <p class="guide-desc">
                        Platform baru didukung infrastruktur yang lebih cepat, anti blank screen, dan integrasi pencatatan keuangan akuntansi pondok terpadu.
                    </p>
                </div>

                <div class="guide-item">
                    <span class="guide-num">INFORMASI 04</span>
                    <h3 class="guide-title">Bantuan & Konfirmasi</h3>
                    <p class="guide-desc">
                        Jika ada pertanyaan mendesak terkait pesanan atau saldo santri selama masa transisi, silakan hubungi WhatsApp Admin BUMP Al Hidayah.
                    </p>
                </div>
            </div>

            <!-- Tombol Aksi & Bantuan -->
            <div class="action-box">
                <a href="<?= htmlspecialchars($newDomain) ?>" class="btn btn-primary" target="_blank" rel="noopener noreferrer">
                    Kunjungi higopondok.id ↗
                </a>
                <a href="<?= htmlspecialchars($supportWhatsApp) ?>" class="btn btn-whatsapp" target="_blank" rel="noopener noreferrer">
                    Hubungi WhatsApp Admin BUMP
                </a>
            </div>

        </div>
    </main>

    <!-- Footer Standar -->
    <footer>
        <div class="container" style="padding-top: 0; padding-bottom: 0;">
            <p><strong>HiGO Pondok (Hidayah Go)</strong> &copy; <?= date('Y') ?> BUMP Al Hidayah - PPTQ Al Mannan.</p>
            <p style="margin-top: 0.25rem;">Sistem Informasi Layanan Jastip Santri, Transaksi Kantin & Pertokoan Terpadu.</p>
        </div>
    </footer>

    <!-- Countdown Timer Script -->
    <script>
        (function() {
            var targetTime = <?= (int)$launchTimestamp ?> * 1000;
            
            var elDays = document.getElementById('cdDays');
            var elHours = document.getElementById('cdHours');
            var elMinutes = document.getElementById('cdMinutes');
            var elSeconds = document.getElementById('cdSeconds');

            function padZero(num) {
                return num < 10 ? '0' + num : num;
            }

            function updateCountdown() {
                var now = new Date().getTime();
                var diff = targetTime - now;

                if (diff <= 0) {
                    if (elDays) elDays.textContent = '00';
                    if (elHours) elHours.textContent = '00';
                    if (elMinutes) elMinutes.textContent = '00';
                    if (elSeconds) elSeconds.textContent = '00';
                    return;
                }

                var days = Math.floor(diff / (1000 * 60 * 60 * 24));
                var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                var seconds = Math.floor((diff % (1000 * 60)) / 1000);

                if (elDays) elDays.textContent = padZero(days);
                if (elHours) elHours.textContent = padZero(hours);
                if (elMinutes) elMinutes.textContent = padZero(minutes);
                if (elSeconds) elSeconds.textContent = padZero(seconds);
            }

            updateCountdown();
            setInterval(updateCountdown, 1000);
        })();
    </script>
</body>
</html>
