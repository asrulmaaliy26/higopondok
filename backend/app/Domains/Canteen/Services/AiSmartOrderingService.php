<?php

namespace App\Domains\Canteen\Services;

use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\Product;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class AiSmartOrderingService
{
    use GeminiModelPoolTrait;

    protected array $chatStopwords = [
        'saya', 'aku', 'kami', 'kita', 'gue', 'gua', 'lu', 'kamu', 'anda', 
        'mau', 'pengen', 'ingin', 'beli', 'pesan', 'order', 'tolong', 'minta', 'ambil',
        'antar', 'antarkan', 'kirim', 'ke', 'di', 'kamar', 'asrama', 'gedung',
        'level', 'lv', 'lvl', 'pedas', 'porsi', 'buah', 'bungkus', 'pcs', 'cup', 
        'gelas', 'mangkok', 'mangkuk', 'sama', 'dan', 'aja', 'cuma', 'saja', 'hanya', 
        'dong', 'kak', 'mas', 'mbak', 'bang', 'pak', 'bu', 'ya', 'kan', 'nih', 
        'buat', 'untuk', 'yang', 'ini', 'itu', 'ada', 'lagi', 'tambah'
    ];

    /**
     * Normalisasi teks santri: mengatasi angka menempel ("4MIa" -> "4 mie"),
     * typo pengetikan HP & Voice-to-Text slips ("aya mKulis" -> "ayam kulit", "baso" -> "bakso")
     */
    public function normalizeUserMessage(string $message): string
    {
        $text = trim($message);
        if (empty($text)) {
            return '';
        }

        // 1. Pisahkan angka yang menempel langsung dengan huruf (misal: "4MIa" -> "4 MIa", "2bakso" -> "2 bakso", "lv1" -> "lv 1")
        $text = preg_replace('/(\d+)([a-zA-Z]+)/u', '$1 $2', $text);
        $text = preg_replace('/([a-zA-Z]+)(\d+)/u', '$1 $2', $text);

        // 2. Normalisasi kata bilangan bahasa Indonesia menjadi angka jika diikuti nama makanan/porsi
        // Contoh: "empat mie ayam" -> "4 mie ayam", "dua porsi" -> "2 porsi"
        $wordNumbers = [
            'sepuluh' => '10',
            'sembilan' => '9',
            'delapan' => '8',
            'tujuh' => '7',
            'enam' => '6',
            'lima' => '5',
            'empat' => '4',
            'tiga' => '3',
            'dua' => '2',
            'satu' => '1',
        ];
        foreach ($wordNumbers as $word => $digit) {
            $text = preg_replace('/\b' . $word . '\b(?=\s*(?:porsi|buah|bungkus|cup|gelas|mangkok|mangkuk|[a-zA-Z]{3,}))/iu', $digit, $text);
        }

        // 3. Normalisasi pemisahan kata yang keliru akibat voice-to-text atau typo keyboard
        // Contoh: "aya mKulis" atau "aya m kulis" -> "ayam kulit"
        $text = preg_replace('/\baya\s+m([a-zA-Z]+)/iu', 'ayam $1', $text);
        $text = preg_replace('/\baya\s+m\b/iu', 'ayam', $text);
        $text = preg_replace('/\baym\b/iu', 'ayam', $text);
        $text = preg_replace('/\bayamm\b/iu', 'ayam', $text);

        // Kosa kata santri pesantren & takaran
        $text = preg_replace('/\bana\b/iu', 'saya', $text);
        $text = preg_replace('/\bantum\b/iu', 'kamu', $text);
        $text = preg_replace('/\bseporsi\b/iu', '1 porsi', $text);
        $text = preg_replace('/\bsebungkus\b/iu', '1 bungkus', $text);
        $text = preg_replace('/\bsegelas\b/iu', '1 gelas', $text);
        $text = preg_replace('/\bsecangkir\b/iu', '1 cangkir', $text);

        // 4. Typo ejaan makanan populer & phonetic slips
        // Mie: "mia", "mye", "mee", "mi" (bila berdiri sendiri sebagai kata makanan)
        $text = preg_replace('/\b(?:mia|mye|mee|mi)\b/iu', 'mie', $text);
        // Kulit: "kulis", "kullit", "kuli" (jika dalam konteks makanan)
        $text = preg_replace('/\b(?:kulis|kullit)\b/iu', 'kulit', $text);
        // Bakso: "baso", "baksoh", "baksso"
        $text = preg_replace('/\b(?:baso|baksoh|baksso)\b/iu', 'bakso', $text);
        // Mercon: "mer con"
        $text = preg_replace('/\bmer\s+con\b/iu', 'mercon', $text);
        // Gacoan: "gaco an"
        $text = preg_replace('/\bgaco\s+an\b/iu', 'gacoan', $text);
        // Hompimpa: "hom pim pa", "hompim pa"
        $text = preg_replace('/\bhom\s*pim\s*pa\b/iu', 'hompimpa', $text);
        // Es teh: "esteh", "estehmanis"
        $text = preg_replace('/\bestehmanis\b/iu', 'es teh manis', $text);
        $text = preg_replace('/\besteh\b/iu', 'es teh', $text);
        // Es jeruk: "esjeruk"
        $text = preg_replace('/\besjeruk\b/iu', 'es jeruk', $text);
        // Kopi susu: "kopisusu"
        $text = preg_replace('/\bkopisusu\b/iu', 'kopi susu', $text);
        // Ayam: "ayambakar", "ayamgoreng", "ayamgeprek", "ayampenyet"
        $text = preg_replace('/\bayambakar\b/iu', 'ayam bakar', $text);
        $text = preg_replace('/\bayamgoreng\b/iu', 'ayam goreng', $text);
        $text = preg_replace('/\bayamgeprek\b/iu', 'ayam geprek', $text);
        $text = preg_replace('/\bayampenyet\b/iu', 'ayam penyet', $text);
        // Nasi goreng: "nasgor"
        $text = preg_replace('/\bnasgor\b/iu', 'nasi goreng', $text);
        // Mie goreng/kuah: "migor", "mikuah", "miegoreng"
        $text = preg_replace('/\bmiegoreng\b/iu', 'mie goreng', $text);
        $text = preg_replace('/\bmigor\b/iu', 'mie goreng', $text);
        $text = preg_replace('/\bmikuah\b/iu', 'mie kuah', $text);
        // Dimsum: "dim sum", "dinsum"
        $text = preg_replace('/\b(?:dim\s+sum|dinsum)\b/iu', 'dimsum', $text);

        // 5. Bersihkan spasi ganda
        $text = preg_replace('/\s+/', ' ', $text);

        return trim($text);
    }

    /**
     * Proses pesan chat santri/wali menjadi respon percakapan ramah dan draf pesanan otomatis
     */
    public function processUserChat(string $message, ?User $user = null, array $history = []): array
    {
        $message = trim($message);
        if (empty($message)) {
            return [
                'reply_text' => 'Halo kak! Mau pesan apa hari ini? Ketik saja pesananmu, misalnya: "Pesan Mie Gacoan Lv 1 dua porsi sama Es Teh 2 antar ke kamar Al-Farabi 03".',
                'is_order_ready' => false,
                'canteens' => [],
                'summary' => [
                    'subtotal' => 0,
                    'items_subtotal' => 0,
                    'delivery_fee' => 3000,
                    'admin_fee' => 2000,
                    'grand_total' => 5000,
                ],
            ];
        }

        // Normalisasi cerdas pesan pengguna untuk menangani typo, voice recognition, dan angka menempel
        $normalizedMessage = $this->normalizeUserMessage($message);

        // Ambil produk yang tersedia beserta kantinnya
        $products = Product::where('is_available', 1)
            ->with('canteen')
            ->get();

        $userLocation = $user ? ($user->santri_room ?: ($user->delivery_location ?: 'Kamar Santri')) : 'Kamar Santri';

        // 0. Deteksi apakah santri/wali bertanya tentang status pesanan terkini (sudah diterima / sampai mana)
        $isCheckOrderIntent = preg_match('/(?:cek\s*(?:status\s*)?pesanan|status\s*pesanan|bagaimana\s*pesanan|pesanan\s*(?:saya|saat\s*ini|sampai\s*mana)|apakah\s*(?:sudah\s*)?(?:diterima|sampai|diantar)|sudah\s*(?:sampai|diterima|diantar)\s*(?:belum|santri)?|makanan\s*(?:saya\s*)?(?:sampai\s*mana|sudah\s*sampai)|lacak\s*pesanan)/i', $normalizedMessage);
        if ($isCheckOrderIntent) {
            return $this->checkRecentOrderStatus($user, $normalizedMessage);
        }

        $apiKey = $this->getApiKey();
        $result = null;
        $engineUsed = 'local_nlp';
        if (!empty($apiKey) && !\Illuminate\Support\Facades\Cache::get('gemini_api_rate_limited')) {
            $aiResult = $this->callGemini($normalizedMessage, $products, $userLocation, $history);
            if (!empty($aiResult) && is_array($aiResult)) {
                $result = $this->formatResult($aiResult, $userLocation);
                $engineUsed = 'gemini';
            }
        }

        // Fallback: Rule-based & Fuzzy catalog matcher (100% offline & instan < 50ms)
        if (!$result) {
            $result = $this->ruleBasedMatcher($normalizedMessage, $products, $userLocation, $history, $user);
            $engineUsed = 'local_nlp';
        }

        $result['engine_used'] = $engineUsed;
        $result['normalized_message'] = $normalizedMessage;

        // Cek apakah ada hal yang tidak diketahui AI atau santri butuh bantuan admin:
        // 1) Ada flag is_unknown_query dari AI
        // 2) Tidak ada menu yang cocok (order belum ready, canteens kosong) dan balasan mengandung indikasi ketidaktahuan/ketiadaan menu
        $replyLower = strtolower($result['reply_text'] ?? '');
        $isUnknown = !empty($result['is_unknown_query'])
            || (!$result['is_order_ready'] && empty($result['canteens']) && (
                str_contains($replyLower, 'belum mengetahui')
                || str_contains($replyLower, 'belum menemukan')
                || str_contains($replyLower, 'tidak menemukan')
                || str_contains($replyLower, 'tidak tahu')
                || str_contains($replyLower, 'hubungi admin')
            ));

        $isHelp = preg_match('/(?:bantuan|tolong\s*(?:bantu|admin)|hubungi\s*(?:admin|toko|kantin|cs|pengelola)|kontak\s*(?:admin|toko|kantin)|chat\s*(?:langsung\s*)?(?:admin|toko|kantin|cs)|komplain|kendala|masalah|wa\s*(?:admin|toko|kantin)|nomor\s*(?:admin|toko|kantin|wa)|customer\s*service|tanya\s*admin|bicara\s*dengan\s*admin)/i', $normalizedMessage);

        if (($isHelp || $isUnknown) && empty($result['support_contact'])) {
            $result['support_contact'] = $this->getSupportContacts(null, null, $user);
            $result['is_help_intent'] = true;
        }

        if ($isUnknown || $isHelp) {
            $quick = $result['quick_replies'] ?? [];
            if (!in_array('Chat WhatsApp Admin', $quick)) {
                array_unshift($quick, 'Chat WhatsApp Admin');
            }
            $result['quick_replies'] = array_values(array_unique($quick));
        }

        return $result;
    }

    /**
     * Cek status pesanan terkini santri (apakah sudah diterima / dalam perjalanan / menunggu)
     */
    public function checkRecentOrderStatus(?User $user, string $queryMessage = ''): array
    {
        $nowWib = Carbon::now('Asia/Jakarta');
        $currentHour = (int) $nowWib->format('G'); // 0 s/d 23
        $currentTimeStr = $nowWib->format('H:i') . ' WIB';
        $isPast8PM = $currentHour >= 20; // Pukul 20:00 (jam 8 malam) ke atas

        $scheduleBanner = "ℹ️ **Ketentuan Pengantaran & Pengambilan Pesanan Pondok**:\n"
            . "• 🛵 **Jadwal Antar Kurir**: Mulai pukul **17:00 s/d 21:00 WIB** (jam 5 sore - 9 malam).\n"
            . "• 📦 **Waktu Pengambilan Santri**: Santri dapat mulai mengambil pesanan mulai **pukul 20:00 WIB** (jam 8 malam).\n"
            . "• ✉️ **Notifikasi Email**: Begitu pesanan selesai diantar oleh kurir, bukti foto serah terima dan status selesai otomatis terkirim ke email akun Kakak.";

        if (!$user) {
            return [
                'reply_text' => "Mohon maaf kak, untuk mengecek status pesanan terkini, pastikan Kakak sudah login ke akun Santri / Wali ya! 😊\n\n{$scheduleBanner}",
                'is_order_ready' => false,
                'is_check_order' => true,
                'order_status_info' => null,
                'quick_replies' => ["Mau pesan makanan", "Ada menu apa aja?", "Bantuan CS / Admin"],
                'canteens' => [],
                'summary' => [
                    'subtotal' => 0,
                    'items_subtotal' => 0,
                    'delivery_fee' => 3000,
                    'admin_fee' => 2000,
                    'grand_total' => 5000,
                ],
            ];
        }

        // Ambil pesanan terbaru user (prioritaskan yang belum selesai, atau pesanan hari ini/terakhir)
        $order = Order::with(['canteen', 'courier', 'items.product'])
            ->where('user_id', $user->id)
            ->orderByRaw("CASE 
                WHEN status = 'processing' THEN 1 
                WHEN status = 'pending' THEN 2 
                WHEN status = 'completed' THEN 3 
                ELSE 4 
            END ASC")
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$order) {
            return [
                'reply_text' => "Saat ini belum ada riwayat pesanan aktif atas nama akun Kakak ({$user->name}). 😊\n\n"
                    . "{$scheduleBanner}\n\n"
                    . "Mau pesan makan, minum, atau titip beli sekarang? Tulis saja pesananmu langsung, misalnya:\n• *\"Pesan 1 Bakso Mercon antar ke kamar\"*\n• *\"2 Mie Gacoan Lv 1 sama Es Teh 2\"*",
                'is_order_ready' => false,
                'is_check_order' => true,
                'order_status_info' => null,
                'quick_replies' => [
                    "🍲 1 Bakso Mercon antar ke kamar",
                    "🍜 2 Mie Gacoan Lv 1",
                    "🥤 2 Es Teh Manis dingin",
                    "Bantuan CS / Kontak"
                ],
                'canteens' => [],
                'summary' => [
                    'subtotal' => 0,
                    'items_subtotal' => 0,
                    'delivery_fee' => 3000,
                    'admin_fee' => 2000,
                    'grand_total' => 5000,
                ],
            ];
        }

        $canteenName = $order->canteen ? $order->canteen->name : 'Kantin Pondok';
        $recipient = $order->recipient_santri_name ?: ($user->santri_name ?: $user->name);
        $room = $order->recipient_santri_room ?: ($order->delivery_location ?: 'Kamar Santri');
        $courierName = $order->courier ? $order->courier->name : null;
        $hasProof = !empty($order->proof_of_delivery);

        $itemsList = $order->items->map(function ($it) {
            $n = $it->product ? $it->product->name : 'Menu';
            return "{$it->quantity}x {$n}";
        })->implode(', ');
        if (empty($itemsList) && $order->is_custom) {
            $itemsList = $order->custom_notes ?: 'Titip Beli Luar';
        }

        $timeStr = $order->created_at ? $order->created_at->timezone('Asia/Jakarta')->format('d M Y, H:i') . ' WIB' : '';

        $statusLabel = '';
        $replyText = '';
        $isReceived = false;

        if ($order->status === 'completed') {
            $isReceived = true;
            $statusLabel = 'SELESAI (Sudah Bisa Diambil Santri)';

            if ($isPast8PM) {
                $replyText = "🕒 *Waktu Pengecekan: {$currentTimeStr} (Sudah lewat pukul 20:00 WIB)*\n\n"
                    . "✅ **HASIL PENGECEKAN: PESANAN SUDAH SELESAI & SUDAH DITERIMA OLEH SANTRI!** 🎉\n\n"
                    . "Alhamdulillah kak, kami sudah cek ke sistem: pesanan **#ORD-{$order->id}** ({$canteenName}) **SUDAH SELESAI DIANTAR OLEH KURIR** ke lokasi tujuan santri (**{$room}**)!\n\n"
                    . "Santri saat ini **sudah bisa mengambil pesanannya sekarang** di lokasi pengambilan santri. 📦\n\n"
                    . "📋 **Rincian Serah Terima**:\n"
                    . "• **Penerima**: {$recipient} ({$room})\n"
                    . "• **Menu**: {$itemsList}\n"
                    . "• **Kurir**: " . ($courierName ?: 'Kurir Pondok') . "\n"
                    . "• **Waktu Pesan**: {$timeStr}\n"
                    . ($hasProof ? "• **Bukti Serah Terima**: Foto bukti fisik pengantaran telah tersimpan di sistem ✅\n" : "")
                    . "• **Notifikasi Email**: Laporan konfirmasi penyelesaian otomatis telah terkirim ke email akun Kakak. ✉️\n\n"
                    . "Pesanan sudah aman sampai. Selamat menikmati ya kak! 😊";
            } else {
                $replyText = "Alhamdulillah kak! Pesanan **#ORD-{$order->id}** ({$canteenName}) **SUDAH DITERIMA OLEH SANTRI** (Selesai diantar lebih awal)! 🎉\n\n"
                    . "Santri sudah dapat mengambil pesanannya di lokasi tujuan (**{$room}**).\n\n"
                    . "📋 **Rincian Penerimaan**:\n"
                    . "• **Penerima**: {$recipient} ({$room})\n"
                    . "• **Menu**: {$itemsList}\n"
                    . "• **Kurir**: " . ($courierName ?: 'Kurir Pondok') . "\n"
                    . ($hasProof ? "• **Bukti Serah Terima**: Foto bukti fisik tersimpan di sistem ✅\n" : "")
                    . "• **Notifikasi Email**: Laporan pesanan telah kami kirimkan ke email akun Kakak. ✉️\n\n"
                    . "Selamat menikmati ya kak! 😊";
            }
        } elseif ($order->status === 'processing') {
            $statusLabel = 'Sedang Diproses & Diantar Kurir';

            if ($isPast8PM) {
                // Santri cek saat sudah jam 8 malam ke atas dan pesanan masih processing
                $replyText = "🕒 *Waktu Pengecekan: {$currentTimeStr} (Sudah melewati pukul 20:00 WIB)*\n\n"
                    . "⏳ **HASIL PENGECEKAN: PESANAN BELUM SELESAI (Sedang Diantar Kurir)** 🛵💨\n\n"
                    . "Kami telah mengecek ke sistem kurir: pesanan **#ORD-{$order->id}** ({$canteenName}) saat ini **SEDANG DALAM PERJALANAN / PROSES PENGANTARAN OLEH KURIR** (" . ($courierName ? "**{$courierName}**" : "Kurir Pondok") . ") menuju tujuan (**{$room}**).\n\n"
                    . "📋 **Status Terkini**:\n"
                    . "• **Penerima**: {$recipient} ({$room})\n"
                    . "• **Menu**: {$itemsList}\n"
                    . "• **Status Bayar**: " . ($order->payment_status === 'paid' ? 'Lunas / Terverifikasi ✅' : 'Menunggu Verifikasi') . "\n\n"
                    . "Jadwal pengantaran kurir berlangsung mulai pukul 17:00 hingga pukul 21:00 WIB (jam 9 malam). Mohon ditunggu sebentar ya kak, kurir sedang bergegas.\n\n"
                    . "✉️ **Begitu kurir selesai mengantarkan pesanan, foto bukti serah terima dan notifikasi otomatis akan langsung terkirim ke email akun Kakak!**";
            } else {
                // Santri cek sebelum jam 8 malam (misal sore jam 17.00 - 19.59)
                $replyText = "Pesanan **#ORD-{$order->id}** ({$canteenName}) saat ini **SEDANG DALAM PROSES PENYIAPAN & PENGANTARAN** oleh kurir! 🛵💨\n\n"
                    . "🕒 *Waktu saat ini: {$currentTimeStr}*\n\n"
                    . "{$scheduleBanner}\n\n"
                    . "📋 **Status Terkini**:\n"
                    . "• **Tujuan Antar**: {$recipient} ({$room})\n"
                    . "• **Menu**: {$itemsList}\n"
                    . "• **Kurir yang Bertugas**: " . ($courierName ? "**{$courierName}**" : "Kurir Pondok") . "\n"
                    . "• **Status Bayar**: " . ($order->payment_status === 'paid' ? 'Lunas / Terverifikasi ✅' : 'Menunggu Verifikasi') . "\n\n"
                    . "Santri dapat mulai mengambil pesanan mulai **pukul 20:00 WIB (jam 8 malam)** nanti ya kak. Begitu pengantaran selesai, notifikasi otomatis akan langsung terkirim ke email Kakak. Mohon ditunggu! 😊";
            }
        } elseif ($order->status === 'pending') {
            $statusLabel = 'Menunggu Konfirmasi / Pembayaran';
            $replyText = "Pesanan **#ORD-{$order->id}** ({$canteenName}) saat ini berstatus **MENUNGGU KONFIRMASI / PEMBAYARAN** (Belum diproses kurir). ⏳\n\n"
                . "{$scheduleBanner}\n\n"
                . "📋 **Status Terkini**:\n"
                . "• **Penerima**: {$recipient} ({$room})\n"
                . "• **Menu**: {$itemsList}\n"
                . "• **Status Bayar**: " . ($order->payment_status === 'paid' ? 'Lunas' : 'Belum Dibayar / Menunggu Bukti Transfer') . "\n\n"
                . "Silakan pastikan bukti transfer sudah diunggah di menu Pembayaran agar pesanan segera disiapkan toko dan diantarkan oleh kurir sore ini ya kak!";
        } else {
            $statusLabel = 'Dibatalkan';
            $replyText = "Pesanan **#ORD-{$order->id}** ({$canteenName}) berstatus **DIBATALKAN**. ⚠️\n\n"
                . "{$scheduleBanner}\n\n"
                . "Jika ini kekeliruan atau ingin memesan ulang, silakan ketik menu yang ingin Kakak pesan kembali ya!";
        }

        $supportContacts = $this->getSupportContacts($order->canteen_id, $canteenName);

        return [
            'reply_text' => $replyText,
            'is_order_ready' => false,
            'is_check_order' => true,
            'order_status_info' => [
                'order_id' => $order->id,
                'checkout_id' => $order->checkout_id,
                'status' => $order->status,
                'status_label' => $statusLabel,
                'is_received' => $isReceived,
                'canteen_name' => $canteenName,
                'recipient_name' => $recipient,
                'recipient_room' => $room,
                'courier_name' => $courierName,
                'items_text' => $itemsList,
                'total_price' => $order->total_price,
                'has_proof' => $hasProof,
                'time' => $timeStr,
            ],
            'support_contact' => $supportContacts,
            'quick_replies' => [
                "📦 Lihat Riwayat Pesanan",
                "💬 Chat Admin / Toko",
                "Mau pesan makanan lain",
                "Ada menu apa aja?"
            ],
            'canteens' => [],
            'summary' => [
                'subtotal' => 0,
                'items_subtotal' => 0,
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'grand_total' => 5000,
            ],
        ];
    }

    /**
     * Format nomor HP ke standar WhatsApp internasional (contoh: 0812 -> 62812)
     */
    public static function formatWaNumber(?string $phone): ?string
    {
        if (!$phone) {
            return null;
        }
        $digits = preg_replace('/[^0-9]/', '', $phone);
        if (empty($digits)) {
            return null;
        }
        if (str_starts_with($digits, '0')) {
            $digits = '62' . substr($digits, 1);
        } elseif (str_starts_with($digits, '8')) {
            $digits = '62' . $digits;
        }
        return $digits;
    }

    /**
     * Buat URL langsung kirim pesan WhatsApp
     */
    public static function createWaUrl(?string $phone, string $text = ''): ?string
    {
        $formatted = self::formatWaNumber($phone);
        if (!$formatted) {
            return null;
        }
        $query = !empty($text) ? '?text=' . urlencode($text) : '';
        return "https://wa.me/{$formatted}{$query}";
    }

    /**
     * Standar format salam pembuka WhatsApp untuk Santri & Wali
     * Format yang dipersyaratkan:
     * - Salam
     * - Nama santri, kelas, jenjang, dll
     * - Nama pengguna
     */
    public static function buildUserGreetingText(?User $user, string $recipientTitle = 'Admin HiGO Pondok', ?string $intent = null): string
    {
        $titlePart = $recipientTitle ? ", {$recipientTitle}" : '';
        $text = "Assalamu'alaikum Warahmatullahi Wabarakatuh{$titlePart}.\n\n";

        if ($user) {
            $userName = $user->name ?: 'Pengguna HiGO';
            if ($user->is_teacher) {
                $unit = $user->teacher_unit ? " (Unit: {$user->teacher_unit})" : '';
                $text .= "Guru / Staff: {$userName}{$unit}\n";
                $text .= "Nama Pengguna: {$userName}";
            } else {
                $santriName = $user->santri_name ?: $user->name;
                $details = [];
                if ($user->santri_class) {
                    $details[] = "Kelas: {$user->santri_class}";
                }
                if ($user->santri_level) {
                    $details[] = "Jenjang: {$user->santri_level}";
                }
                if ($user->santri_room) {
                    $details[] = "Kamar: {$user->santri_room}";
                }

                $detailStr = !empty($details) ? ' (' . implode(', ', $details) . ')' : '';
                $text .= "Nama Santri: {$santriName}{$detailStr}\n";
                $text .= "Nama Pengguna: {$userName}";
            }
        } else {
            $text .= "Nama Pengguna: Pengguna HiGO";
        }

        return $text;
    }

    /**
     * Ambil data kontak Admin HiGO Pondok dan Toko Kantin
     */
    public function getSupportContacts(?int $canteenId = null, ?string $canteenName = null, ?User $user = null): array
    {
        // 1. Ambil kontak Admin HiGO Pondok
        $admin = User::whereHas('roles', fn($rq) => $rq->whereIn('name', ['admin', 'super_admin']))
            ->whereNotNull('phone')
            ->where('phone', '!=', '')
            ->first();

        $adminPhone = $admin?->phone ?: '081234567890';
        $adminName = $admin?->name ?: 'Admin Pusat HiGO';
        $adminMsg = self::buildUserGreetingText($user, "Admin HiGO Pondok");
        $adminWa = self::createWaUrl($adminPhone, $adminMsg);

        // 2. Ambil Toko Spesifik (jika ada) atau toko buka pertama
        $canteen = null;
        if ($canteenId) {
            $canteen = Canteen::with('user')->find($canteenId);
        }
        if (!$canteen && $canteenName) {
            $canteen = Canteen::with('user')
                ->where('name', 'LIKE', "%{$canteenName}%")
                ->first();
        }
        if (!$canteen) {
            $canteen = Canteen::approved()->with('user')->first()
                ?: Canteen::with('user')->first();
        }

        $canteenData = null;
        if ($canteen) {
            $cPhone = $canteen->whatsapp_number ?: ($canteen->user?->phone ?: $adminPhone);
            $cMsg = self::buildUserGreetingText($user, "Admin Toko {$canteen->name}");
            $canteenData = [
                'id' => $canteen->id,
                'name' => $canteen->name,
                'category' => $canteen->category,
                'phone' => $cPhone,
                'wa_url' => self::createWaUrl($cPhone, $cMsg),
            ];
        }

        // Daftar semua toko aktif/terdaftar untuk pilihan santri
        $allCanteens = Canteen::approved()
            ->with('user')
            ->get()
            ->map(function ($c) use ($adminPhone, $user) {
                $cPhone = $c->whatsapp_number ?: ($c->user?->phone ?: $adminPhone);
                $msg = AiSmartOrderingService::buildUserGreetingText($user, "Toko {$c->name}");
                return [
                    'id' => $c->id,
                    'name' => $c->name,
                    'category' => $c->category,
                    'phone' => $cPhone,
                    'wa_url' => self::createWaUrl($cPhone, $msg),
                ];
            })
            ->values()
            ->all();

        return [
            'admin' => [
                'name' => $adminName,
                'role' => 'Admin Pengelola Pondok',
                'phone' => $adminPhone,
                'wa_url' => $adminWa,
            ],
            'canteen' => $canteenData,
            'all_canteens' => $allCanteens,
        ];
    }

    /**
     * Panggil Google Gemini API dengan System Catalog Prompt & Riwayat Chat Interaktif
     */
    protected function callGemini(string $message, $products, string $userLocation, array $history = []): ?array
    {
        $catalogLines = [];
        foreach ($products->take(300) as $p) {
            $cName = $p->canteen ? $p->canteen->name : 'Kantin';
            $cId = $p->canteen_id;
            
            $variantDetails = [];
            $cfg = $p->variant_config;
            if (is_array($cfg)) {
                if (!empty($cfg['spicy']['enabled'])) {
                    $opts = $cfg['spicy']['options'] ?? [];
                    $variantDetails[] = 'Level Pedas: [' . (!empty($opts) ? implode(', ', $opts) : 'Lv 0 s/d ' . ($cfg['spicy']['maxLevel'] ?? 5)) . ']';
                }
                if (!empty($cfg['temperature']['enabled'])) {
                    $variantDetails[] = 'Suhu: [Es / Dingin, Panas / Hangat]';
                }
                if (!empty($cfg['portion']['enabled'])) {
                    $variantDetails[] = 'Porsi: [Biasa, Jumbo]';
                }
            }
            $vStr = !empty($variantDetails) ? ' | Opsi: ' . implode('; ', $variantDetails) : '';

            $catalogLines[] = "- [ID: {$p->id}] {$p->name} | Rp {$p->price} | Toko: {$cName} (ID: {$cId}) | Kategori: {$p->category}{$vStr}";
        }
        $catalogStr = implode("\n", $catalogLines);

        // Format riwayat obrolan jika ada
        $historyText = "";
        if (!empty($history) && is_array($history)) {
            $historyLines = [];
            foreach (array_slice($history, -6) as $h) {
                $role = ($h['sender'] ?? 'user') === 'user' ? 'Santri' : 'Asisten AI';
                $t = trim($h['text'] ?? '');
                if ($t) {
                    $historyLines[] = "{$role}: \"{$t}\"";
                }
            }
            if (!empty($historyLines)) {
                $historyText = "Riwayat percakapan sebelumnya:\n" . implode("\n", $historyLines) . "\n\n";
            }
        }

        $prompt = "Kamu adalah 'Asisten Belanja AI Higo', asisten kasir dan kurir pribadi santri di aplikasi Higo Pondok Pesantren Al-Mannan.\n"
            . "Gayamu ramah, santun islami khas santri pesantren, cekatan, dan sangat interaktif layaknya mengobrol di WhatsApp.\n\n"
            . "Daftar Menu & Produk yang sedang tersedia di Toko/Kantin saat ini:\n"
            . "{$catalogStr}\n\n"
            . "Lokasi kamar bawaan santri: {$userLocation}\n\n"
            . "{$historyText}"
            . "Pesan terbaru dari santri:\n\"{$message}\"\n\n"
            . "ATURAN INTERAKSI PERCAKAPAN (SANGAT PENTING):\n"
            . "1. PERTANYAAN / EKSPLORASI MENU ATAU MENYEBUT KATEGORI UMUM (CONTOH: 'saya mau beli bakso', 'ada bakso apa aja', 'mau pesen mie apa ada', 'ada makanan apa', 'jual minuman apa aja', 'rekomendasi dong'):\n"
            . "   - JANGAN LANGSUNG MEMBUAT DRAF PESANAN jika santri hanya menyebut kata umum (seperti 'bakso') padahal di katalog ada banyak varian (seperti Bakso Sapi Halus, Bakso Mercon, Bakso Sapi Urat, dll)! Wajib set is_order_ready: false.\n"
            . "   - Balas dengan ramah bahwa menu tersebut ADA di kantin pondok, sebutkan daftar pilihan varian yang tersedia di katalog beserta toko, harga, dan opsinya.\n"
            . "   - Tanyakan santri ingin pesan varian yang mana, berapa porsi, dan antar ke kamar mana.\n"
            . "   - Sertakan opsi varian pilihan cepat di array 'quick_replies' (misal: ['Pesan Bakso Sapi Halus 1 porsi', 'Pesan Bakso Mercon 1 porsi', 'Pesan Bakso Sapi Urat 1 porsi']).\n\n"
            . "2. TANYAKAN VARIAN JIKA BELUM LENGKAP ATAU SESUAIKAN DENGAN PILIHAN RESMI TOKO:\n"
            . "   - Cek opsi varian di katalog untuk produk yang dipesan.\n"
            . "   - HANYA tawarkan varian yang BENAR-BENAR disediakan oleh toko untuk produk tersebut di katalog (Contoh: jika Bakso Mercon opsinya 'Sedang, Pedas, Ekstra Mercon', tanyakan opsi tersebut dan JANGAN tawarkan Lv 8; JANGAN tawarkan Es/Suhu untuk makanan seperti bakso/nasi/mie jika di katalog tidak ada opsi suhu).\n"
            . "   - Jika santri BELUM menyebutkan varian penting, TANYAKAN dengan menyebutkan pilihan resmi toko yang tertera di katalog, dan set is_order_ready: false.\n"
            . "   - Sertakan opsi varian resmi toko di 'quick_replies'.\n\n"
            . "3. MEMESAN LEBIH DARI 1 PORSI DENGAN VARIAN BERBEDA (MULTI-VARIAN):\n"
            . "   - Jika santri memesan 2 porsi atau lebih dengan level pedas berbeda (contoh: '2 mie gacoan, 1 level 1 dan 1 level 2' atau 'mie gacoan 2, satu tidak pedas satu level 3'):\n"
            . "   - PECAH produk tersebut menjadi item baris terpisah di array 'items'!\n"
            . "   - Contoh:\n"
            . "     Item 1: name 'Mie Gacoan', quantity: 1, notes: '[Lv 1]', price: 13000, subtotal: 13000\n"
            . "     Item 2: name 'Mie Gacoan', quantity: 1, notes: '[Lv 2]', price: 13000, subtotal: 13000\n\n"
            . "4. MEMESANKAN UNTUK SANTRI LAIN / ORANG LAIN (SANTRI/WALI CHAT):\n"
            . "   - Jika santri/wali menyebutkan memesankan untuk orang/santri lain (contoh: 'pesan buat santri Zaky kamar Al-Farabi 02', 'buat adik saya Muhammad Zaky di kamar Ibnu Rusyd 03', 'atas nama Ahmad kamar Umar 01'):\n"
            . "   - Ekstrak nama penerima ke field 'recipient_name' (misal: 'Muhammad Zaky') dan kamarnya ke 'recipient_room' dan 'delivery_location' (misal: 'Kamar Ibnu Rusyd 03').\n"
            . "   - Jika tidak ada penyebutan memesankan orang lain, set 'recipient_name': null.\n\n"
            . "5. MEMAHAMI KONTEKS REVISI & PEMBARUAN (UBAH VARIAN, UBAH/TAMBAH QUANTITY):\n"
            . "   - Jika santri berkata 'tambah 1 porsi lagi' atau 'tambah mie gacoan 1': TAMBAHKAN quantity item tersebut di draf.\n"
            . "   - Jika santri berkata 'kurangi 1' atau '1 porsi aja': UBAH quantity item menjadi sesuai permintaan.\n"
            . "   - Jika santri berkata 'ganti level 2', 'ubah jadi level 3', 'yang satu jangan pedas': UBAH catatan varian (notes) item yang dimaksud.\n"
            . "   - Jika santri berkata 'mie gacoan aja 2', kata 'aja' artinya MENGGANTI/MEMBATALKAN menu lama.\n"
            . "   - Jika santri berkata 'hapus udang keju': KELUARKAN produk tersebut dari draf pesanan.\n\n"
            . "6. KETIKA PESANAN SUDAH JELAS & PASTI (Item, Qty, Varian/Level, Lokasi Antar sudah jelas):\n"
            . "   - Set is_order_ready: true.\n"
            . "   - Hitung ongkir standar katalog: Rp 3.000, Admin: Rp 2.000 (atau Ongkir Rp 3.500 & Admin Rp 2.500 jika titip beli luar).\n"
            . "   - Buatkan draf ringkasan pesanan di canteens, summary, dan reply_text.\n"
            . "   - Berikan teks penutup: 'Silakan klik tombol [ ✅ Konfirmasi & Buatkan Pesanan ] di bawah untuk langsung memproses pesananmu!'.\n\n"
            . "7. BANTUAN, CS & HUBUNGI PENGELOLA (ADMIN / TOKO):\n"
            . "   - Jika santri meminta bantuan, kendala, komplain, atau ingin chat/tanya admin atau toko langsung:\n"
            . "   - Berikan tanggapan ramah bahwa tim pengelola dan toko siap membantu via WhatsApp langsung.\n"
            . "   - Wajib set is_order_ready: false.\n"
            . "   - Sertakan quick_replies: ['Chat WhatsApp Admin', 'Chat WhatsApp Toko', 'Mau pesan makanan'].\n\n"
            . "8. JIKA ADA YANG TIDAK KAMU KETAHUI / MENU ATAU PERTANYAAN DI LUAR KATALOG PONDOK:\n"
            . "   - Jika santri/pengguna bertanya sesuatu yang tidak ada di katalog, pertanyaan di luar sistem pemesanan kantin, atau hal apa pun yang tidak kamu ketahui:\n"
            . "   - JANGAN mengarang jawaban atau menu yang tidak ada!\n"
            . "   - Berikan jawaban yang santun dan ramah bahwa kamu belum mengetahui informasi tersebut / menu belum tersedia di sistem kantin saat ini.\n"
            . "   - Arahkan pengguna untuk langsung menghubungi Chat WhatsApp Admin HiGO Pondok melalui tombol di bawah.\n"
            . "   - Wajib set is_order_ready: false.\n"
            . "   - Wajib set is_unknown_query: true.\n"
            . "   - Wajib sertakan quick_replies: ['Chat WhatsApp Admin', 'Mau pesan makanan', 'Ada menu apa aja?'].\n\n"
            . "Format output JSON wajib:\n"
            . "{\n"
            . "  \"reply_text\": \"Teks balasan ramah & interaktif untuk santri...\",\n"
            . "  \"is_order_ready\": false / true,\n"
            . "  \"is_unknown_query\": false / true,\n"
            . "  \"is_custom\": false / true,\n"
            . "  \"delivery_location\": \"...\",\n"
            . "  \"recipient_name\": null / \"Nama Santri Lain\",\n"
            . "  \"recipient_room\": null / \"Kamar Santri Lain\",\n"
            . "  \"quick_replies\": [\"Pilihan 1\", \"Pilihan 2\"],\n"
            . "  \"custom_notes\": null,\n"
            . "  \"canteens\": [\n"
            . "    {\n"
            . "      \"canteen_id\": 4,\n"
            . "      \"canteen_name\": \"Mie Gacoan\",\n"
            . "      \"items\": [\n"
            . "        {\n"
            . "          \"product_id\": 11,\n"
            . "          \"name\": \"Mie Gacoan\",\n"
            . "          \"quantity\": 1,\n"
            . "          \"price\": 13000,\n"
            . "          \"notes\": \"[Lv 1]\",\n"
            . "          \"subtotal\": 13000\n"
            . "        }\n"
            . "      ]\n"
            . "    }\n"
            . "  ],\n"
            . "  \"summary\": {\n"
            . "    \"subtotal\": 26000,\n"
            . "    \"items_subtotal\": 26000,\n"
            . "    \"delivery_fee\": 3000,\n"
            . "    \"admin_fee\": 2000,\n"
            . "    \"grand_total\": 31000\n"
            . "  }\n"
            . "}";

        $payload = [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt]
                    ]
                ]
            ],
            'generationConfig' => [
                'response_mime_type' => 'application/json',
                'temperature' => 0.2,
            ],
        ];

        $apiKeys = $this->getActiveApiKeys();
        $models = $this->getAvailableModels();

        if (empty($apiKeys)) {
            return null;
        }

        foreach ($apiKeys as $apiKey) {
            foreach ($models as $model) {
                try {
                    $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
                    $res = Http::withHeaders(['Content-Type' => 'application/json'])
                        ->timeout(3.5)
                        ->post($endpoint, $payload);

                    if ($res->successful()) {
                        $json = $res->json();
                        $text = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;
                        if ($text) {
                            $decoded = json_decode(trim($text), true);
                            if (is_array($decoded) && isset($decoded['reply_text'])) {
                                return $decoded;
                            }
                        }
                    } elseif ($res->status() === 429 || $res->status() === 403) {
                        Log::warning("[AiSmartOrdering] Gemini API rate limit pada model {$model}: " . substr($res->body(), 0, 150));
                        $this->recordModelRateLimit($model, 30);
                        continue; // Langsung lompat ke model cadangan berikutnya
                    }
                } catch (\Throwable $e) {
                    Log::info("[AiSmartOrdering] Model {$model} error: " . $e->getMessage());
                }
            }
        }

        // Jika semua model gagal karena rate limit, kunci sementara 3 menit agar tidak membebani server
        \Illuminate\Support\Facades\Cache::put('gemini_api_rate_limited', true, now()->addMinutes(3));

        return null;
    }

    /**
     * Fallback NLP Cerdas: Rule-based, Tanya Jawab Menu, & Keyword Matching
     */
    public function ruleBasedMatcher(string $message, $products, string $userLocation, array $history = [], ?User $user = null): array
    {
        $lower = strtolower($message);

        // Deteksi apakah memesankan untuk santri/orang lain
        $recipientName = null;
        if (preg_match('/(?:untuk|buat|atas\s*nama|titip\s*ke)\s+(?:santri|adik\s*(?:saya)?|kakak\s*(?:saya)?|teman\s*(?:saya)?|anak\s*(?:saya)?)?\s*([A-Za-z\s]{2,25}?)(?=(?:\s+\d+|\s+(?:pesan|mau|tolong|antar|di|ke|kamar|asrama|kelas|ruang|,|\.|$)))/i', $message, $mRec)) {
            $candName = trim($mRec[1]);
            if (!empty($candName) && !preg_match('/^(?:pesan|makan|minum|mie|es|ayam|obat|titip|belikan)$/i', $candName)) {
                $recipientName = ucwords(strtolower($candName));
            }
        }

        // Deteksi lokasi pengantaran di dalam kalimat
        $loc = $userLocation;
        if (preg_match('/(?:ke|di|kamar|asrama|kantor|ruang)\s+([A-Za-z0-9\s\-_]{3,25})/i', $message, $mLoc)) {
            $loc = trim($mLoc[0]);
            $loc = preg_replace('/^(?:ke|di)\s+/i', '', $loc);
            $loc = ucwords(strtolower($loc));
        }

        // Cocokkan dengan data santri asli di database jika ada penyebutan nama penerima
        if ($recipientName) {
            try {
                $dbSantri = User::where(function ($q) use ($recipientName) {
                        $q->where('santri_name', $recipientName)
                          ->orWhere('name', $recipientName);
                    })
                    ->where(function ($q) {
                        $q->whereNotNull('santri_name')
                          ->orWhereHas('roles', fn($rq) => $rq->where('name', 'user'));
                    })
                    ->first();

                if (!$dbSantri) {
                    $dbSantri = User::where(function ($q) use ($recipientName) {
                            $q->where('santri_name', 'LIKE', "%{$recipientName}%")
                              ->orWhere('name', 'LIKE', "%{$recipientName}%");
                        })
                        ->where(function ($q) {
                            $q->whereNotNull('santri_name')
                              ->orWhereHas('roles', fn($rq) => $rq->where('name', 'user'));
                        })
                        ->first();
                }

                if ($dbSantri) {
                    $recipientName = $dbSantri->santri_name ?: $dbSantri->name;
                    if ($dbSantri->santri_room) {
                        $loc = $dbSantri->santri_room;
                    }
                }
            } catch (\Throwable $e) {
                Log::warning("AiSmartOrderingService::ruleBasedMatcher user lookup skipped: " . $e->getMessage());
            }
        }

        // 1a. Cek apakah santri bertanya tentang tarif ongkir & biaya kurir
        if (preg_match('/(?:ongkir\s*(?:berapa|nya\s*berapa|pengantaran|ke\s*kamar)?|biaya\s*ongkir|biaya\s*(?:antar|kirim|pengantaran)|tarif\s*ongkir|tarif\s*kurir)\b/i', $lower)) {
            return [
                'reply_text' => "Siap kak! Tarif ongkir kurir santri di Pondok Pesantren Al-Mannan sangat terjangkau:\n\n"
                    . "🛵 **Pesanan Kantin Pondok**: Flat **Rp 3.000** (antar langsung ke depan kamar/asrama)\n"
                    . "🛍️ **Titip Beli Luar (Apotek/Swalayan)**: Flat **Rp 3.500**\n"
                    . "📱 **Biaya Layanan Admin**: Rp 2.000 (kantin) / Rp 2.500 (titip beli)\n\n"
                    . "Mau pesan menu kantin atau titip beli barang sekarang kak? Silakan ketik pesananmu! 😊",
                'is_order_ready' => false,
                'recipient_name' => $recipientName,
                'recipient_room' => $loc,
                'quick_replies' => [
                    "Ada menu apa aja?",
                    "Rekomendasi makanan enak",
                    "Pesan 2 Mie Gacoan Lv 1",
                    "Titip beli obat di apotek"
                ],
                'canteens' => [],
                'summary' => [
                    'subtotal' => 0,
                    'items_subtotal' => 0,
                    'delivery_fee' => 3000,
                    'admin_fee' => 2000,
                    'grand_total' => 5000,
                ],
            ];
        }

        // 1. Cek apakah pesan hanya sapaan santai
        if (preg_match('/^(?:halo|hai|hi|assalamu[\w\s]+|selamat\s+(?:pagi|siang|sore|malam)|tes|test|p|ping)$/i', trim($lower))) {
            return [
                'reply_text' => "Wa'alaikumsalam kak! 😊 Saya Asisten Belanja AI Higo.\n\nMau pesan makan, minum, atau titip beli apa hari ini?\nKetik saja yang ingin kamu cari atau pesan, misalnya:\n• *\"Mau pesan mie apa ada?\"*\n• *\"Pesan Mie Gacoan Lv 1 dua porsi antar ke kamar {$loc}\"*",
                'is_order_ready' => false,
                'recipient_name' => null,
                'recipient_room' => $loc,
                'quick_replies' => [
                    "Mau pesan mie apa ada?",
                    "Ada menu makanan apa?",
                    "Pesan 2 Mie Gacoan Lv 1",
                    "Titip beli obat di apotek"
                ],
                'canteens' => [],
                'summary' => [
                    'subtotal' => 0,
                    'items_subtotal' => 0,
                    'delivery_fee' => 3000,
                    'admin_fee' => 2000,
                    'grand_total' => 5000,
                ],
            ];
        }

        // 1b. Cek apakah pengguna minta bantuan / chat admin / chat toko / CS / komplain / kendala
        $isHelpIntent = preg_match('/(?:bantuan|tolong\s*(?:bantu|admin)|hubungi\s*(?:admin|toko|kantin|cs|pengelola)|kontak\s*(?:admin|toko|kantin)|chat\s*(?:langsung\s*)?(?:admin|toko|kantin|cs)|komplain|kendala|masalah|wa\s*(?:admin|toko|kantin)|nomor\s*(?:admin|toko|kantin|wa)|customer\s*service|tanya\s*admin|bicara\s*dengan\s*admin)/i', $lower);

        if ($isHelpIntent) {
            $candCanteenName = null;
            if (preg_match('/(?:toko|kantin)\s+([A-Za-z0-9\s]{2,20})/i', $message, $mTk)) {
                $candCanteenName = trim($mTk[1]);
            }

            $support = $this->getSupportContacts(null, $candCanteenName, $user);
            $adminName = $support['admin']['name'];

            $reply = "Siap kak! Jika ada kendala, komplain pengantaran, atau butuh bantuan layanan santri, Kakak bisa langsung menghubungi Admin HiGO melalui kontak WhatsApp resmi di bawah ini:\n\n"
                . "📌 **Admin Pusat HiGO**: {$adminName}\n\n"
                . "Silakan klik tombol *Chat WhatsApp Admin* di bawah untuk langsung terhubung ya kak! 😊";

            return [
                'reply_text' => $reply,
                'is_order_ready' => false,
                'is_help_intent' => true,
                'support_contact' => $support,
                'quick_replies' => [
                    "Chat WhatsApp Admin",
                    "Cek status pesanan saya",
                    "Mau pesan makanan",
                    "Ada menu apa aja?"
                ],
                'canteens' => [],
                'summary' => [
                    'subtotal' => 0,
                    'items_subtotal' => 0,
                    'delivery_fee' => 3000,
                    'admin_fee' => 2000,
                    'grand_total' => 5000,
                ],
            ];
        }

        // 2. Cek apakah ini instruksi Titip Beli Luar (obat di apotek, sabun di swalayan, pulpen, buku, dll)
        $isTitipBeliIntent = preg_match('/(?:titip\s*beli|pesanan\s*khusus|apotek|swalayan|indomaret|alfamart|warung\s*madura|toko\s*kelontong|obat|paracetamol|panadol|tolak\s*angin|sabun|shampo|odol|sikat\s*gigi|buku\s*sidu|pulpen)/i', $lower);

        // Urutkan produk berdasarkan panjang nama terpanjang lebih dulu agar nama lebih spesifik dicocokkan duluan
        $sortedProducts = $products->sortByDesc(fn($p) => strlen($p->name));

        $matchedCanteens = [];
        $matchedProductIds = [];
        $coveredPhrases = [];
        $itemsSubtotal = 0;
        $needsLevelClarification = null;

        // Cek kata revisi/eksklusif ("aja", "cuma", "saja")
        $isExclusiveOrder = preg_match('/\b(?:aja|cuma|saja|ganti)\b/i', $lower);

        // Cek apakah ada multi-varian (misal: "1 level 1 dan 1 level 2" atau "1 lv 1 1 lv 2")
        $detectedMultiVariants = [];
        if (preg_match_all('/(?:(\d+|satu|dua|tiga)\s*(?:porsi)?\s*)?(?:level|lv|lvl)\s*(\d+)/i', $lower, $mvMatches, PREG_SET_ORDER)) {
            if (count($mvMatches) >= 2) {
                foreach ($mvMatches as $mvm) {
                    $mvQty = 1;
                    if (!empty($mvm[1])) {
                        if (is_numeric($mvm[1])) $mvQty = (int) $mvm[1];
                        elseif (strtolower($mvm[1]) === 'dua') $mvQty = 2;
                        elseif (strtolower($mvm[1]) === 'tiga') $mvQty = 3;
                    }
                    $detectedMultiVariants[] = [
                        'qty' => $mvQty,
                        'notes' => "[Lv {$mvm[2]}]"
                    ];
                }
            }
        }

        // A. Cek kecocokan produk spesifik terlebih dahulu
        // Pass 1: Prioritaskan produk spesifik / frase multi-kata (misal: "dimsum mentai", "mie ayam bakso", "nasi ayam geprek")
        // Pass 2: Baru cocokkan alias kata tunggal dasar (misal: "dimsum", "bakso") jika teks belum terkonsumsi
        $workText = $lower;
        foreach ([false, true] as $allowSingleWord) {
            foreach ($sortedProducts as $p) {
                if (in_array($p->id, $matchedProductIds)) {
                    continue;
                }
                $pNameClean = preg_replace('/\s+/', ' ', trim($p->name));
                $pNameLower = strtolower($pNameClean);
                
                // Hindari double match jika produk yang lebih spesifik sudah dicocokkan
                $isAlreadyCovered = false;
                foreach ($coveredPhrases as $cov) {
                    if (str_contains($cov, $pNameLower)) {
                        $isAlreadyCovered = true;
                        break;
                    }
                }
                if ($isAlreadyCovered) {
                    continue;
                }

                // Cek kecocokan kata nama produk secara cerdas terhadap sisa teks santri
                $matchedPhrase = null;
                $isMatch = $this->isProductMatch($workText, $pNameClean, $matchedPhrase, $allowSingleWord);

                if ($isMatch && !in_array($p->id, $matchedProductIds)) {
                    $matchedProductIds[] = $p->id;
                    $coveredPhrases[] = $pNameLower;

                    // Konsumsi frase yang cocok dari $workText agar tidak dicocokkan dobel oleh produk turunan
                    if ($matchedPhrase) {
                        $workText = preg_replace('/\b' . preg_quote($matchedPhrase, '/') . '\b/i', ' ___CONSUMED___ ', $workText, 1);
                        $workText = preg_replace('/\s+/', ' ', trim($workText));
                    }

                    $cId = $p->canteen_id;
                    $cName = $p->canteen ? $p->canteen->name : 'Kantin';
                    $price = (float) ($p->discount_price ?: $p->price);

                    if (!isset($matchedCanteens[$cId])) {
                        $matchedCanteens[$cId] = [
                            'canteen_id' => $cId,
                            'canteen_name' => $cName,
                            'items' => [],
                        ];
                    }

                    // Jika terdeteksi multi-varian untuk produk bervarian (misal: 1 Lv 1 dan 1 Lv 2)
                    $cfg = $p->variant_config;
                    if (!empty($detectedMultiVariants) && !empty($cfg['spicy']['enabled'])) {
                        foreach ($detectedMultiVariants as $mv) {
                            $subtotal = $price * $mv['qty'];
                            $itemsSubtotal += $subtotal;
                            $matchedCanteens[$cId]['items'][] = [
                                'product_id' => $p->id,
                                'name' => $p->name,
                                'quantity' => $mv['qty'],
                                'price' => $price,
                                'notes' => $mv['notes'],
                                'subtotal' => $subtotal,
                                'variant_config' => $p->variant_config,
                            ];
                        }
                    } else {
                        // Cari quantity spesifik untuk produk ini menggunakan seluruh variasi aliasnya
                        $qty = 1;
                        $aliases = $this->getProductAliases($p->name);
                        $pattList = array_map(fn($a) => preg_quote($a, '/'), $aliases);
                        $nameRegex = '(?:' . implode('|', $pattList) . ')';

                        if (preg_match('/(\d+)\s*(?:porsi|buah|bungkus|pcs|cup|gelas|mangkok|mangkuk)?\s*' . $nameRegex . '/i', $lower, $mQty)) {
                            $qty = (int) $mQty[1];
                        } elseif (preg_match('/' . $nameRegex . '\s*(?:aja\s*|level\s*\d+\s*|lv\s*\d+\s*)?(\d+)/i', $lower, $mQty)) {
                            $qty = (int) $mQty[1];
                        } elseif (preg_match('/(?:dua|2)\s*(?:porsi\s*)?' . $nameRegex . '/i', $lower)) {
                            $qty = 2;
                        } elseif (preg_match('/(?:tiga|3)\s*(?:porsi\s*)?' . $nameRegex . '/i', $lower)) {
                            $qty = 3;
                        } elseif (preg_match('/(?:empat|4)\s*(?:porsi\s*)?' . $nameRegex . '/i', $lower)) {
                            $qty = 4;
                        } elseif (preg_match('/(?:lima|5)\s*(?:porsi\s*)?' . $nameRegex . '/i', $lower)) {
                            $qty = 5;
                        }

                        // Fallback kuantitas HANYA jika kuantitas belum terdeteksi secara spesifik
                        if ($qty === 1) {
                            if (preg_match('/^(\d+)\s+' . $nameRegex . '/i', $lower, $mAwal)) {
                                $qty = (int) $mAwal[1];
                            } elseif (preg_match('/(?:dua|2)\s*porsi/i', $lower) && count($matchedProductIds) === 1) {
                                $qty = 2;
                            } elseif (preg_match('/(?:tiga|3)\s*porsi/i', $lower) && count($matchedProductIds) === 1) {
                                $qty = 3;
                            } elseif (preg_match('/(\d+)\s*porsi/i', $lower, $mPorsi) && count($matchedProductIds) === 1) {
                                $qty = (int) $mPorsi[1];
                            } elseif (preg_match('/(?:pesan|beli|mau)\s+(\d+)\s+/i', $lower, $mDepan) && count($matchedProductIds) === 1) {
                                $qty = (int) $mDepan[1];
                            }
                        }

                        // Cari catatan varian berdasarkan konfigurasi resmi toko
                        $notes = null;
                        $cfg = $p->variant_config;
                        $hasSpicy = !empty($cfg['spicy']['enabled']) || (!empty($cfg['spicy']['options']) && is_array($cfg['spicy']['options']));

                        if ($hasSpicy) {
                            $spicyOpts = $cfg['spicy']['options'] ?? [];
                            $matchedOpt = null;
                            foreach ($spicyOpts as $so) {
                                $soName = is_array($so) ? ($so['name'] ?? '') : (string)$so;
                                if (!empty($soName) && str_contains($lower, strtolower($soName))) {
                                    $matchedOpt = $soName;
                                    break;
                                }
                            }

                            if ($matchedOpt) {
                                $notes = "[{$matchedOpt}]";
                            } elseif (preg_match('/(?:level|lv|lvl)\s*(\d+)/i', $lower, $mLv)) {
                                $notes = "[Lv {$mLv[1]}]";
                            } elseif (str_contains($lower, 'tidak pedas') || str_contains($lower, 'gak pedas') || str_contains($lower, 'level 0') || str_contains($lower, 'lv 0')) {
                                $notes = "[Tidak Pedas]";
                            } elseif (str_contains($lower, 'pedas')) {
                                // Cari opsi pedas resmi toko jika ada
                                $pedasMatch = null;
                                foreach ($spicyOpts as $so) {
                                    $soName = is_array($so) ? ($so['name'] ?? '') : (string)$so;
                                    if (str_contains(strtolower($soName), 'pedas') || str_contains(strtolower($soName), 'mercon')) {
                                        $pedasMatch = $soName;
                                        break;
                                    }
                                }
                                $notes = $pedasMatch ? "[{$pedasMatch}]" : "[Pedas]";
                            } else {
                                // Default varian resmi toko pertama
                                if (!empty($spicyOpts)) {
                                    $firstOpt = is_array($spicyOpts[0]) ? ($spicyOpts[0]['name'] ?? 'Biasa') : (string)$spicyOpts[0];
                                    $notes = "[{$firstOpt}]";
                                } else {
                                    $notes = '[Lv 1]';
                                }
                            }
                        } else {
                            // Cek apakah produk adalah minuman
                            $hasTemp = !empty($cfg['temperature']['enabled']);
                            $isDrink = $hasTemp 
                                || strtolower($p->category ?? '') === 'minuman' 
                                || preg_match('/(?:es|teh|kopi|jus|susu|jeruk|wedang|soda)/i', $pNameLower);
                            
                            if ($isDrink) {
                                if (str_contains($lower, 'hangat') || str_contains($lower, 'panas')) {
                                    $notes = '[Panas / Hangat]';
                                } elseif (str_contains($lower, 'es') || str_contains($lower, 'dingin')) {
                                    $notes = '[Es / Dingin]';
                                } else {
                                    $notes = '[Es / Dingin]';
                                }
                            }
                        }

                        // Cek catatan kustom tambahan (misal: kuah dipisah, kuah campur, tanpa sayur, dsb)
                        if (preg_match('/(?:kuah\s*dipisah|kuah\s*campur|tanpa\s*(?:sayur|seledri|bawang|es|sambal)|ekstra\s*sambal)/i', $lower, $mCustomNote)) {
                            $cNote = ucwords(strtolower(trim($mCustomNote[0])));
                            $notes = $notes ? "{$notes} [{$cNote}]" : "[{$cNote}]";
                        }

                        $subtotal = $price * $qty;
                        $itemsSubtotal += $subtotal;

                        $matchedCanteens[$cId]['items'][] = [
                            'product_id' => $p->id,
                            'name' => $p->name,
                            'quantity' => $qty,
                            'price' => $price,
                            'notes' => $notes,
                            'subtotal' => $subtotal,
                            'variant_config' => $p->variant_config,
                        ];
                    }

                    if ($isExclusiveOrder) {
                        // Jika santri bilang "mie gacoan aja 2", batasi hanya produk ini
                        break 2;
                    }
                }
            }
        }

        // Jika santri menyebut menu bervarian pedas tapi belum sebut levelnya
        if ($needsLevelClarification && !empty($matchedCanteens)) {
            $pName = $needsLevelClarification->name;
            $cfg = $needsLevelClarification->variant_config;
            $spicyOpts = $cfg['spicy']['options'] ?? [];
            $spicyLabel = $cfg['spicy']['label'] ?? 'Level Pedas';

            if (!empty($spicyOpts)) {
                $optLines = [];
                $qrList = [];
                foreach ($spicyOpts as $so) {
                    $optName = is_array($so) ? ($so['name'] ?? '') : (string)$so;
                    if (!empty($optName)) {
                        $optLines[] = "• **{$optName}**";
                        if (count($qrList) < 5) {
                            $qrList[] = "{$pName} {$optName}";
                        }
                    }
                }
                $optsText = implode("\n", $optLines);
                $replyMsg = "Siap kak! Untuk **{$pName}**, mau pilihan **{$spicyLabel}** yang mana kak? 😊\n\nPilihan resmi yang disediakan toko:\n{$optsText}\n\nKetik saja atau tap pilihan di bawah:";
            } else {
                $max = $cfg['spicy']['maxLevel'] ?? 5;
                $replyMsg = "Siap kak! Untuk **{$pName}**, mau pedas **Level berapa** kak? (Tersedia Lv 0 s/d Lv {$max}) 😊\n\nKetik saja atau tap pilihan di bawah:";
                $qrList = [
                    "{$pName} Level 1",
                    "{$pName} Level 0 (Tidak Pedas)",
                    "{$pName} Level 2",
                    "{$pName} Level 3"
                ];
            }

            return [
                'reply_text' => $replyMsg,
                'is_order_ready' => false,
                'recipient_name' => $recipientName,
                'recipient_room' => $loc,
                'quick_replies' => $qrList,
                'canteens' => [],
                'summary' => [
                    'subtotal' => 0,
                    'items_subtotal' => 0,
                    'delivery_fee' => 3000,
                    'admin_fee' => 2000,
                    'grand_total' => 5000,
                ],
            ];
        }

        // Cek apakah santri menanyakan harga menu tertentu (Price Inquiry)
        $isPriceInquiry = preg_match('/(?:berapa\s*hargan?y?a?|harga\s*(?:menu\s*)?([a-zA-Z0-9\s]{2,20})?\s*berapa|hargan?y?a?\s*berapa|berapaan)\b/i', $lower);
        if ($isPriceInquiry && !empty($matchedCanteens)) {
            $priceLines = [];
            $quickReplies = [];
            $sampleName = '';
            foreach ($matchedCanteens as $c) {
                foreach ($c['items'] as $it) {
                    $priceFmt = number_format($it['price'], 0, ',', '.');
                    $priceLines[] = "• **{$it['name']}** [{$c['canteen_name']}] seharga **Rp {$priceFmt}** per porsi.";
                    if (empty($sampleName)) {
                        $sampleName = $it['name'];
                    }
                    if (count($quickReplies) < 3) {
                        $quickReplies[] = "Pesan {$it['name']} 1 porsi";
                        $quickReplies[] = "Pesan {$it['name']} 2 porsi";
                    }
                }
            }
            $replyText = "Tentu kak! Berikut informasi harga menu yang kamu tanyakan:\n\n"
                . implode("\n", $priceLines) . "\n\n"
                . "Mau saya pesankan sekarang? Ketik saja jumlah dan kamarmu (contoh: *\"Pesan 1 {$sampleName} antar ke kamar {$loc}\"*), atau tap tombol cepat di bawah! 😊";

            return [
                'reply_text' => $replyText,
                'is_order_ready' => false,
                'recipient_name' => $recipientName,
                'recipient_room' => $loc,
                'quick_replies' => array_values(array_unique($quickReplies)),
                'canteens' => [],
                'summary' => [
                    'subtotal' => 0,
                    'items_subtotal' => 0,
                    'delivery_fee' => 3000,
                    'admin_fee' => 2000,
                    'grand_total' => 5000,
                ],
            ];
        }

        // B. DETEKSI PERTANYAAN / EKSPLORASI MENU & KATEGORI UMUM (Misal: "saya mau beli bakso", "ada bakso apa aja", "mau pesen mie apa ada", "jual apa")
        if (empty($matchedCanteens)) {
            $foodKeywords = [
                'nasi goreng' => 'Nasi Goreng',
                'terang bulan' => 'Terang Bulan',
                'es teh' => 'Es Teh',
                'makanan' => 'Makanan',
                'minuman' => 'Minuman',
                'snack' => 'Snack / Camilan',
                'camilan' => 'Snack / Camilan',
                'cemilan' => 'Snack / Camilan',
                'bakso' => 'Bakso',
                'mie' => 'Mie',
                'seblak' => 'Seblak',
                'dimsum' => 'Dimsum',
                'ayam' => 'Ayam',
                'bebek' => 'Bebek',
                'nasgor' => 'Nasi Goreng',
                'nasi' => 'Nasi',
                'sate' => 'Sate',
                'martabak' => 'Martabak',
                'gorengan' => 'Gorengan',
                'kopi' => 'Kopi',
                'jus' => 'Jus',
                'minum' => 'Minuman',
                'makan' => 'Makanan',
                'es' => 'Minuman Es',
            ];

            $matchedKeyword = null;
            $matchedCategoryLabel = null;
            foreach ($foodKeywords as $kw => $label) {
                if (str_contains($lower, $kw)) {
                    $matchedKeyword = $kw;
                    $matchedCategoryLabel = $label;
                    break;
                }
            }

            $isAskingGeneralRecommend = preg_match('/(?:rekomendasi|saran|menu\s*(?:enak|favorit|laris|spesial|best\s*seller|andal)|makanan\s*enak|jajan\s*apa|bingung\s*mau\s*(?:makan|pesan|beli)|apa\s*yang\s*enak|yang\s*enak\s*apa)/i', $lower);
            $isAskingStoreExplore = preg_match('/(?:toko\s*apa|kantin\s*apa|ada\s*toko\s*apa|daftar\s*toko|toko\s*(?:buka|mana)|kantin\s*(?:buka|mana))/i', $lower);
            $isAskingExplore = $matchedKeyword !== null || $isAskingGeneralRecommend || $isAskingStoreExplore || preg_match('/(?:apa\s*(?:ada|aja)|ada\s*apa|menu\s*apa|jual\s*apa|pilihan|list|daftar|spesial|apakah\s*ada|mau\s*(?:beli|pesan|makan|minum)|ingin\s*(?:beli|pesan)|pengen\s*(?:beli|makan|minum)?|cari|butuh)/i', $lower);

            if ($isAskingExplore) {
                // 1. Rekomendasi / Informasi Toko & Kantin yang Buka
                if ($isAskingStoreExplore) {
                    try {
                        $canteens = Canteen::approved()->with('user')->get();
                    } catch (\Throwable $e) {
                        Log::warning("AiSmartOrderingService store explore DB skipped: " . $e->getMessage());
                        $canteens = collect();
                    }
                    $lines = ["🏪 **Daftar Toko & Kantin Resmi di Pondok Pesantren Al-Mannan**:\n"];
                    $quickReplies = [];
                    foreach ($canteens as $c) {
                        $openStatus = $c->is_open ? "🟢 Buka" : "🔴 Tutup";
                        $hours = ($c->open_time && $c->close_time) ? " (" . substr($c->open_time, 0, 5) . " - " . substr($c->close_time, 0, 5) . " WIB)" : "";
                        $lines[] = "• **{$c->name}** [{$c->category}] — {$openStatus}{$hours}";
                        if (count($quickReplies) < 4) {
                            $quickReplies[] = "Lihat menu {$c->name}";
                        }
                    }
                    $lines[] = "\nKakak mau pesan menu dari toko mana? Ketik nama toko atau langsung ketik menu yang ingin dipesan! 😊";

                    return [
                        'reply_text' => implode("\n", $lines),
                        'is_order_ready' => false,
                        'recipient_name' => $recipientName,
                        'recipient_room' => $loc,
                        'quick_replies' => array_values(array_unique($quickReplies)),
                        'canteens' => [],
                        'summary' => [
                            'subtotal' => 0,
                            'items_subtotal' => 0,
                            'delivery_fee' => 3000,
                            'admin_fee' => 2000,
                            'grand_total' => 5000,
                        ],
                    ];
                }

                // 2. Rekomendasi Umum Terstruktur (Makanan Favorit + Minuman Segar + Camilan)
                if ($isAskingGeneralRecommend || empty($matchedKeyword)) {
                    $foods = $products->filter(fn($p) => in_array(strtolower($p->category ?? ''), ['makanan', 'food', 'berat', 'utama']) || preg_match('/(?:mie|bakso|ayam|nasi|geprek|bebek|sate)/i', $p->name))->take(4);
                    $drinks = $products->filter(fn($p) => in_array(strtolower($p->category ?? ''), ['minuman', 'drink', 'beverage']) || preg_match('/(?:es|teh|kopi|jus|boba|susu|lemon|tea)/i', $p->name))->take(3);
                    $snacks = $products->filter(fn($p) => in_array(strtolower($p->category ?? ''), ['camilan', 'snack', 'jajanan']) || preg_match('/(?:dimsum|gorengan|roti|kentang|nugget|tahu|cireng|siomay)/i', $p->name))->take(3);

                    if ($foods->isEmpty()) $foods = $products->take(4);
                    if ($drinks->isEmpty()) $drinks = $products->skip(4)->take(3);

                    $lines = ["🌟 **Rekomendasi Menu Terfavorit & Paling Laris Hari Ini di Higo Pondok**:\n"];
                    $quickReplies = [];

                    if ($foods->isNotEmpty()) {
                        $lines[] = "🍛 **Makanan Terfavorit**:";
                        foreach ($foods as $f) {
                            $cName = $f->canteen ? $f->canteen->name : 'Kantin';
                            $lines[] = "• **{$f->name}** - Rp " . number_format($f->price, 0, ',', '.') . " [{$cName}]";
                            if (count($quickReplies) < 2) {
                                $quickReplies[] = "Pesan {$f->name} 1 porsi";
                            }
                        }
                        $lines[] = "";
                    }

                    if ($drinks->isNotEmpty()) {
                        $lines[] = "🥤 **Minuman Segar**:";
                        foreach ($drinks as $d) {
                            $cName = $d->canteen ? $d->canteen->name : 'Kantin';
                            $lines[] = "• **{$d->name}** - Rp " . number_format($d->price, 0, ',', '.') . " [{$cName}]";
                            if (count($quickReplies) < 3) {
                                $quickReplies[] = "Pesan {$d->name} 1";
                            }
                        }
                        $lines[] = "";
                    }

                    if ($snacks->isNotEmpty()) {
                        $lines[] = "🍟 **Camilan / Snack Asyik**:";
                        foreach ($snacks as $s) {
                            $cName = $s->canteen ? $s->canteen->name : 'Kantin';
                            $lines[] = "• **{$s->name}** - Rp " . number_format($s->price, 0, ',', '.') . " [{$cName}]";
                            if (count($quickReplies) < 4) {
                                $quickReplies[] = "Pesan {$s->name} 1 porsi";
                            }
                        }
                        $lines[] = "";
                    }

                    $lines[] = "Kakak mau pesan yang mana? Cukup ketik menu dan kamarmu (contoh: *\"Pesan Mie Gacoan Lv 1 sama Es Teh antar ke kamar {$loc}\"*), atau tap tombol cepat di bawah! 😊";

                    return [
                        'reply_text' => implode("\n", $lines),
                        'is_order_ready' => false,
                        'recipient_name' => $recipientName,
                        'recipient_room' => $loc,
                        'quick_replies' => array_values(array_unique($quickReplies)),
                        'canteens' => [],
                        'summary' => [
                            'subtotal' => 0,
                            'items_subtotal' => 0,
                            'delivery_fee' => 3000,
                            'admin_fee' => 2000,
                            'grand_total' => 5000,
                        ],
                    ];
                }

                // 3. Rekomendasi / Eksplorasi Kategori Tertentu (Makanan, Minuman, Snack, Mie, Bakso, dsb.)
                $matchedList = $products->filter(function ($p) use ($matchedKeyword) {
                    if ($matchedKeyword) {
                        $pNameLower = strtolower($p->name);
                        $pCatLower = strtolower($p->category ?? '');

                        if (in_array($matchedKeyword, ['makanan', 'makan'])) {
                            return in_array($pCatLower, ['makanan', 'food', 'berat', 'utama'])
                                || preg_match('/(?:mie|bakso|ayam|nasi|geprek|bebek|sate|soto|penyet|lele|steak)/i', $pNameLower);
                        }

                        if (in_array($matchedKeyword, ['snack', 'camilan', 'cemilan'])) {
                            return in_array($pCatLower, ['snack', 'camilan', 'snack & camilan'])
                                || str_contains($pCatLower, 'snack')
                                || str_contains($pCatLower, 'camilan')
                                || preg_match('/(?:dimsum|gorengan|roti|kentang|nugget|tahu|cireng|siomay|terang bulan|seblak|udang keju|pangsit)/i', $pNameLower);
                        }

                        if (in_array($matchedKeyword, ['minuman', 'minum'])) {
                            return in_array($pCatLower, ['minuman', 'drink', 'beverage'])
                                || preg_match('/(?:es|teh|kopi|jus|boba|susu|lemon|tea)/i', $pNameLower);
                        }

                        return str_contains($pNameLower, $matchedKeyword) 
                            || str_contains($pCatLower, $matchedKeyword);
                    }
                    return false;
                })->take(7);

                if ($matchedList->isNotEmpty()) {
                    $label = $matchedCategoryLabel ?: 'pilihan';
                    $lines = ["Tentu ada kak! Di kantin pondok tersedia aneka pilihan menu **{$label}** yang siap dipesan:"];
                    $quickReplies = [];
                    foreach ($matchedList as $item) {
                        $cName = $item->canteen ? $item->canteen->name : 'Kantin';
                        $priceFmt = number_format($item->price, 0, ',', '.');
                        
                        $vHint = "";
                        $cfg = $item->variant_config;
                        if (!empty($cfg['spicy']['enabled'])) {
                            $vHint = " *(Tersedia Level 0 s/d 8)*";
                        } elseif (!empty($cfg['temperature']['enabled'])) {
                            $vHint = " *(Es / Panas)*";
                        }
                        $lines[] = "• **{$item->name}** - Rp {$priceFmt} [{$cName}]{$vHint}";

                        if (count($quickReplies) < 4) {
                            $quickReplies[] = "Pesan {$item->name} 1 porsi";
                        }
                    }
                    $lines[] = "\nKakak mau pesan varian **{$label}** yang mana, berapa porsi, dan antar ke kamar mana? 😊";

                    return [
                        'reply_text' => implode("\n", $lines),
                        'is_order_ready' => false,
                        'recipient_name' => $recipientName,
                        'recipient_room' => $loc,
                        'quick_replies' => $quickReplies,
                        'canteens' => [],
                        'summary' => [
                            'subtotal' => 0,
                            'items_subtotal' => 0,
                            'delivery_fee' => 3000,
                            'admin_fee' => 2000,
                            'grand_total' => 5000,
                        ],
                    ];
                }
            }
        }

        // C. Cek apakah ini instruksi Titip Beli Luar (obat di apotek, sabun di swalayan, pulpen, buku, dll)
        if (empty($matchedCanteens) && $isTitipBeliIntent) {
            $defaultCanteen = null;
            try {
                $defaultCanteen = Canteen::first();
            } catch (\Throwable $e) {
                Log::warning("AiSmartOrderingService titip beli DB skipped: " . $e->getMessage());
            }
            $cId = $defaultCanteen ? $defaultCanteen->id : 4;
            $cName = $defaultCanteen ? $defaultCanteen->name : 'Kantin / Toko Titip Beli';

            $parser = new CustomOrderParserService();
            $customItems = $parser->parseNotes($message);

            $replyLines = ["Siap kak! Saya siapkan draf **Pesanan Khusus (Titip Beli)** untuk barang yang dipesan:"];
            foreach ($customItems as $ci) {
                $replyLines[] = "• {$ci['quantity']} {$ci['unit']} **{$ci['item']}**";
            }
            if ($recipientName) {
                $replyLines[] = "• **Penerima**: {$recipientName}";
            }
            $replyLines[] = "• **Tujuan Antar**: {$loc}";
            $replyLines[] = "• **Tarif Titip Beli**: Ongkir Rp 3.500 | Admin Rp 2.500";
            $replyLines[] = "• *(Harga barang akan ditentukan oleh toko/kurir setelah dibeli)*";
            $replyLines[] = "\nSilakan klik tombol [ ✅ Konfirmasi & Buatkan Pesanan ] di bawah untuk langsung memproses pesananmu!";

            return [
                'reply_text' => implode("\n", $replyLines),
                'is_order_ready' => true,
                'is_custom' => true,
                'delivery_location' => $loc,
                'recipient_name' => $recipientName,
                'recipient_room' => $loc,
                'quick_replies' => [],
                'custom_notes' => $message,
                'custom_items' => $customItems,
                'canteens' => [
                    [
                        'canteen_id' => $cId,
                        'canteen_name' => $cName,
                        'items' => [],
                    ]
                ],
                'summary' => [
                    'subtotal' => 0,
                    'items_subtotal' => 0,
                    'delivery_fee' => 3500,
                    'admin_fee' => 2500,
                    'grand_total' => 6000,
                ],
            ];
        }

        // D. Jika produk katalog ditemukan dan sudah siap
        if (!empty($matchedCanteens)) {
            $deliveryFee = 3000;
            $adminFee = 2000;
            $grandTotal = $itemsSubtotal + $deliveryFee + $adminFee;

            $replyLines = ["Siap kak! Berikut ringkasan pesanan yang saya siapkan:"];
            foreach ($matchedCanteens as $c) {
                foreach ($c['items'] as $it) {
                    $variantStr = $it['notes'] ? " {$it['notes']}" : "";
                    $subFmt = number_format($it['subtotal'], 0, ',', '.');
                    $replyLines[] = "• **{$it['quantity']}x {$it['name']}{$variantStr}** (Rp {$subFmt})";
                }
            }
            if ($recipientName) {
                $replyLines[] = "• **Penerima**: {$recipientName}";
            }
            $replyLines[] = "• **Tujuan Antar**: {$loc}";
            $replyLines[] = "• **Ongkir**: Rp " . number_format($deliveryFee, 0, ',', '.') . " | **Admin**: Rp " . number_format($adminFee, 0, ',', '.');
            $replyLines[] = "• **Estimasi Total**: **Rp " . number_format($grandTotal, 0, ',', '.') . "**";
            $replyLines[] = "\nSilakan klik tombol di bawah untuk langsung memproses pesananmu!";

            return [
                'reply_text' => implode("\n", $replyLines),
                'is_order_ready' => true,
                'is_custom' => false,
                'delivery_location' => $loc,
                'recipient_name' => $recipientName,
                'recipient_room' => $loc,
                'quick_replies' => [],
                'custom_notes' => null,
                'canteens' => array_values($matchedCanteens),
                'summary' => [
                    'subtotal' => $itemsSubtotal,
                    'items_subtotal' => $itemsSubtotal,
                    'delivery_fee' => $deliveryFee,
                    'admin_fee' => $adminFee,
                    'grand_total' => $grandTotal,
                ],
            ];
        }

        // E. Jika tidak ada kata yang cocok sama sekali / tidak diketahui AI
        return [
            'reply_text' => "Maaf kak, saya belum mengetahui informasi atau menemukan menu \"{$message}\" di katalog kantin pondok saat ini. 😅\n\nUntuk pertanyaan lebih lanjut atau kendala, Kakak bisa langsung menghubungi Chat Admin HiGO Pondok melalui tombol di bawah ya kak!\n\nMenu populer yang tersedia di kantin antara lain:\n• Aneka **Bakso** (Bakso Mercon, Bakso Sapi Halus, Bakso Urat)\n• **Mie Gacoan** (Tersedia Lv 0 s/d 8)\n• **Nasi Ayam & Nasi Goreng**\n• Aneka Minuman Segar & Camilan",
            'is_order_ready' => false,
            'is_unknown_query' => true,
            'recipient_name' => null,
            'recipient_room' => $loc,
            'support_contact' => $this->getSupportContacts(null, null, $user),
            'quick_replies' => [
                "Chat WhatsApp Admin",
                "Ada menu bakso apa aja?",
                "Mau pesan mie apa ada?",
                "Pesan 2 Mie Gacoan Lv 1",
                "Titip beli obat di apotek"
            ],
            'canteens' => [],
            'summary' => [
                'subtotal' => 0,
                'items_subtotal' => 0,
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'grand_total' => 5000,
            ],
        ];
    }

    /**
     * Dapatkan daftar alias, singkatan, dan frasa khas yang sering digunakan santri untuk sebuah produk
     */
    public function getProductAliases(string $productName): array
    {
        $nameLower = preg_replace('/\s+/', ' ', strtolower(trim($productName)));
        $aliases = [$nameLower];

        // 1. Bersihkan kata imbuhan umum spesifikasi (sapi, ai)
        $clean = preg_replace('/baksosapi/i', 'bakso sapi', $nameLower);
        $clean = trim(preg_replace('/\b(?:sapi|ai)\b/i', ' ', $clean));
        $clean = preg_replace('/\s+/', ' ', $clean);
        if ($clean !== $nameLower && strlen($clean) >= 4) {
            $aliases[] = $clean;
        }

        // 2. Hilangkan kata pengubah sekunder (manis, krispi, crispy, gula aren, dsb)
        $modifiers = [
            'manis', 'krispi', 'crispy', 'gula aren', 'aren', 'keju', 
            'udang keju', 'spesial', 'special', 'jumbo', 'biasa', 
            'original', 'ori', 'aneka rasa'
        ];
        foreach ($modifiers as $mod) {
            $stripped = trim(preg_replace('/\b' . preg_quote($mod, '/') . '\b/i', '', $clean));
            $stripped = preg_replace('/\s+/', ' ', $stripped);
            if (strlen($stripped) >= 4 && $stripped !== $clean && !in_array($stripped, ['es', 'mie', 'nasi', 'ayam', 'bakso'])) {
                $aliases[] = $stripped;
            }
        }

        // 3. Jika berawalan "nasi " (contoh: "nasi ayam geprek" -> "ayam geprek")
        if (str_starts_with($nameLower, 'nasi ') && strlen($nameLower) > 5) {
            $withoutNasi = trim(substr($nameLower, 5));
            if (strlen($withoutNasi) >= 4 && !in_array($withoutNasi, ['goreng', 'putih', 'uduk', 'kuning'])) {
                $aliases[] = $withoutNasi;
            }
        }

        // 4. Deteksi kata kunci khas unik/spesifik makanan
        $distinctiveWords = ['gacoan', 'hompimpa', 'cireng', 'batagor', 'pempek'];
        foreach ($distinctiveWords as $dw) {
            if (str_contains($nameLower, $dw)) {
                $aliases[] = $dw;
            }
        }
        // Menu kategori dasar (dimsum, seblak, geprek, mercon) hanya jadi alias jika murni produk dasar (bukan varian khusus)
        $baseWords = ['dimsum', 'geprek', 'mercon', 'seblak'];
        foreach ($baseWords as $bw) {
            if (str_contains($nameLower, $bw)) {
                $cleanWithoutOri = trim(preg_replace('/\b(?:original|ori|biasa|standar)\b/i', '', $clean));
                $cleanWithoutOri = preg_replace('/\s+/', ' ', $cleanWithoutOri);
                if ($cleanWithoutOri === $bw) {
                    $aliases[] = $bw;
                }
            }
        }

        // 5. Variasi susunan 2 kata (contoh: "ayam kulit" -> "kulit ayam")
        $words = explode(' ', $clean);
        if (count($words) === 2 && strlen($words[0]) >= 3 && strlen($words[1]) >= 3) {
            $aliases[] = $words[1] . ' ' . $words[0];
        }

        // 6. Variasi tanpa spasi populer
        if (str_contains($clean, 'es teh')) {
            $aliases[] = 'esteh';
        }

        $aliases = array_values(array_unique(array_filter($aliases, fn($a) => strlen(trim($a)) >= 3)));
        usort($aliases, fn($a, $b) => strlen($b) <=> strlen($a));

        return $aliases;
    }

    /**
     * Pencocokan cerdas teks santri dengan nama produk katalog (Toleran Typo, Voice Slips, Alias & Spasi)
     */
    protected function isProductMatch(string $userText, string $productName, ?string &$matchedPhrase = null, bool $allowSingleWordAlias = true): bool
    {
        $userText = preg_replace('/\s+/', ' ', strtolower(trim($userText)));
        $pLower = preg_replace('/\s+/', ' ', strtolower(trim($productName)));
        $matchedPhrase = null;

        // 1. Cek semua alias / subfrasa khas resmi produk (prioritas nama/alias terpanjang)
        $aliases = $this->getProductAliases($productName);
        foreach ($aliases as $alias) {
            $aliasLower = strtolower(trim($alias));
            $isSingleWord = !str_contains($aliasLower, ' ') && $aliasLower !== 'esteh';

            if (!$allowSingleWordAlias && $isSingleWord) {
                continue;
            }

            if (strlen($aliasLower) >= 4) {
                if (preg_match('/\b' . preg_quote($aliasLower, '/') . '\b/i', $userText, $m)) {
                    $matchedPhrase = $m[0];
                    return true;
                }
            } elseif ($aliasLower === 'esteh' && preg_match('/\besteh\b/i', $userText, $m)) {
                $matchedPhrase = $m[0];
                return true;
            }
        }

        // 2. Normalisasi kata imbuhan / pelengkap ("sapi", "ai", spasi ganda)
        $normalizedP = preg_replace('/baksosapi/i', 'bakso sapi', $pLower);
        $cleanP = trim(preg_replace('/\b(?:sapi|ai)\b/i', ' ', $normalizedP));
        $cleanP = preg_replace('/\s+/', ' ', $cleanP);

        if (strlen($cleanP) >= 4 && preg_match('/\b' . preg_quote($cleanP, '/') . '\b/i', $userText, $m)) {
            $matchedPhrase = $m[0];
            return true;
        }

        // 3. Kecocokan Token Kunci yang ketat (Bebas Stopword & Typo Terkendali)
        $tokens = array_values(array_filter(explode(' ', $cleanP), fn($t) => strlen($t) >= 3 && !in_array($t, $this->chatStopwords)));
        $rawUserWords = array_values(array_filter(explode(' ', $userText), fn($w) => strlen($w) >= 2));
        $userWords = array_values(array_filter($rawUserWords, fn($w) => !in_array($w, $this->chatStopwords)));

        if (count($tokens) >= 2 && count($userWords) >= 2) {
            $allMatched = true;
            $matchedWordsInText = [];
            foreach ($tokens as $token) {
                $tokenFound = false;
                foreach ($userWords as $uWord) {
                    if ($uWord === $token) {
                        $tokenFound = true;
                        $matchedWordsInText[] = $uWord;
                        break;
                    }
                    if (strlen($token) >= 5 && strlen($uWord) >= 5 && levenshtein($uWord, $token) <= 1) {
                        $tokenFound = true;
                        $matchedWordsInText[] = $uWord;
                        break;
                    }
                    if (strlen($token) === 4 && strlen($uWord) === 4 && $token[0] === $uWord[0] && levenshtein($uWord, $token) <= 1) {
                        $tokenFound = true;
                        $matchedWordsInText[] = $uWord;
                        break;
                    }
                }
                if (!$tokenFound) {
                    $allMatched = false;
                    break;
                }
            }

            if ($allMatched) {
                $matchedPhrase = implode(' ', $tokens);
                return true;
            }
        }

        // 4. Full phrase fuzzy similarity (jika kemiripan teks di atas 88% untuk nama panjang)
        if (strlen($cleanP) >= 10 && strlen($userText) >= 10) {
            similar_text($userText, $cleanP, $simPct);
            if ($simPct >= 88) {
                $matchedPhrase = $cleanP;
                return true;
            }
        }

        return false;
    }

    protected function formatResult(array $aiData, string $defaultLoc): array
    {
        $isReady = !empty($aiData['is_order_ready']);
        $rawSummary = $aiData['summary'] ?? [];
        $subtotal = $rawSummary['subtotal'] ?? $rawSummary['items_subtotal'] ?? 0;
        $deliveryFee = $rawSummary['delivery_fee'] ?? (!empty($aiData['is_custom']) ? 3500 : 3000);
        $adminFee = $rawSummary['admin_fee'] ?? (!empty($aiData['is_custom']) ? 2500 : 2000);
        $grandTotal = $rawSummary['grand_total'] ?? ($subtotal + $deliveryFee + $adminFee);

        $recipientName = $aiData['recipient_name'] ?? null;
        $deliveryLocation = $aiData['delivery_location'] ?? $defaultLoc;
        $recipientRoom = $aiData['recipient_room'] ?? $deliveryLocation;

        if ($recipientName) {
            try {
                $dbSantri = User::where(function ($q) use ($recipientName) {
                        $q->where('santri_name', $recipientName)
                          ->orWhere('name', $recipientName);
                    })
                    ->where(function ($q) {
                        $q->whereNotNull('santri_name')
                          ->orWhereHas('roles', fn($rq) => $rq->where('name', 'user'));
                    })
                    ->first();

                if (!$dbSantri) {
                    $dbSantri = User::where(function ($q) use ($recipientName) {
                            $q->where('santri_name', 'LIKE', "%{$recipientName}%")
                              ->orWhere('name', 'LIKE', "%{$recipientName}%");
                        })
                        ->where(function ($q) {
                            $q->whereNotNull('santri_name')
                              ->orWhereHas('roles', fn($rq) => $rq->where('name', 'user'));
                        })
                        ->first();
                }

                if ($dbSantri) {
                    $recipientName = $dbSantri->santri_name ?: $dbSantri->name;
                    if ($dbSantri->santri_room) {
                        $deliveryLocation = $dbSantri->santri_room;
                        $recipientRoom = $dbSantri->santri_room;
                    }
                }
            } catch (\Throwable $e) {
                Log::warning("AiSmartOrderingService formatResult user lookup skipped: " . $e->getMessage());
            }
        }

        $canteens = $aiData['canteens'] ?? [];
        if (!empty($canteens) && is_array($canteens)) {
            foreach ($canteens as &$canteen) {
                if (!empty($canteen['items']) && is_array($canteen['items'])) {
                    foreach ($canteen['items'] as &$item) {
                        $p = null;
                        try {
                            if (!empty($item['product_id'])) {
                                $p = Product::find($item['product_id']);
                            }
                            if (!empty($item['name'])) {
                                $item['name'] = trim(preg_replace('/\s+/', ' ', $item['name']));
                            }
                            if (!$p && !empty($item['name'])) {
                                $p = Product::where('name', $item['name'])
                                    ->orWhere('name', 'LIKE', "%{$item['name']}%")
                                    ->first();
                            }
                        } catch (\Throwable $e) {
                            // Offline fallback
                        }
                        if ($p) {
                            $item['product_id'] = $p->id;
                            $item['name'] = $p->name;
                            if (empty($item['variant_config'])) {
                                $item['variant_config'] = $p->variant_config;
                            }
                        }
                    }
                }
            }
        }

        return [
            'reply_text' => $aiData['reply_text'] ?? 'Pesanan berhasil disiapkan!',
            'is_order_ready' => $isReady,
            'is_unknown_query' => !empty($aiData['is_unknown_query']) || !empty($aiData['need_admin_support']),
            'is_custom' => !empty($aiData['is_custom']),
            'delivery_location' => $deliveryLocation,
            'recipient_name' => $recipientName,
            'recipient_room' => $recipientRoom,
            'quick_replies' => $aiData['quick_replies'] ?? [],
            'custom_notes' => $aiData['custom_notes'] ?? null,
            'canteens' => $canteens,
            'summary' => [
                'subtotal' => $subtotal,
                'items_subtotal' => $subtotal,
                'delivery_fee' => $deliveryFee,
                'admin_fee' => $adminFee,
                'grand_total' => $grandTotal,
            ],
        ];
    }
}
