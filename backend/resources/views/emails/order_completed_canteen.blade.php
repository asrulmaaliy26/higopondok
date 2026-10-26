<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pesanan Selesai - Saldo Masuk #ORD-{{ $order->id }}</title>
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
        .badge-income {
            display: inline-block;
            background-color: #f0fdf4;
            color: #166534;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border: 1px solid #86efac;
            border-radius: 0px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 16px;
        }
        .highlight-income {
            background-color: #f0fdf4;
            border: 2px solid #22c55e;
            border-radius: 0px;
            padding: 16px;
            text-align: center;
            margin-bottom: 20px;
        }
        .highlight-income .label {
            font-size: 12px;
            font-weight: 600;
            color: #166534;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .highlight-income .amount {
            font-size: 24px;
            font-weight: 800;
            color: #15803d;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
            margin-top: 4px;
        }
        .info-box {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 0px;
            padding: 14px 16px;
            margin-bottom: 20px;
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
            padding: 10px;
            border: 1px solid #e2e8f0;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
        }
        .table-items td {
            padding: 10px;
            border: 1px solid #e2e8f0;
            vertical-align: middle;
        }
        .table-items .text-right {
            text-align: right;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
        }
        .table-items .text-center {
            text-align: center;
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
            <h1>Higo Pondok - Mitra Kantin</h1>
            <p>Notifikasi Transaksi Selesai & Saldo Masuk</p>
        </div>

        <!-- Body -->
        <div class="body">
            <div class="badge-income">Transaksi Sukses</div>

            <p style="margin-top: 0; font-size: 14px; line-height: 1.5;">
                Halo <strong>{{ $canteen->name ?? 'Pengelola Kantin' }}</strong>,
            </p>
            <p style="font-size: 14px; color: #4b5563; line-height: 1.5; margin-top: 0;">
                Pesanan <strong>#ORD-{{ $order->id }}</strong> telah dinyatakan selesai dan diterima oleh santri. Dana laba bersih penjualan telah otomatis dikreditkan ke saldo kantin Anda.
            </p>

            <!-- Card Saldo Masuk -->
            <div class="highlight-income">
                <div class="label">Laba Bersih Masuk ke Dompet Toko</div>
                <div class="amount">+ Rp {{ number_format((float) $order->canteen_income, 0, ',', '.') }}</div>
            </div>

            <!-- Detail Pesanan -->
            <div class="info-box">
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">No. Pesanan</td>
                        <td style="color: #111827; font-weight: 600; text-align: right; padding: 4px 0;">#ORD-{{ $order->id }}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">Nama Santri / Pemesan</td>
                        <td style="color: #111827; font-weight: 600; text-align: right; padding: 4px 0;">{{ $user->santri_name ?? $user->name }}</td>
                    </tr>
                    @if(!empty($user->santri_room) || !empty($user->santri_class))
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">Kamar / Kelas</td>
                        <td style="color: #111827; font-weight: 600; text-align: right; padding: 4px 0;">
                            {{ $user->santri_room ?? '-' }} / {{ $user->santri_class ?? '-' }}
                        </td>
                    </tr>
                    @endif
                    @if($courier)
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">Kurir Pengantar</td>
                        <td style="color: #111827; font-weight: 600; text-align: right; padding: 4px 0;">{{ $courier->name }}</td>
                    </tr>
                    @endif
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">Waktu Selesai</td>
                        <td style="color: #111827; font-weight: 600; text-align: right; padding: 4px 0;">{{ now()->timezone('Asia/Jakarta')->translatedFormat('d F Y, H:i') }} WIB</td>
                    </tr>
                </table>
            </div>

            <!-- Tabel Produk Terjual -->
            <p style="font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Barang Terjual:</p>
            <table class="table-items">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="text-center" style="width: 50px;">Qty</th>
                        <th class="text-right" style="width: 100px;">Harga Satuan</th>
                        <th class="text-right" style="width: 110px;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    @if($items && count($items) > 0)
                        @foreach($items as $item)
                        <tr>
                            <td>
                                <strong>{{ $item->product->name ?? 'Produk' }}</strong>
                                @if(!empty($item->notes))
                                <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">Catatan: {{ $item->notes }}</div>
                                @endif
                            </td>
                            <td class="text-center">{{ $item->quantity }}</td>
                            <td class="text-right">Rp {{ number_format($item->price, 0, ',', '.') }}</td>
                            <td class="text-right">Rp {{ number_format($item->subtotal, 0, ',', '.') }}</td>
                        </tr>
                        @endforeach
                    @elseif(!empty($order->custom_items))
                        @foreach($order->custom_items as $cItem)
                        <tr>
                            <td><strong>{{ $cItem['name'] ?? 'Pesanan Khusus' }}</strong></td>
                            <td class="text-center">{{ $cItem['quantity'] ?? 1 }}</td>
                            <td class="text-right">Rp {{ number_format($cItem['price'] ?? 0, 0, ',', '.') }}</td>
                            <td class="text-right">Rp {{ number_format(($cItem['price'] ?? 0) * ($cItem['quantity'] ?? 1), 0, ',', '.') }}</td>
                        </tr>
                        @endforeach
                    @endif
                </tbody>
            </table>

            <p style="font-size: 13px; color: #4b5563; margin-top: 20px; line-height: 1.5;">
                Anda dapat melihat rincian riwayat saldo dan melakukan penarikan dana melalui menu <strong>Keuangan & Saldo Kantin</strong> di dashboard aplikasi Higo Pondok.
            </p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p style="font-weight: 600; color: #374151;">Pondok Pesantren Al Mannan</p>
            <p>Email otomatis ini dikirim oleh sistem Higo Pondok untuk Mitra Kantin.</p>
        </div>
    </div>
</body>
</html>
