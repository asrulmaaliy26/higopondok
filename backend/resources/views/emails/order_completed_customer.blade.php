<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pesanan Selesai #ORD-{{ $order->id }}</title>
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
        .badge-success {
            display: inline-block;
            background-color: #dcfce7;
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
            padding: 4px 0;
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
        .summary-box {
            border-top: 2px solid #e5e7eb;
            padding-top: 12px;
            margin-top: 10px;
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            padding: 4px 0;
        }
        .summary-total {
            display: flex;
            justify-content: space-between;
            font-size: 16px;
            font-weight: 800;
            color: #15803d;
            border-top: 1px solid #e5e7eb;
            margin-top: 8px;
            padding-top: 8px;
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
            <p>Sistem Layanan Santri & Pesantren Digital</p>
        </div>

        <!-- Body -->
        <div class="body">
            <div class="badge-success">Pesanan Selesai & Diterima</div>

            <p style="margin-top: 0; font-size: 14px; line-height: 1.5;">
                Assalamu'alaikum <strong>{{ $user->name ?? 'Wali Santri / Santri' }}</strong>,
            </p>
            <p style="font-size: 14px; color: #4b5563; line-height: 1.5; margin-top: 0;">
                Kabar gembira! Pesanan Anda dengan nomor <strong>#ORD-{{ $order->id }}</strong> dari <strong>{{ $canteen->name ?? 'Kantin Pondok' }}</strong> telah berhasil diantar dan diterima dengan baik.
            </p>

            <!-- Informasi Pengantaran -->
            <div class="info-box">
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">No. Pesanan</td>
                        <td style="color: #111827; font-weight: 600; text-align: right; padding: 4px 0;">#ORD-{{ $order->id }}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">Nama Santri</td>
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
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">Lokasi Antar</td>
                        <td style="color: #111827; font-weight: 600; text-align: right; padding: 4px 0;">{{ $order->delivery_location ?? 'Pesantren Al Mannan' }}</td>
                    </tr>
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">Kantin / Toko</td>
                        <td style="color: #111827; font-weight: 600; text-align: right; padding: 4px 0;">{{ $canteen->name ?? 'Kantin' }}</td>
                    </tr>
                    @if($courier)
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">Kurir Pengantar</td>
                        <td style="color: #111827; font-weight: 600; text-align: right; padding: 4px 0;">{{ $courier->name }} ({{ $courier->phone ?? '-' }})</td>
                    </tr>
                    @endif
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">Waktu Selesai</td>
                        <td style="color: #111827; font-weight: 600; text-align: right; padding: 4px 0;">{{ now()->timezone('Asia/Jakarta')->translatedFormat('d F Y, H:i') }} WIB</td>
                    </tr>
                </table>
            </div>

            <!-- Tabel Rincian Item -->
            <p style="font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Rincian Barang:</p>
            <table class="table-items">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="text-center" style="width: 50px;">Qty</th>
                        <th class="text-right" style="width: 100px;">Harga</th>
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

            <!-- Ringkasan Finansial -->
            <div class="summary-box">
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">Subtotal Belanja</td>
                        <td style="text-align: right; font-family: monospace; padding: 4px 0;">
                            Rp {{ number_format(($items && count($items) > 0 ? $items->sum('subtotal') : $order->total_price - $order->delivery_fee - $order->admin_fee + ($order->voucher_discount ?? 0)), 0, ',', '.') }}
                        </td>
                    </tr>
                    @if($order->delivery_fee > 0)
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">Ongkos Kirim Kurir</td>
                        <td style="text-align: right; font-family: monospace; padding: 4px 0;">
                            Rp {{ number_format($order->delivery_fee, 0, ',', '.') }}
                        </td>
                    </tr>
                    @endif
                    @if($order->admin_fee > 0)
                    <tr>
                        <td style="color: #6b7280; padding: 4px 0;">Biaya Layanan/Admin</td>
                        <td style="text-align: right; font-family: monospace; padding: 4px 0;">
                            Rp {{ number_format($order->admin_fee, 0, ',', '.') }}
                        </td>
                    </tr>
                    @endif
                    @if(($order->voucher_discount ?? 0) > 0)
                    <tr>
                        <td style="color: #15803d; font-weight: 600; padding: 4px 0;">Potongan Voucher</td>
                        <td style="text-align: right; font-family: monospace; color: #15803d; font-weight: 600; padding: 4px 0;">
                            - Rp {{ number_format($order->voucher_discount, 0, ',', '.') }}
                        </td>
                    </tr>
                    @endif
                    <tr style="border-top: 1px solid #e5e7eb;">
                        <td style="font-size: 15px; font-weight: 700; color: #15803d; padding: 10px 0 0 0;">Total Pembayaran</td>
                        <td style="font-size: 15px; font-weight: 800; color: #15803d; text-align: right; font-family: monospace; padding: 10px 0 0 0;">
                            Rp {{ number_format($order->total_price, 0, ',', '.') }}
                        </td>
                    </tr>
                </table>
            </div>

            <p style="font-size: 13px; color: #4b5563; margin-top: 24px; line-height: 1.5;">
                Terima kasih telah mempercayai layanan <strong>Higo Pondok</strong>. Jika Anda memiliki pertanyaan atau kendala terkait pesanan ini, Anda dapat menghubungi pihak kantin atau pengurus pondok.
            </p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p style="font-weight: 600; color: #374151;">Pondok Pesantren Al Mannan</p>
            <p>Email otomatis ini dikirim oleh sistem Higo Pondok. Tidak perlu membalas email ini.</p>
        </div>
    </div>
</body>
</html>
