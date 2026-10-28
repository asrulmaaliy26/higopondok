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
     * Ambil entitas Kantin Barokah Pusat (Tujuan utama Pesanan Khusus & Menu di Luar Katalog)
     */
    public function getBarokahCanteen(): ?Canteen
    {
        try {
            return Canteen::where('id', 173)
                ->orWhere('name', 'LIKE', '%Barokah%')
                ->orWhere('name', 'LIKE', '%Barikah%')
                ->orWhere('name', 'LIKE', '%Pusat%')
                ->orderByRaw("CASE WHEN id = 173 THEN 0 WHEN name LIKE '%Barokah%' THEN 1 WHEN name LIKE '%Barikah%' THEN 2 ELSE 3 END")
                ->first() ?: Canteen::first();
        } catch (\Throwable $e) {
            Log::warning("AiSmartOrderingService getBarokahCanteen skipped: " . $e->getMessage());
            return null;
        }
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

        // 0b. Deteksi apakah pengguna bertanya PANDUAN / TUTORIAL CARA MENGGUNAKAN APLIKASI
        // (cara pesan, mau beli gimana, cara pesan > 1 santri, multi-toko, pesanan khusus, profil, pembayaran, jadwal kurir, voucher)
        $guideResponse = $this->checkAppUsageGuide($message, $normalizedMessage, $user, $userLocation);
        if ($guideResponse !== null) {
            $guideResponse['engine_used'] = 'local_nlp_guide';
            $guideResponse['normalized_message'] = $normalizedMessage;
            return $guideResponse;
        }

        $apiKey = $this->getApiKey();
        $result = null;
        $engineUsed = 'local_nlp';
        if (!empty($apiKey) && !\Illuminate\Support\Facades\Cache::get('gemini_api_rate_limited')) {
            $aiResult = $this->callGemini($normalizedMessage, $products, $userLocation, $history);
            if (!empty($aiResult) && is_array($aiResult)) {
                $formattedAi = $this->formatResult($aiResult, $userLocation, $normalizedMessage);
                // Jika Gemini menolak karena menu tidak ada di katalog padahal user berniat memesan menu/barang spesifik,
                // biarkan ruleBasedMatcher mengalihkannya menjadi Pesanan Khusus ke Kantin Barokah Pusat
                if (empty($formattedAi['is_order_ready']) && !empty($formattedAi['is_unknown_query'])) {
                    $fallbackCandidate = $this->ruleBasedMatcher($normalizedMessage, $products, $userLocation, $history, $user);
                    if (!empty($fallbackCandidate['is_order_ready']) && !empty($fallbackCandidate['is_custom'])) {
                        $result = $fallbackCandidate;
                        $engineUsed = 'local_nlp_barokah_fallback';
                    } else {
                        $result = $formattedAi;
                        $engineUsed = 'gemini';
                    }
                } else {
                    $result = $formattedAi;
                    $engineUsed = 'gemini';
                }
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
     * Pusat Panduan & Tutorial Interaktif Penggunaan Aplikasi HiGO Pondok
     * Menjawab seluruh kemungkinan pertanyaan cara pakai aplikasi:
     * 1. Cara pesan > 1 santri (1 gedung pakai catatan vs beda gedung ganti nama santri di profil)
     * 2. Cara pesan > 1 toko sekaligus dalam 1 keranjang (multi-toko)
     * 3. Cara daftar akun baru, login Google & lengkapi Profil + Keluarga Santri
     * 4. Cara Pesanan Khusus / Titip Beli / jika menu tidak ada di katalog (masuk Kantin Barokah Pusat)
     * 5. Cara Pembayaran (QRIS / Rekening) & Upload / Ganti Bukti Transfer
     * 6. Jadwal Operasional Toko, Jam Pengantaran Kurir & Jam Pengambilan Santri
     * 7. Cara Klaim & Pakai Voucher Promo / Diskon
     * 8. Panduan Umum Cara Memesan / Cara Beli / Cara Menggunakan Aplikasi
     */
    public function checkAppUsageGuide(string $rawMessage, string $normalizedMessage, ?User $user, string $loc): ?array
    {
        $lower = strtolower(trim($rawMessage . ' ' . $normalizedMessage));

        // Jangan intersep jika pesan sebenarnya adalah perintah memesan produk konkret dengan angka porsi + nama menu katalog/khusus
        // kecuali mengandung kata tanya cara/gimana/bagaimana/tutorial/panduan/aturan/jadwal/jam berapa
        $hasHowToWord = preg_match('/\b(?:cara|caranya|gimana|bagaimana|gmn|bgmn|panduan|tutorial|petunjuk|langkah|aturan|sistem|jadwal|jam\s*berapa|kapan\s*(?:diantar|sampai|ambil|diambil|buka)|bisa\s*(?:gak|tidak|nggak)|kalau\s*mau|kalo\s*mau|bingung|belum\s*paham|gak\s*paham|tidak\s*paham|belum\s*ngerti|gak\s*ngerti|ajarin|jelaskan|info\s*cara)\b/i', $lower)
            || preg_match('/(?:📖|👥|🏪|👤|💳|🕒|🎟️)/u', $rawMessage);

        // Deteksi khusus kalimat pendek seperti "mau pesen gimana", "mau beli gimana", "pesennya gimana", "cara pesan"
        $isDirectHowToOrder = preg_match('/(?:mau|ingin|pengen)?\s*(?:pesan|pesen|beli|order|belanja|pakai|menggunakan)(?:nya)?\s*(?:gimana|bagaimana|gmn|bgmn|lewat\s*mana|di\s*mana)/i', $lower);

        if (!$hasHowToWord && !$isDirectHowToOrder) {
            return null;
        }

        $baseResponse = [
            'is_order_ready' => false,
            'is_app_guide' => true,
            'recipient_name' => null,
            'recipient_room' => $loc,
            'canteens' => [],
            'summary' => [
                'subtotal' => 0,
                'items_subtotal' => 0,
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'grand_total' => 5000,
            ],
        ];

        // =========================================================================
        // KATEGORI 1: CARA PESAN UNTUK LEBIH DARI 1 SANTRI (1 GEDUNG VS BEDA GEDUNG)
        // =========================================================================
        if (preg_match('/(?:lebih\s*dari\s*(?:1|satu)\s*(?:santri|anak|orang)|(?:2|dua|3|tiga|banyak|beberapa)\s*(?:santri|anak)|kakak\s*adik|adik\s*kakak|beda\s*(?:gedung|asrama)|(?:1|satu|sama)\s*(?:gedung|asrama)|ganti\s*(?:nama\s*)?santri|pesan\s*(?:buat|untuk)\s*(?:2|dua|banyak)\s*(?:santri|anak))/i', $lower)) {
            $reply = "👥 **Panduan Cara Memesan untuk Lebih dari 1 Santri (2 Anak / Kakak-Adik / Teman)**:\n\n"
                . "Di sistem HiGO Pondok terdapat **2 cara** sesuai lokasi gedung asrama santri:\n\n"
                . "🏢 **1. Jika Masih dalam 1 Gedung / 1 Asrama yang Sama** *(Hemat 1x Ongkir)*:\n"
                . "• Cukup buat **1 pesanan saja** seperti biasa.\n"
                . "• Di halaman **Keranjang**, isi kolom **Catatan Item** pada menu yang dipesan dengan rincian pembagiannya *(Contoh: \"1 porsi untuk Fauzan Kamar 02, 1 porsi untuk Zaki\")*.\n"
                . "• Saat pesanan tiba di asrama, **nama santri utama pada akun tetap yang dipanggil oleh kurir**, lalu kurir akan **memberitahukan catatannya agar dibagikan kepada santri yang tercatat**.\n\n"
                . "🏛️ **2. Jika Beda Gedung / Beda Asrama** *(Misal: 1 di Gedung Putra & 1 di Gedung Putri)*:\n"
                . "• Wajib membuat **2 pesanan terpisah** dengan mengganti nama santri:\n"
                . "  1️⃣ Selesaikan pesanan & *checkout* untuk **Santri Pertama**.\n"
                . "  2️⃣ Buka menu **Profil** (pojok kanan atas) → klik **Kamar & Keluarga Santri**.\n"
                . "  3️⃣ Cari & pilih **Nama Santri Kedua** (kamar & gedung otomatis berubah) → klik **Simpan**.\n"
                . "  4️⃣ Kembali ke **Kantin** lalu buat pesanan untuk **Santri Kedua**.\n\n"
                . "💡 **Tips Cepat via Chat AI**: Di Chat AI ini, Kakak juga bisa langsung mengetik nama santri tujuan, contoh:\n"
                . "*\"Pesan 1 Mie Gacoan Lv 1 buat santri Siti Aisyah kamar Khadijah 02\"* 😊";

            return array_merge($baseResponse, [
                'reply_text' => $reply,
                'quick_replies' => [
                    "📖 Cara pesan makanan (Pemula)",
                    "🏪 Cara pesan lebih dari 1 toko",
                    "👤 Cara ganti / lengkapi profil santri",
                    "✨ Cara pesanan khusus (Kantin Barokah)",
                    "💳 Cara bayar & upload bukti transfer"
                ],
            ]);
        }

        // =========================================================================
        // KATEGORI 2: CARA PESAN LEBIH DARI 1 TOKO SEKALIGUS (MULTI-TOKO 1 KERANJANG)
        // =========================================================================
        if (preg_match('/(?:lebih\s*dari\s*(?:1|satu)\s*(?:toko|warung|kantin|resto)|(?:2|dua|3|tiga|banyak|beberapa|beda|lain)\s*(?:toko|warung|kantin|resto)|multi\s*(?:toko|warung|kantin)|gabung\s*(?:pesanan|toko|keranjang)|keranjang\s*dulu)/i', $lower)) {
            $reply = "🏪 **Panduan Cara Memesan Lebih dari 1 Toko Sekaligus (Multi-Toko)**:\n\n"
                . "Kakak bisa membeli makanan & minuman dari beberapa toko berbeda dalam **1 kali proses Checkout & 1 kali Pembayaran**:\n\n"
                . "🛒 **Cara 1: Lewat Katalog Kantin (Pilih Menu Dulu di Keranjang)**\n"
                . "1️⃣ Buka menu **Kantin**, klik **Toko Pertama** *(misal: Mie Gacoan)*, lalu klik tombol **+ Tambah** pada menu yang diinginkan.\n"
                . "2️⃣ Jangan checkout dulu — klik tombol **Kembali (`←`)** di kiri atas, lalu buka **Toko Kedua** *(misal: Bakso Kuy atau Momoyo)* dan klik **+ Tambah** pada menu berikutnya.\n"
                . "3️⃣ Semua menu dari berbagai toko otomatis terkumpul di dalam **1 Keranjang**.\n"
                . "4️⃣ Klik bilah hijau **Keranjang** di bawah → cek rincian tiap toko → klik **Lanjut ke Pembayaran**.\n"
                . "5️⃣ Cukup lakukan **1x Transfer / Scan QRIS Gabungan** untuk seluruh toko sekaligus!\n\n"
                . "🤖 **Cara 2: Langsung Ketik Sekaligus di Chat AI Ini**\n"
                . "• Ketik saja menu dari beberapa toko dalam 1 pesan, contoh:\n"
                . "  *\"Pesan 2 Mie Gacoan Lv 1 sama 1 Bakso Mercon dan 2 Es Teh antar ke kamar\"*\n"
                . "• AI akan otomatis mengelompokkan tokonya dan menyiapkan 1 tombol **Konfirmasi Pesanan**!";

            return array_merge($baseResponse, [
                'reply_text' => $reply,
                'quick_replies' => [
                    "👥 Cara pesan lebih dari 1 santri",
                    "📖 Cara pesan makanan (Pemula)",
                    "✨ Cara pesanan khusus (Kantin Barokah)",
                    "💳 Cara bayar & upload bukti transfer"
                ],
            ]);
        }

        // =========================================================================
        // KATEGORI 3: CARA DAFTAR AKUN BARU & LENGKAPI PROFIL / KELUARGA SANTRI
        // =========================================================================
        if (preg_match('/(?:cara\s*(?:daftar|register|buat\s*akun|login|masuk)|pengguna\s*baru|lengkapi\s*profil|isi\s*profil|edit\s*profil|keluarga\s*santri|data\s*santri|isi\s*kamar|profil\s*belum\s*lengkap|tidak\s*bisa\s*pesan.*profil)/i', $lower)) {
            $reply = "👤 **Panduan Pengguna Baru: Login, Daftar Akun & Lengkapi Profil Santri**:\n\n"
                . "Agar pesanan bisa diantar tepat ke kamar santri, pengguna baru wajib melengkapi profil sekali saja di awal:\n\n"
                . "1️⃣ **Masuk / Daftar Akun**:\n"
                . "• **Paling Mudah**: Klik tombol **Masuk dengan Google** (otomatis terdaftar & langsung masuk).\n"
                . "• **Manual**: Jika tanpa Google, klik **Daftar Sekarang** lalu buat Username & Password.\n\n"
                . "2️⃣ **Isi Nomor WhatsApp Aktif**:\n"
                . "• Klik menu **Profil** (ikon orang di pojok kanan atas).\n"
                . "• Klik **Edit Profil & Akun** → isi **Nomor WhatsApp** aktif → klik **Simpan**.\n\n"
                . "3️⃣ **Hubungkan Kamar & Keluarga Santri (Wajib)**:\n"
                . "• Masih di halaman **Profil**, klik kartu **Kamar & Keluarga Santri**.\n"
                . "• Ketik & pilih **Nama Santri** dari daftar database pondok *(Asrama/Kamar, Kelas, dan Jenjang akan terisi otomatis)*.\n"
                . "• Klik **Simpan Data Keluarga**.\n\n"
                . "✅ Setelah status profil berwarna **Hijau (Lengkap)**, Kakak langsung bisa memesan di **Kantin** maupun **Chat AI**!";

            return array_merge($baseResponse, [
                'reply_text' => $reply,
                'quick_replies' => [
                    "📖 Cara pesan makanan (Pemula)",
                    "👥 Cara pesan lebih dari 1 santri",
                    "🏪 Cara pesan lebih dari 1 toko",
                    "💳 Cara bayar & upload bukti transfer"
                ],
            ]);
        }

        // =========================================================================
        // KATEGORI 4: CARA PESANAN KHUSUS / TITIP BELI / MENU TIDAK ADA DI KATALOG
        // =========================================================================
        if (preg_match('/(?:pesanan\s*khusus|pesan\s*khusus|titip\s*beli|nitip\s*beli|menu\s*(?:tidak\s*ada|gak\s*ada|belum\s*ada|kosong)|di\s*luar\s*(?:menu|katalog)|kantin\s*barokah|kantin\s*barikah)/i', $lower)) {
            $reply = "✨ **Panduan Pesanan Khusus (Titip Beli) & Menu di Luar Katalog (Kantin Barokah Pusat)**:\n\n"
                . "Jika makanan/minuman yang diinginkan **tidak ada di katalog toko reguler**, atau ingin **titip beli barang kebutuhan santri** (obat apotek, sabun, alat tulis, roti, buah, dll.), pesanan otomatis masuk ke **Kantin Barokah Pusat**:\n\n"
                . "🤖 **Cara 1: Langsung Ketik di Chat AI Ini (Otomatis)**\n"
                . "• Ketik saja nama makanan atau barang beserta jumlahnya di chat ini, contoh:\n"
                . "  • *\"Pesan 2 porsi Nasi Rawon dan 1 Soto Lamongan\"*\n"
                . "  • *\"Tolong titip belikan Paracetamol 1 strip dan Sabun Lifebuoy 2 pcs\"*\n"
                . "• Jika menu tidak ada di katalog reguler, AI **otomatis membuatkan draf Pesanan Khusus ke Kantin Barokah Pusat**!\n"
                . "• Klik tombol **Konfirmasi Pesanan** pada kartu draf yang muncul.\n\n"
                . "🏪 **Cara 2: Lewat Tombol di Halaman Kantin**\n"
                . "• Buka menu **Kantin** → klik tombol ungu **✨ PESANAN KHUSUS** di bagian atas → tulis rincian barang & perkiraan budget → klik **Kirim Pesanan Khusus**.\n\n"
                . "💡 **Ketentuan Tarif**: Ongkir Kurir **Rp 3.500** & Admin **Rp 2.500**. Harga barang/menu akan diinput oleh **Kantin Barokah Pusat** setelah dibelanjakan, lalu Kakak tinggal melakukan pembayaran.";

            return array_merge($baseResponse, [
                'reply_text' => $reply,
                'quick_replies' => [
                    "Pesan 2 porsi Nasi Rawon dan 1 Roti Tawar",
                    "Tolong titip belikan Paracetamol 1 strip dan Tolak Angin 2 sachet",
                    "📖 Cara pesan makanan (Pemula)",
                    "💳 Cara bayar & upload bukti transfer"
                ],
            ]);
        }

        // =========================================================================
        // KATEGORI 5: CARA PEMBAYARAN, QRIS, REKENING & UPLOAD BUKTI TRANSFER
        // =========================================================================
        if (preg_match('/(?:cara\s*bayar|pembayaran|transfer\s*kemana|bayar\s*pakai\s*apa|qris|rekening|upload\s*bukti|unggah\s*bukti|bukti\s*bayar|bukti\s*transfer|konfirmasi\s*pembayaran)/i', $lower)) {
            $reply = "💳 **Panduan Cara Pembayaran & Upload Bukti Transfer**:\n\n"
                . "1️⃣ **Buka Halaman Pembayaran / Riwayat**:\n"
                . "• Setelah klik *Checkout* (dari Keranjang) atau *Konfirmasi Pesanan* (dari Chat AI), Kakak otomatis diarahkan ke halaman **Riwayat / Pembayaran**.\n\n"
                . "2️⃣ **Pilih Metode Bayar (QRIS / Transfer Rekening)**:\n"
                . "• **QRIS Resmi Pondok**: Scan barcode QRIS menggunakan aplikasi m-Banking (BCA, BRI, Mandiri, BSI) atau e-Wallet (Dana, GoPay, OVO, ShopeePay).\n"
                . "• **Transfer Bank**: Transfer sesuai **Total Tagihan** ke nomor rekening resmi yang tampil di layar.\n\n"
                . "3️⃣ **Unggah Foto Bukti Pembayaran (Wajib)**:\n"
                . "• Klik tombol **Unggah Bukti Pembayaran** pada kartu pesanan.\n"
                . "• Pilih foto / *screenshot* bukti transfer dari HP Kakak lalu simpan.\n"
                . "• Status otomatis berubah dan pesanan segera disiapkan oleh toko!\n\n"
                . "⚠️ **Salah Upload Bukti Bayar?** Kakak bisa unggah ulang di halaman **Riwayat** atau klik tombol **Chat WhatsApp Admin** agar segera dibantu.";

            return array_merge($baseResponse, [
                'reply_text' => $reply,
                'quick_replies' => [
                    "📦 Cek status pesanan saya",
                    "🕒 Jadwal pengantaran kurir & ambil pesanan",
                    "📖 Cara pesan makanan (Pemula)",
                    "Chat WhatsApp Admin"
                ],
            ]);
        }

        // =========================================================================
        // KATEGORI 6: JADWAL OPERASIONAL, JAM ANTAR KURIR & PENGAMBILAN SANTRI
        // =========================================================================
        if (preg_match('/(?:jadwal\s*(?:antar|kurir|pengantaran|buka|kantin)|jam\s*berapa.*?(?:antar|mengantar|diantar|kurir|sampai|ambil|diambil|buka|tutup)|kapan.*?(?:diantar|mengantar|sampai|ambil|diambil)|waktu\s*(?:antar|pengantaran|pengambilan))/i', $lower)) {
            $reply = "🕒 **Jadwal Operasional Kantin, Pengantaran Kurir & Pengambilan Santri**:\n\n"
                . "• 🏪 **Jam Buka Toko Reguler**: Pukul **07:00 – 17:00 WIB** *(Khusus fitur **Pesanan Khusus / Titip Beli** dapat diajukan 24 jam)*.\n"
                . "• 🛵 **Jadwal Pengantaran Kurir**: Kurir mengantarkan pesanan ke gedung asrama mulai pukul **17:00 s/d 21:00 WIB** (5 sore – 9 malam).\n"
                . "• 📦 **Waktu Pengambilan Santri**: Santri dapat mengambil pesanannya mulai **pukul 20:00 WIB (jam 8 malam)** di titik pengantaran gedung asrama.\n"
                . "• 📸 **Bukti Serah Terima & Email**: Begitu pesanan selesai diantar kurir, foto bukti pengantaran langsung tampil di menu **Riwayat** dan terkirim otomatis ke **Email** akun Kakak.";

            return array_merge($baseResponse, [
                'reply_text' => $reply,
                'quick_replies' => [
                    "📦 Cek status pesanan saya",
                    "📖 Cara pesan makanan (Pemula)",
                    "👥 Cara pesan lebih dari 1 santri",
                    "🏪 Cara pesan lebih dari 1 toko"
                ],
            ]);
        }

        // =========================================================================
        // KATEGORI 7: CARA KLAIM & PAKAI VOUCHER DISKON / GRATIS ONGKIR
        // =========================================================================
        if (preg_match('/(?:cara\s*(?:pakai|klaim|gunakan|dapat)\s*voucher|voucher\s*(?:diskon|gratis\s*ongkir|promo)|pakai\s*promo)/i', $lower)) {
            $reply = "🎟️ **Panduan Cara Klaim & Menggunakan Voucher Promo**:\n\n"
                . "1️⃣ Buka menu **Voucher** (ikon tiket di navigasi bawah).\n"
                . "2️⃣ Pilih voucher yang tersedia lalu klik tombol **Klaim**.\n"
                . "3️⃣ Saat memesan menu di **Keranjang**, pilih voucher yang sudah diklaim sebelum menekan *Checkout* agar potongan diskon/ongkir langsung memotong total tagihan.";

            return array_merge($baseResponse, [
                'reply_text' => $reply,
                'quick_replies' => [
                    "📖 Cara pesan makanan (Pemula)",
                    "🏪 Cara pesan lebih dari 1 toko",
                    "👥 Cara pesan lebih dari 1 santri"
                ],
            ]);
        }

        // =========================================================================
        // KATEGORI 8: PANDUAN LENGKAP UMUM ("MAU PESAN GIMANA / CARA PAKAI APLIKASI")
        // =========================================================================
        if ($isDirectHowToOrder || preg_match('/(?:cara\s*(?:pesan|pesen|beli|order|belanja|pakai|menggunakan|gunain)|panduan\s*(?:aplikasi|lengkap|pesan)|tutorial\s*(?:aplikasi|pesan)|langkah\s*pesan|bingung\s*(?:cara|mau)\s*(?:pesan|beli|pakai)|gimana\s*cara\s*(?:pesan|pesen|beli|order|pakai)|bagaimana\s*cara\s*(?:pesan|pesen|beli|order|pakai|menggunakan))/i', $lower)) {
            $reply = "📖 **Panduan Lengkap Cara Menggunakan & Memesan di HiGO Pondok**:\n\n"
                . "Berikut langkah mudah memesan makanan, minuman, dan kebutuhan santri:\n\n"
                . "1️⃣ **Pastikan Profil & Kamar Santri Lengkap** *(Khusus Pengguna Baru)*\n"
                . "• Buka menu **Profil** (pojok kanan atas) → isi **No. WhatsApp** di *Edit Profil* & pilih **Nama Santri** di *Kamar & Keluarga Santri*.\n\n"
                . "2️⃣ **Pilih Salah Satu dari 3 Cara Memesan**:\n"
                . "• 🤖 **Lewat Chat AI Ini (Paling Praktis)**: Cukup ketik menu & jumlahnya *(Contoh: \"Pesan 2 Mie Gacoan Lv 1 sama 1 Es Teh\")*, lalu klik tombol hijau **Konfirmasi Pesanan**.\n"
                . "• 🛒 **Lewat Katalog Kantin (Bisa Multi-Toko)**: Buka menu **Kantin** → pilih menu dari 1 atau beberapa toko (**+ Tambah**) → buka **Keranjang** → klik **Lanjut ke Pembayaran**.\n"
                . "• ✨ **Pesanan Khusus / Menu Tidak Ada di Katalog**: Ketik saja menunya di Chat AI ini atau klik tombol ungu **PESANAN KHUSUS** di menu Kantin — otomatis masuk ke **Kantin Barokah Pusat**.\n\n"
                . "3️⃣ **Ingin Memesan untuk Lebih dari 1 Santri?**\n"
                . "• **Satu Gedung Asrama**: Cukup 1 pesanan, tulis pembagian nama santri di **Catatan Item** keranjang *(nama santri utama dipanggil kurir & diberitahu catatannya untuk dibagikan)*.\n"
                . "• **Beda Gedung (Putra & Putri)**: Buat 2 pesanan terpisah dengan mengganti nama santri di **Profil → Kamar & Keluarga Santri**.\n\n"
                . "4️⃣ **Pembayaran & Pengantaran Kurir**:\n"
                . "• Scan **QRIS / Transfer Rekening** lalu **Unggah Bukti Pembayaran** di menu **Riwayat**.\n"
                . "• Kurir mengantar pukul **17:00 – 21:00 WIB** *(santri mengambil mulai pukul **20:00 WIB**)*.\n\n"
                . "👇 **Pilih topik panduan di bawah jika ingin penjelasan lebih detail:**";

            return array_merge($baseResponse, [
                'reply_text' => $reply,
                'quick_replies' => [
                    "👥 Cara pesan lebih dari 1 santri",
                    "🏪 Cara pesan lebih dari 1 toko",
                    "✨ Cara pesanan khusus (Kantin Barokah)",
                    "👤 Cara lengkapi profil & kamar santri",
                    "💳 Cara bayar & upload bukti transfer",
                    "🕒 Jadwal pengantaran kurir & ambil pesanan"
                ],
            ]);
        }

        return null;
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
            . "   - Hitung ongkir standar katalog: Rp 3.000, Admin: Rp 2.000 (atau Ongkir Rp 3.500 & Admin Rp 2.500 jika pesanan khusus / titip beli).\n"
            . "   - Buatkan draf ringkasan pesanan di canteens, summary, dan reply_text.\n"
            . "   - Berikan teks penutup: 'Silakan klik tombol [ ✅ Konfirmasi Pesanan ] di bawah untuk langsung memproses pesananmu!'.\n\n"
            . "6A. PESANAN KHUSUS (TITIP BELI) & MENU YANG TIDAK ADA DI KATALOG (OTOMATIS MASUK KANTIN BAROKAH PUSAT):\n"
            . "   - Jika santri/wali ingin memesan Pesanan Khusus / Titip Beli (misal: obat di apotek, sabun, shampo, alat tulis, roti tawar, buah, barang luar) ATAU memesan makanan/minuman spesifik yang TIDAK ADA di daftar katalog toko reguler (misal: 'pesan nasi rawon 2 porsi', 'pesan soto lamongan 1', 'beli pecel lele 2', 'pesan burger 1', dsb.):\n"
            . "   - JANGAN DITOLAK! Otomatis jadikan sebagai draf Pesanan Khusus yang masuk ke **Kantin Barokah Pusat** (canteen_id: 173, canteen_name: 'Kantin Barokah Pusat')!\n"
            . "   - Wajib set: \"is_order_ready\": true, \"is_custom\": true, \"is_unknown_query\": false.\n"
            . "   - Isi \"custom_notes\" dengan rincian barang/menu yang dipesan (contoh: \"2 porsi Nasi Rawon\").\n"
            . "   - Isi \"canteens\": [{\"canteen_id\": 173, \"canteen_name\": \"Kantin Barokah Pusat\", \"items\": []}].\n"
            . "   - Isi \"summary\": {\"subtotal\": 0, \"items_subtotal\": 0, \"delivery_fee\": 3500, \"admin_fee\": 2500, \"grand_total\": 6000}.\n"
            . "   - Pada \"reply_text\", jelaskan dengan ramah bahwa pesanan disiapkan sebagai **Pesanan Khusus melalui Kantin Barokah Pusat** (Ongkir Rp 3.500 & Admin Rp 2.500, harga barang/menu akan diinput oleh Kantin Barokah Pusat setelah dibelanjakan).\n\n"
            . "7. BANTUAN, CS & HUBUNGI PENGELOLA (ADMIN / TOKO):\n"
            . "   - Jika santri meminta bantuan, kendala, komplain, atau ingin chat/tanya admin atau toko langsung:\n"
            . "   - Berikan tanggapan ramah bahwa tim pengelola dan toko siap membantu via WhatsApp langsung.\n"
            . "   - Wajib set is_order_ready: false.\n"
            . "   - Sertakan quick_replies: ['Chat WhatsApp Admin', 'Chat WhatsApp Toko', 'Mau pesan makanan'].\n\n"
            . "8. JIKA PENGGUNA BERTANYA INFORMASI UMUM DI LUAR PEMESANAN MAKANAN/BARANG:\n"
            . "   - HANYA jika pengguna bertanya informasi umum yang bukan memesan makanan/minuman/barang (misal: jadwal ujian pondok, biaya SPP, dsb.):\n"
            . "   - Sampaikan dengan santun bahwa kamu adalah Asisten Belanja Kantin dan arahkan untuk menghubungi Chat WhatsApp Admin HiGO Pondok.\n"
            . "   - Wajib set is_order_ready: false dan is_unknown_query: true.\n\n"
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

        // Deteksi lokasi pengantaran di dalam kalimat (prioritaskan frasa antar ke / kamar / asrama / gedung)
        $loc = $userLocation;
        if (preg_match('/(?:antar(?:kan)?\s+ke|kirim(?:kan)?\s+ke|ke\s+kamar|ke\s+asrama|ke\s+gedung|kamar|asrama|gedung|kantor|ruang)\s+([A-Za-z0-9\s\-_]{2,30})/i', $message, $mLoc)) {
            $loc = trim($mLoc[0]);
            $loc = preg_replace('/^(?:antar(?:kan)?\s+ke|kirim(?:kan)?\s+ke|ke|di)\s+/i', '', $loc);
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

        // 2. Cek apakah ini instruksi Pesanan Khusus / Titip Beli (obat di apotek, sabun, pulpen, buku, kantin barokah, dll)
        $isTitipBeliIntent = preg_match('/(?:titip\s*beli|nitip\s*beli|titip|pesanan\s*khusus|pesan\s*khusus|request\s*khusus|kantin\s*barokah|kantin\s*barikah|barokah|barikah|apotek|swalayan|indomaret|alfamart|warung\s*madura|toko\s*kelontong|obat|paracetamol|panadol|tolak\s*angin|sabun|shampo|odol|pasta\s*gigi|sikat\s*gigi|deterjen|rinso|buku\s*sidu|pulpen|pensil|atk|fotocopy|print|roti\s*tawar|susu\s*kotak|buah)/i', $lower);

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

        // B0. DETEKSI PESANAN KHUSUS (TITIP BELI) ATAU PEMESANAN MENU SPESIFIK YANG TIDAK ADA DI KATALOG -> MASUK KANTIN BAROKAH PUSAT
        if (empty($matchedCanteens)) {
            $isQuestionOrExploreOnly = preg_match('/(?:apa\s*(?:ada|aja)|ada\s*apa|menu\s*apa|jual\s*apa|pilihan|list|daftar|rekomendasi|saran|bingung|berapa|harga|toko\s*apa|kantin\s*apa|buka\s*jam|\?)/i', $lower);
            $hasOrderTrigger = preg_match('/\b(?:pesan|pesen|pesankan|beli|belikan|beliin|order|mau|ingin|pengen|minta|tolong|titip|nitip|khusus)\b/i', $lower)
                || preg_match('/\b\d+\s*(?:porsi|bungkus|pcs|buah|cup|gelas|mangkok|mangkuk|botol|saset|sachet|strip|kotak|pack)\b/i', $lower);

            // Ekstrak inti nama barang/menu yang diminta setelah membuang kata perintah, lokasi, penerima, dan angka satuan
            $corePhrase = $lower;
            $corePhrase = preg_replace('/[,;\s]+(?:tolong\s+)?(?:di)?(?:antar(?:kan)?|kirim(?:kan)?)\s+(?:ke\s+)?.*$/i', '', $corePhrase);
            $corePhrase = preg_replace('/[,;\s]+(?:ke|di)\s+(?:kamar|asrama|gedung|ruang|kantin\s+barokah|kantin\s+barikah)\b.*$/i', '', $corePhrase);
            $corePhrase = preg_replace('/[,;\s]+(?:buat|untuk|atas\s+nama)\s+(?:santri|adik|anak)\b.*$/i', '', $corePhrase);
            $corePhrase = preg_replace('/\b(?:halo|hai|assalamualaikum|permisi|kak|mas|mbak|bang|pak|bu|saya|aku|kami|mau|ingin|pengen|tolong|mohon|minta|nitip|titip|pesanan|pesan|pesen|pesankan|khusus|request|beli|belikan|beliin|order|buatkan|dong|ya|yah|nih|sekarang|hari|ini|antar|kirim|di|ke|kantin|barokah|barikah|pusat)\b/i', ' ', $corePhrase);
            $corePhrase = preg_replace('/\b(?:\d+|satu|dua|tiga|empat|lima|porsi|bungkus|bks|pcs|buah|biji|cup|gelas|mangkok|mangkuk|botol|btl|saset|sachet|strip|kotak|pack|pak)\b/i', ' ', $corePhrase);
            $corePhrase = trim(preg_replace('/[^a-z0-9\s]/i', ' ', $corePhrase));
            $corePhrase = preg_replace('/\s+/', ' ', $corePhrase);

            $genericCatalogCategories = [
                'makanan', 'makan', 'minuman', 'minum', 'snack', 'camilan', 'cemilan',
                'jajan', 'jajanan', 'menu', 'bakso', 'mie', 'nasi', 'ayam', 'bebek',
                'sate', 'kopi', 'jus', 'es', 'dimsum', 'seblak', 'martabak',
                'terang bulan', 'gorengan', 'roti'
            ];

            $isUnmatchedMenuOrder = !$isQuestionOrExploreOnly
                && $hasOrderTrigger
                && strlen($corePhrase) >= 3
                && !in_array($corePhrase, $genericCatalogCategories, true);

            if ($isTitipBeliIntent || $isUnmatchedMenuOrder) {
                $barokahCanteen = $this->getBarokahCanteen();
                $cId = $barokahCanteen ? $barokahCanteen->id : 173;
                $cName = $barokahCanteen ? $barokahCanteen->name : 'Kantin Barokah Pusat';

                $parser = new CustomOrderParserService();
                $customItems = $parser->parseNotes($message);

                $cleanNoteLines = [];
                foreach ($customItems as $ci) {
                    $noteSuffix = !empty($ci['notes']) ? " ({$ci['notes']})" : "";
                    $cleanNoteLines[] = "{$ci['quantity']} {$ci['unit']} {$ci['item']}{$noteSuffix}";
                }
                $cleanNotesStr = !empty($cleanNoteLines) ? implode(', ', $cleanNoteLines) : $message;

                if ($isTitipBeliIntent) {
                    $replyLines = ["Siap kak! Berikut draf **Pesanan Khusus (Titip Beli)** yang otomatis dimasukkan ke **{$cName}**:"];
                } else {
                    $replyLines = ["Menu yang Kakak pesan belum terdaftar di katalog toko reguler, sehingga otomatis saya siapkan sebagai **Pesanan Khusus** melalui **{$cName}**:"];
                }

                foreach ($customItems as $ci) {
                    $noteSuffix = !empty($ci['notes']) ? " *({$ci['notes']})*" : "";
                    $replyLines[] = "• **{$ci['quantity']} {$ci['unit']} {$ci['item']}**{$noteSuffix}";
                }
                $replyLines[] = "• **Toko Tujuan**: {$cName}";
                if ($recipientName) {
                    $replyLines[] = "• **Penerima**: {$recipientName}";
                }
                $replyLines[] = "• **Tujuan Antar**: {$loc}";
                $replyLines[] = "• **Tarif Pesanan Khusus**: Ongkir Rp 3.500 | Admin Rp 2.500";
                $replyLines[] = "• *(Harga menu/barang akan diinput oleh {$cName} setelah dibelanjakan)*";
                $replyLines[] = "\nSilakan klik tombol **Konfirmasi Pesanan** di bawah untuk langsung memproses pesanan khususmu!";

                return [
                    'reply_text' => implode("\n", $replyLines),
                    'is_order_ready' => true,
                    'is_custom' => true,
                    'canteen_id' => $cId,
                    'delivery_location' => $loc,
                    'recipient_name' => $recipientName,
                    'recipient_room' => $loc,
                    'quick_replies' => [],
                    'custom_notes' => $cleanNotesStr,
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
     * Cek apakah kata tunggal di dalam teks pengguna sebenarnya bagian dari nama menu majemuk lain
     * (Contoh: kata "nasi" di dalam "nasi rawon", atau "lele" di dalam "pecel lele")
     */
    protected function isSingleWordPartOfUnmatchedCompound(string $userText, string $singleWord): bool
    {
        $nonModifierAfter = [
            'putih', 'biasa', 'standar', 'original', 'ori', 'hangat', 'panas', 'dingin', 'es',
            'pedas', 'sedang', 'manis', 'level', 'lv', 'lvl', 'porsi', 'bungkus', 'bks', 'pcs',
            'buah', 'biji', 'cup', 'gelas', 'mangkok', 'mangkuk', 'botol', 'saset', 'sachet',
            'strip', 'kotak', 'pack', 'pak', 'sama', 'dan', 'atau', 'serta', 'lalu', 'tambah',
            'antar', 'antarkan', 'kirim', 'ke', 'di', 'kamar', 'asrama', 'gedung', 'ruang',
            'buat', 'untuk', 'atas', 'aja', 'saja', 'cuma', 'dong', 'ya', 'kak', 'mas', 'mbak',
            'satu', 'dua', 'tiga', 'empat', 'lima', '___consumed___'
        ];
        $nonModifierBefore = [
            'pesan', 'pesen', 'pesankan', 'beli', 'belikan', 'beliin', 'order', 'mau', 'ingin',
            'pengen', 'minta', 'tolong', 'tambah', 'sama', 'dan', 'atau', 'serta', 'lalu',
            'porsi', 'bungkus', 'bks', 'pcs', 'buah', 'biji', 'cup', 'gelas', 'mangkok',
            'mangkuk', 'satu', 'dua', 'tiga', 'empat', 'lima', '___consumed___'
        ];

        $q = preg_quote($singleWord, '/');

        // Cek kata tepat setelah $singleWord
        if (preg_match('/\b' . $q . '\s+([a-z0-9_]{3,})\b/i', $userText, $mAfter)) {
            $nextWord = strtolower($mAfter[1]);
            if (!is_numeric($nextWord) && !in_array($nextWord, $nonModifierAfter, true) && !in_array($nextWord, $this->chatStopwords, true)) {
                return true;
            }
        }

        // Cek kata tepat sebelum $singleWord (khusus kata generik seperti "lele" pada "pecel lele", "kacang" pada "bubur kacang")
        if (in_array($singleWord, ['nasi', 'lele', 'jeruk', 'teh', 'kacang'], true)) {
            if (preg_match('/\b([a-z0-9_]{3,})\s+' . $q . '\b/i', $userText, $mBefore)) {
                $prevWord = strtolower($mBefore[1]);
                if (!is_numeric($prevWord) && !in_array($prevWord, $nonModifierBefore, true) && !in_array($prevWord, $this->chatStopwords, true)) {
                    return true;
                }
            }
        }

        return false;
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
                    if ($isSingleWord && $this->isSingleWordPartOfUnmatchedCompound($userText, $aliasLower)) {
                        continue;
                    }
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
        $isCleanPSingleWord = !str_contains($cleanP, ' ') && $cleanP !== 'esteh';

        if (($allowSingleWordAlias || !$isCleanPSingleWord) && strlen($cleanP) >= 4 && preg_match('/\b' . preg_quote($cleanP, '/') . '\b/i', $userText, $m)) {
            if (!$isCleanPSingleWord || !$this->isSingleWordPartOfUnmatchedCompound($userText, $cleanP)) {
                $matchedPhrase = $m[0];
                return true;
            }
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

    protected function formatResult(array $aiData, string $defaultLoc, string $rawMessage = ''): array
    {
        $isReady = !empty($aiData['is_order_ready']);
        $isCustom = !empty($aiData['is_custom']);
        $rawSummary = $aiData['summary'] ?? [];
        $subtotal = $rawSummary['subtotal'] ?? $rawSummary['items_subtotal'] ?? 0;
        $deliveryFee = $rawSummary['delivery_fee'] ?? ($isCustom ? 3500 : 3000);
        $adminFee = $rawSummary['admin_fee'] ?? ($isCustom ? 2500 : 2000);
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
        $customNotes = $aiData['custom_notes'] ?? ($isCustom ? $rawMessage : null);
        $customItems = $aiData['custom_items'] ?? [];

        if ($isCustom) {
            $barokah = $this->getBarokahCanteen();
            $barokahId = $barokah ? $barokah->id : 173;
            $barokahName = $barokah ? $barokah->name : 'Kantin Barokah Pusat';

            if (empty($customItems) && !empty($customNotes)) {
                $parser = new CustomOrderParserService();
                $customItems = $parser->parseNotes($customNotes);
            }

            $canteens = [
                [
                    'canteen_id' => $barokahId,
                    'canteen_name' => $barokahName,
                    'items' => [],
                ]
            ];
        } elseif (!empty($canteens) && is_array($canteens)) {
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
            'is_custom' => $isCustom,
            'canteen_id' => $isCustom ? ($canteens[0]['canteen_id'] ?? 173) : ($aiData['canteen_id'] ?? null),
            'delivery_location' => $deliveryLocation,
            'recipient_name' => $recipientName,
            'recipient_room' => $recipientRoom,
            'quick_replies' => $aiData['quick_replies'] ?? [],
            'custom_notes' => $customNotes,
            'custom_items' => $customItems,
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
