<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pesanan Khusus Masuk #ORD-{{ $order->id }}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1f2937;
            -webkit-text-size-adjust: none;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 0px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .header {
            background-color: #15803d;
            padding: 20px 24px;
            text-align: left;
            border-bottom: 3px solid #166534;
        }
        .header h1 {
            margin: 0;
            color: #ffffff;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        .header p {
            margin: 4px 0 0;
            color: #dcfce7;
            font-size: 13px;
        }
        .body {
            padding: 24px;
        }
        .badge-special {
            display: inline-block;
            background-color: #fef3c7;
            color: #92400e;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border: 1px solid #fde68a;
            border-radius: 0px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
        }
        .info-box {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 0px;
            padding: 14px 16px;
            margin-bottom: 20px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            padding: 5px 0;
            border-bottom: 1px dashed #e5e7eb;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .info-label {
            color: #6b7280;
            font-weight: 500;
        }
        .info-value {
            color: #111827;
            font-weight: 600;
            text-align: right;
        }
        .custom-notes-box {
            background-color: #fffbeb;
            border: 1px solid #fde68a;
            border-left: 4px solid #f59e0b;
            padding: 14px 16px;
            margin-bottom: 20px;
            border-radius: 0px;
        }
        .custom-notes-title {
            font-size: 12px;
            font-weight: 700;
            color: #b45309;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }
        .custom-notes-content {
            font-size: 14px;
            font-weight: 600;
            color: #1f2937;
            line-height: 1.5;
            white-space: pre-wrap;
        }
        .table-items {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            margin-bottom: 20px;
            font-size: 13px;
        }
        .table-items th {
            background-color: #f8fafc;
            color: #475569;
            text-align: left;
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
        }
        .table-items td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            vertical-align: middle;
        }
        .btn-action {
            display: inline-block;
            background-color: #15803d;
            color: #ffffff !important;
            font-size: 13px;
            font-weight: 700;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 0px;
            text-align: center;
        }
        .btn-wa {
            display: inline-block;
            background-color: #25d366;
            color: #ffffff !important;
            font-size: 13px;
            font-weight: 700;
            padding: 10px 18px;
            text-decoration: none;
            border-radius: 0px;
            text-align: center;
            margin-left: 8px;
        }
        .footer {
            background-color: #f9fafb;
            padding: 16px 24px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
        }
        .footer p {
            margin: 4px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>Higo Pondok Al Mannan</h1>
            <p>Notifikasi Pesanan Khusus / Titip Beli Baru Masuk</p>
        </div>

        <!-- Body -->
        <div class="body">
            <div class="badge-special">✨ Pesanan Khusus Baru Masuk (Perlu Penentuan Harga)</div>

            <p style="margin-top: 0; font-size: 14px; line-height: 1.5;">
                Pemberitahuan: Telah masuk <strong>1 Pesanan Khusus / Titip Beli</strong> baru dari wali santri. Mohon segera dicek ketersediaan barang dan ditentukan nominal harganya agar dapat diproses oleh toko/kantin.
            </p>

            <!-- Box Catatan Barang yang Diminta -->
            <div class="custom-notes-box">
                <div class="custom-notes-title">📝 Rincian Permintaan / Catatan Barang dari Santri/Wali:</div>
                <div class="custom-notes-content">{{ $order->custom_notes ?: 'Tidak ada catatan tertulis.' }}</div>
            </div>

            @if(!empty($order->custom_items) && is_array($order->custom_items))
            <table class="table-items">
                <thead>
                    <tr>
                        <th style="width: 35px; text-align: center;">No</th>
                        <th>Item / Barang Permintaan</th>
                        <th style="width: 80px; text-align: center;">Jumlah</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($order->custom_items as $idx => $ci)
                    <tr>
                        <td style="text-align: center; color: #6b7280;">{{ $idx + 1 }}</td>
                        <td style="font-weight: 600;">{{ $ci['item'] ?? '-' }}</td>
                        <td style="text-align: center;">{{ ($ci['quantity'] ?? 1) }} {{ $ci['unit'] ?? 'pcs' }}</td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
            @endif

            <!-- Info Pemesan & Santri -->
            <div class="info-box">
                <div class="info-row">
                    <span class="info-label">No. Pesanan:</span>
                    <span class="info-value font-mono">#ORD-{{ $order->id }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Kode Wadah / Checkout:</span>
                    <span class="info-value font-mono">{{ $order->checkout_id ?: '-' }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Toko / Kantin Tujuan:</span>
                    <span class="info-value">{{ $order->canteen?->name ?? 'Kantin Barokah Pusat' }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Nama Santri:</span>
                    <span class="info-value">{{ $order->recipient_santri_name ?: ($order->user?->name ?: '-') }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Asrama / Kamar:</span>
                    <span class="info-value">{{ $order->recipient_santri_room ?: ($order->delivery_location ?: '-') }}</span>
                </div>
                @if(!empty($order->recipient_santri_class) || !empty($order->recipient_santri_level))
                <div class="info-row">
                    <span class="info-label">Kelas & Jenjang:</span>
                    <span class="info-value">{{ $order->recipient_santri_level ?? '' }} {{ $order->recipient_santri_class ?? '' }}</span>
                </div>
                @endif
                <div class="info-row">
                    <span class="info-label">Akun Pemesan (Wali):</span>
                    <span class="info-value">{{ $order->user?->name ?? '-' }} ({{ $order->user?->email ?? '-' }})</span>
                </div>
                <div class="info-row">
                    <span class="info-label">No. WhatsApp Wali:</span>
                    <span class="info-value font-mono">{{ $order->recipient_phone ?: ($order->user?->phone ?: '-') }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Waktu Masuk:</span>
                    <span class="info-value">{{ $order->created_at ? $order->created_at->setTimezone('Asia/Jakarta')->format('d M Y, H:i') . ' WIB' : '-' }}</span>
                </div>
            </div>

            <!-- Estimasi Biaya Layanan -->
            <div class="info-box" style="margin-top: -10px;">
                <div class="info-row">
                    <span class="info-label">Ongkir Titip Beli:</span>
                    <span class="info-value font-mono">Rp {{ number_format($order->delivery_fee ?: 3500, 0, ',', '.') }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Biaya Layanan Admin:</span>
                    <span class="info-value font-mono">Rp {{ number_format($order->admin_fee ?: 2500, 0, ',', '.') }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Status Harga Produk:</span>
                    <span class="info-value" style="color: #d97706;">⏳ Menunggu Penetapan Harga oleh Toko</span>
                </div>
            </div>

            <!-- Action Buttons -->
            <div style="margin-top: 24px; text-align: left;">
                <a href="{{ $adminUrl }}" class="btn-action">Buka Dashboard Admin Pesanan →</a>
                @php
                    $waPhone = preg_replace('/[^0-9]/', '', $order->recipient_phone ?: ($order->user?->phone ?: ''));
                    if (str_starts_with($waPhone, '0')) {
                        $waPhone = '62' . substr($waPhone, 1);
                    }
                @endphp
                @if(!empty($waPhone))
                <a href="https://wa.me/{{ $waPhone }}?text={{ urlencode('Halo Bapak/Ibu ' . ($order->user?->name ?? 'Wali Santri') . ', terkait pesanan khusus #' . $order->id . ' untuk ananda ' . ($order->recipient_santri_name ?? 'Santri') . '...') }}" class="btn-wa" target="_blank">Chat WhatsApp Pemesan</a>
                @endif
            </div>

            <p style="margin-top: 24px; font-size: 12px; color: #6b7280; line-height: 1.5;">
                Email notifikasi ini dikirimkan secara otomatis oleh sistem HiGO Pondok Pesantren Al-Mannan ke alamat yang terdaftar di konfigurasi <code>SPECIAL_ORDER_NOTIFICATION_EMAIL</code>.
            </p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p><strong>HiGO Pondok Pesantren Al-Mannan</strong></p>
            <p>Layanan Belanja, Titip Beli & Kebutuhan Santri Digital</p>
            <p style="color: #9ca3af; font-size: 11px;">Email ini dihasilkan otomatis, mohon tidak membalas langsung ke alamat ini.</p>
        </div>
    </div>
</body>
</html>
