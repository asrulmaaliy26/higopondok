<?php

namespace App\Domains\Canteen\Services;

use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\Product;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiSmartOrderingService
{
    protected array $models = [
        'gemini-3.8-flash',
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-flash-latest',
    ];

    protected function getApiKey(): ?string
    {
        return config('services.gemini.api_key') ?: env('GEMINI_API_KEY');
    }

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
        // Es teh: "esteh"
        $text = preg_replace('/\besteh\b/iu', 'es teh', $text);
        // Nasi goreng: "nasgor"
        $text = preg_replace('/\bnasgor\b/iu', 'nasi goreng', $text);
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
        if (!empty($apiKey)) {
            $aiResult = $this->callGemini($normalizedMessage, $products, $userLocation, $history);
            if (!empty($aiResult) && is_array($aiResult)) {
                $result = $this->formatResult($aiResult, $userLocation);
            }
        }

        // Fallback: Rule-based & Fuzzy catalog matcher (100% offline & instan)
        if (!$result) {
            $result = $this->ruleBasedMatcher($normalizedMessage, $products, $userLocation, $history, $user);
        }

        // Jika terdeteksi intent bantuan/CS, pastikan support_contact selalu terisi
        $isHelp = preg_match('/(?:bantuan|tolong\s*(?:bantu|admin)|hubungi\s*(?:admin|toko|kantin|cs|pengelola)|kontak\s*(?:admin|toko|kantin)|chat\s*(?:langsung\s*)?(?:admin|toko|kantin|cs)|komplain|kendala|masalah|wa\s*(?:admin|toko|kantin)|nomor\s*(?:admin|toko|kantin|wa)|customer\s*service|tanya\s*admin|bicara\s*dengan\s*admin)/i', $normalizedMessage);
        if ($isHelp && empty($result['support_contact'])) {
            $result['support_contact'] = $this->getSupportContacts(null, null, $user);
            $result['is_help_intent'] = true;
        }

        return $result;
    }

    /**
     * Cek status pesanan terkini santri (apakah sudah diterima / dalam perjalanan / menunggu)
     */
    public function checkRecentOrderStatus(?User $user, string $queryMessage = ''): array
    {
        if (!$user) {
            return [
                'reply_text' => "Mohon maaf kak, untuk mengecek status pesanan terkini, pastikan Kakak sudah login ke akun Santri / Wali ya! 😊",
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
                'reply_text' => "Saat ini belum ada riwayat pesanan aktif atas nama akun Kakak ({$user->name}). 😊\n\nMau pesan makan, minum, atau titip beli sekarang? Tulis saja pesananmu langsung, misalnya:\n• *\"Pesan 1 Bakso Mercon antar ke kamar\"*\n• *\"2 Mie Gacoan Lv 1 sama Es Teh 2\"*",
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
            $statusLabel = 'SELESAI (Sudah Diterima Santri)';
            $replyText = "Alhamdulillah kak! Pesanan **#ORD-{$order->id}** ({$canteenName}) **SUDAH DITERIMA OLEH SANTRI**! 🎉\n\n"
                . "📋 **Rincian Penerimaan**:\n"
                . "• **Penerima**: {$recipient} ({$room})\n"
                . "• **Menu**: {$itemsList}\n"
                . "• **Kurir Pengantar**: " . ($courierName ?: 'Kurir Pondok') . "\n"
                . "• **Waktu Pemesanan**: {$timeStr}\n"
                . ($hasProof ? "• **Bukti Serah Terima**: Foto bukti serah terima telah tersimpan di sistem ✅\n\n" : "\n")
                . "Pesanan sudah aman sampai di tangan santri. Selamat menikmati ya kak! 😊";
        } elseif ($order->status === 'processing') {
            $statusLabel = 'Sedang Diproses & Diantar Kurir';
            $replyText = "Pesanan **#ORD-{$order->id}** ({$canteenName}) saat ini **BELUM DITERIMA**, tetapi **SEDANG DALAM PROSES PENGANTARAN** oleh kurir! 🛵💨\n\n"
                . "📋 **Status Terkini**:\n"
                . "• **Tujuan Antar**: {$recipient} ({$room})\n"
                . "• **Menu**: {$itemsList}\n"
                . "• **Kurir yang Bertugas**: " . ($courierName ? "**{$courierName}**" : "Sedang disiapkan toko/kurir") . "\n"
                . "• **Status Pembayaran**: " . ($order->payment_status === 'paid' ? 'Lunas / Terverifikasi ✅' : 'Menunggu Verifikasi') . "\n\n"
                . "Mohon ditunggu ya kak, kurir sedang bergegas mengantarkan pesanan ke kamar santri. 😊";
        } elseif ($order->status === 'pending') {
            $statusLabel = 'Menunggu Konfirmasi / Pembayaran';
            $replyText = "Pesanan **#ORD-{$order->id}** ({$canteenName}) saat ini berstatus **MENUNGGU KONFIRMASI / PEMBAYARAN** (Belum diproses kurir). ⏳\n\n"
                . "📋 **Status Terkini**:\n"
                . "• **Penerima**: {$recipient} ({$room})\n"
                . "• **Menu**: {$itemsList}\n"
                . "• **Status Bayar**: " . ($order->payment_status === 'paid' ? 'Lunas' : 'Belum Dibayar / Menunggu Bukti Transfer') . "\n\n"
                . "Silakan pastikan bukti transfer sudah diunggah di menu Pembayaran agar pesanan segera disiapkan oleh kantin ya kak!";
        } else {
            $statusLabel = 'Dibatalkan';
            $replyText = "Pesanan **#ORD-{$order->id}** ({$canteenName}) berstatus **DIBATALKAN**. ⚠️\n\n"
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
     */
    public static function buildUserGreetingText(?User $user, string $recipientTitle, string $intent): string
    {
        $text = "Assalamu'alaikum Warahmatullahi Wabarakatuh, {$recipientTitle}.\n\n";
        $text .= "Perkenalkan saya:\n";

        if ($user) {
            if ($user->is_teacher) {
                $text .= "👨‍🏫 *Guru / Staff*: {$user->name}\n";
                if ($user->teacher_unit) {
                    $text .= "🏢 Unit: {$user->teacher_unit}\n";
                }
            } else {
                $waliName = $user->name;
                $santriName = $user->santri_name ?: $user->name;
                $room = $user->santri_room;
                $class = $user->santri_class;

                if ($waliName) {
                    $text .= "👤 *Nama Wali*: {$waliName}\n";
                }
                if ($santriName) {
                    $text .= "🎓 *Nama Santri*: {$santriName}\n";
                }
                $locInfo = implode(' | ', array_filter([$class, $room]));
                if ($locInfo) {
                    $text .= "🏠 *Kamar / Kelas*: {$locInfo}\n";
                }
            }
        } else {
            $text .= "👤 *Pengguna HiGO Pondok*\n";
        }

        $text .= "\nMaksud saya: {$intent}\n\n";
        $text .= "Terima kasih, Syukron Jazakumullah Khairan. 🙏";

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
        $adminMsg = self::buildUserGreetingText($user, "Admin HiGO Pondok", "saya butuh bantuan / tanya terkait aplikasi dan layanan santri.");
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
            $cMsg = self::buildUserGreetingText($user, "Admin Toko {$canteen->name}", "saya ingin bertanya terkait menu / pesanan di HiGO Pondok.");
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
                $msg = AiSmartOrderingService::buildUserGreetingText($user, "Toko {$c->name}", "saya ingin bertanya terkait menu / pesanan di HiGO Pondok.");
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
            . "Format output JSON wajib:\n"
            . "{\n"
            . "  \"reply_text\": \"Teks balasan ramah & interaktif untuk santri...\",\n"
            . "  \"is_order_ready\": false / true,\n"
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

        $apiKey = $this->getApiKey();
        foreach ($this->models as $model) {
            try {
                $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
                $res = Http::withHeaders(['Content-Type' => 'application/json'])
                    ->timeout(12)
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
                }
            } catch (\Throwable $e) {
                Log::info("[AiSmartOrdering] Model {$model} error: " . $e->getMessage());
            }
        }

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
        foreach ($sortedProducts as $p) {
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

            // Cek kecocokan kata nama produk secara cerdas
            $isMatch = $this->isProductMatch($lower, $pNameClean);

            if ($isMatch && !in_array($p->id, $matchedProductIds)) {
                $matchedProductIds[] = $p->id;
                $coveredPhrases[] = $pNameLower;

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
                    // Cari quantity
                    $qty = 1;
                    $normalizedP = preg_replace('/baksosapi/i', 'bakso sapi', $pNameLower);
                    $cleanP = trim(preg_replace('/\b(?:sapi|ai)\b/i', ' ', $normalizedP));
                    $cleanP = preg_replace('/\s+/', ' ', $cleanP);

                    $pattList = [preg_quote($pNameLower, '/')];
                    if ($cleanP !== $pNameLower && strlen($cleanP) >= 4) {
                        $pattList[] = preg_quote($cleanP, '/');
                    }
                    $nameRegex = '(?:' . implode('|', $pattList) . ')';

                    if (preg_match('/(\d+)\s*(?:porsi|buah|bungkus|pcs|cup|gelas|mangkok|mangkuk)?\s*' . $nameRegex . '/i', $lower, $mQty)) {
                        $qty = (int) $mQty[1];
                    } elseif (preg_match('/' . $nameRegex . '\s*(?:aja\s*)?(\d+)/i', $lower, $mQty)) {
                        $qty = (int) $mQty[1];
                    } elseif (preg_match('/(?:dua|2)\s*(?:porsi\s*)?' . $nameRegex . '/i', $lower)) {
                        $qty = 2;
                    } elseif (preg_match('/(?:tiga|3)\s*(?:porsi\s*)?' . $nameRegex . '/i', $lower)) {
                        $qty = 3;
                    } elseif (preg_match('/(?:dua|2)\s*porsi/i', $lower)) {
                        $qty = 2;
                    } elseif (preg_match('/(?:tiga|3)\s*porsi/i', $lower)) {
                        $qty = 3;
                    } elseif (preg_match('/(\d+)\s*porsi/i', $lower, $mPorsi)) {
                        $qty = (int) $mPorsi[1];
                    } elseif (preg_match('/(?:pesan|beli|mau)\s+(\d+)\s+/i', $lower, $mDepan)) {
                        $qty = (int) $mDepan[1];
                    } elseif (preg_match('/^(\d+)\s+/i', $lower, $mAwal)) {
                        $qty = (int) $mAwal[1];
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
                    break;
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

        // B. DETEKSI PERTANYAAN / EKSPLORASI MENU & KATEGORI UMUM (Misal: "saya mau beli bakso", "ada bakso apa aja", "mau pesen mie apa ada", "jual apa")
        if (empty($matchedCanteens)) {
            $foodKeywords = [
                'bakso' => 'Bakso',
                'mie' => 'Mie',
                'seblak' => 'Seblak',
                'dimsum' => 'Dimsum',
                'ayam' => 'Ayam',
                'bebek' => 'Bebek',
                'nasgor' => 'Nasi Goreng',
                'nasi goreng' => 'Nasi Goreng',
                'nasi' => 'Nasi',
                'sate' => 'Sate',
                'martabak' => 'Martabak',
                'terang bulan' => 'Terang Bulan',
                'gorengan' => 'Gorengan',
                'snack' => 'Snack / Camilan',
                'camilan' => 'Camilan',
                'minum' => 'Minuman',
                'minuman' => 'Minuman',
                'es teh' => 'Es Teh',
                'es' => 'Minuman Es',
                'kopi' => 'Kopi',
                'jus' => 'Jus',
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

            $isAskingExplore = $matchedKeyword !== null || preg_match('/(?:apa\s*(?:ada|aja)|ada\s*apa|menu\s*apa|jual\s*apa|pilihan|rekomendasi|list|daftar|spesial|apakah\s*ada|mau\s*(?:beli|pesan|makan|minum)|ingin\s*(?:beli|pesan)|pengen\s*(?:beli|makan|minum)?|cari|butuh)/i', $lower);

            if ($isAskingExplore) {
                $matchedList = $products->filter(function ($p) use ($matchedKeyword) {
                    if ($matchedKeyword) {
                        return str_contains(strtolower($p->name), $matchedKeyword) 
                            || str_contains(strtolower($p->category ?? ''), $matchedKeyword);
                    }
                    return true;
                })->take(7);

                if ($matchedList->isNotEmpty()) {
                    $label = $matchedCategoryLabel ?: 'favorit';
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
            $defaultCanteen = Canteen::first();
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

        // E. Jika tidak ada kata yang cocok sama sekali
        return [
            'reply_text' => "Maaf kak, saya belum menemukan menu \"{$message}\" di katalog kantin pondok saat ini. 😅\n\nMenu favorit yang tersedia antara lain:\n• Aneka **Bakso** (Bakso Mercon, Bakso Sapi Halus, Bakso Urat, dll)\n• **Mie Gacoan** (Tersedia Lv 0 s/d 8)\n• **Nasi Ayam & Nasi Goreng**\n• Aneka Minuman Segar & Camilan\n\nJika ingin membeli barang di luar pondok, Kakak bisa ketik: *\"Titip beli [nama barang] di toko luar\"*.",
            'is_order_ready' => false,
            'recipient_name' => null,
            'recipient_room' => $loc,
            'quick_replies' => [
                "Ada menu bakso apa aja?",
                "Mau pesan mie apa ada?",
                "Pesan Bakso Mercon 1 porsi",
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
     * Pencocokan cerdas teks santri dengan nama produk katalog (Toleran Typo, Voice Slips & Spasi)
     */
    protected function isProductMatch(string $userText, string $productName): bool
    {
        $userText = preg_replace('/\s+/', ' ', strtolower(trim($userText)));
        $pLower = preg_replace('/\s+/', ' ', strtolower(trim($productName)));

        // 1. Kecocokan langsung (exact substring)
        if (strlen($pLower) >= 4 && str_contains($userText, $pLower)) {
            return true;
        }

        // 2. Normalisasi kata imbuhan / pelengkap ("sapi", "ai", spasi ganda)
        // Contoh: "BaksoSapi telur" -> "bakso telur", "Bakso Sapi Urat" -> "bakso urat"
        $normalizedP = preg_replace('/baksosapi/i', 'bakso sapi', $pLower);
        $cleanP = trim(preg_replace('/\b(?:sapi|ai)\b/i', ' ', $normalizedP));
        $cleanP = preg_replace('/\s+/', ' ', $cleanP);

        if (strlen($cleanP) >= 4 && str_contains($userText, $cleanP)) {
            return true;
        }

        // 3. Kecocokan Token Kunci dengan toleransi Typo (Levenshtein / similar_text)
        $tokens = array_values(array_filter(explode(' ', $cleanP), fn($t) => strlen($t) >= 3));
        $userWords = array_values(array_filter(explode(' ', $userText), fn($w) => strlen($w) >= 2));

        if (count($tokens) >= 2) {
            $allMatch = true;
            foreach ($tokens as $token) {
                $matchedToken = false;
                foreach ($userWords as $uWord) {
                    if ($uWord === $token) {
                        $matchedToken = true;
                        break;
                    }
                    // Toleransi 1 karakter typo (misal: "kulis" vs "kulit", "baso" vs "bakso", "mia" vs "mie")
                    if (strlen($token) >= 3 && levenshtein($uWord, $token) <= 1) {
                        $matchedToken = true;
                        break;
                    }
                    if (strlen($token) >= 4) {
                        similar_text($uWord, $token, $pct);
                        if ($pct >= 75) {
                            $matchedToken = true;
                            break;
                        }
                    }
                }
                if (!$matchedToken) {
                    $allMatch = false;
                    break;
                }
            }
            if ($allMatch) {
                return true;
            }
        }

        // 4. Full phrase fuzzy similarity (jika kemiripan teks di atas 80%)
        if (strlen($cleanP) >= 6) {
            similar_text($userText, $cleanP, $simPct);
            if ($simPct >= 80) {
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
        }

        $canteens = $aiData['canteens'] ?? [];
        if (!empty($canteens) && is_array($canteens)) {
            foreach ($canteens as &$canteen) {
                if (!empty($canteen['items']) && is_array($canteen['items'])) {
                    foreach ($canteen['items'] as &$item) {
                        $p = null;
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
