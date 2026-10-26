<?php

namespace App\Domains\Canteen\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CustomOrderParserService
{
    use GeminiModelPoolTrait;

    /**
     * Parse catatan titip beli (pesanan khusus) bebas santri menjadi daftar checklist belanja terstruktur
     *
     * @param string|null $notes
     * @return array Array of items: [['id' => 1, 'item' => 'Tolak Angin', 'quantity' => 3, 'unit' => 'saset', 'notes' => '', 'is_checked' => false]]
     */
    public function parseNotes(?string $notes, bool $preferAi = false): array
    {
        if (empty($notes) || !trim($notes)) {
            return [];
        }

        $cleanNotes = trim($notes);

        // Jika sudah berbentuk format JSON array valid, decode langsung
        if (str_starts_with($cleanNotes, '[') && str_ends_with($cleanNotes, ']')) {
            $decoded = json_decode($cleanNotes, true);
            if (is_array($decoded) && !empty($decoded)) {
                return $this->formatStandardItems($decoded);
            }
        }

        // 1. Prioritaskan Rule-based NLP Parser (100% instan < 1ms, akurat, tanpa lag & hemat kuota AI)
        $fastParsed = $this->ruleBasedParse($cleanNotes);
        if (!empty($fastParsed)) {
            return $fastParsed;
        }

        // 2. Fallback AI jika preferAi aktif dan API key tersedia
        if ($preferAi) {
            $apiKey = $this->getApiKey();
            if (!empty($apiKey)) {
                $aiParsed = $this->parseWithGemini($cleanNotes, $apiKey);
                if (!empty($aiParsed) && is_array($aiParsed)) {
                    return $this->formatStandardItems($aiParsed);
                }
            }
        }

        return $fastParsed ?: [];
    }

    /**
     * Parsing dengan Google Gemini API
     */
    protected function parseWithGemini(string $notes, string $apiKey): ?array
    {
        $prompt = "Kamu adalah asisten kurir pondok pesantren yang bertugas mengubah catatan bebas titip beli / pesanan khusus santri atau wali santri menjadi checklist belanja terstruktur.\n\n"
            . "Teks catatan santri:\n"
            . "\"{$notes}\"\n\n"
            . "Instruksi format:\n"
            . "Kembalikan HANYA array of objects JSON valid tanpa markdown formatting tambahan dengan struktur:\n"
            . "[\n"
            . "  {\n"
            . "    \"item\": \"Nama Barang (Title Case)\",\n"
            . "    \"quantity\": 1,\n"
            . "    \"unit\": \"pcs/saset/bungkus/botol/biji/buah/kotak/porsi\",\n"
            . "    \"notes\": \"keterangan tambahan/rasa/varian bila ada, kosongkan string jika tidak ada\"\n"
            . "  }\n"
            . "]\n\n"
            . "Aturan:\n"
            . "1. Hilangkan frasa pengantar pembuka kalimat seperti 'tolong belikan', 'tolong beli', 'titip beli', 'titip', 'mohon belikan'. JANGAN menghapus huruf dari nama barang (contoh: 'buku' tetap 'Buku', bukan 'Ku').\n"
            . "2. 'quantity' harus berupa angka integer positif. Jika tidak disebut, default 1.\n"
            . "3. 'unit' gunakan satuan bahasa Indonesia yang umum (pcs, saset, bungkus, botol, porsi, buah, strip, pack).\n"
            . "4. Pisahkan setiap barang berbeda menjadi item tersendiri.";

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
                'temperature' => 0.1,
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
                    $response = Http::withHeaders(['Content-Type' => 'application/json'])
                        ->timeout(10)
                        ->post($endpoint, $payload);

                    if ($response->successful()) {
                        $json = $response->json();
                        $text = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;
                        if ($text) {
                            $parsed = json_decode(trim($text), true);
                            if (is_array($parsed) && !empty($parsed)) {
                                return $parsed;
                            }
                        }
                    } elseif ($response->status() === 429 || $response->status() === 403) {
                        Log::warning("[CustomOrderParser] Rate limit pada model {$model}: HTTP {$response->status()}");
                        $this->recordModelRateLimit($model, 30);
                        continue;
                    }
                } catch (\Throwable $e) {
                    Log::info("[CustomOrderParser] Model {$model} error: " . $e->getMessage());
                }
            }
        }

        return null;
    }

    /**
     * Parser Rule-Based Cerdas (Offline NLP)
     * Mampu memecah koma, baris baru, nomor (1., 2.), kata sambung 'sama', 'dan', 'serta'
     */
    public function ruleBasedParse(string $notes): array
    {
        $raw = trim($notes);

        // Bersihkan pembuka kalimat sopan santri (gunakan \b agar tidak memotong nama barang seperti 'buku')
        $clean = preg_replace('/^(?:tolong|mohon|nitip|titip|minta\s+tolong)?\s*(?:belikan|beliin|beli|pesankan|pesan)?\s*(?:\b(?:dong|ya|yah|kak|bang|mas|pak|bu|om)\b)?\s*[:,-]?\s*/i', '', $raw);

        // Ganti baris baru, penomoran (1., 2), •, *, - dengan pemisah unik
        $normalized = preg_replace('/\r\n|\r|\n/', ' ### ', $clean);
        $normalized = preg_replace('/(?:\d+[\.\)]|•|\*|-)\s*/', ' ### ', $normalized);

        // Split koma dan titik koma
        $normalized = preg_replace('/[,;]+/', ' ### ', $normalized);

        // Split kata penghubung ' dan ', ' sama ', ' serta ', ' lalu '
        $normalized = preg_replace('/\s+(?:dan|sama|serta|lalu)\s+/i', ' ### ', $normalized);

        $chunks = explode('###', $normalized);
        $items = [];
        $id = 1;

        $knownUnits = 'pcs|buah|biji|bungkus|bks|saset|sachet|strip|tablet|botol|btl|pack|pak|kotak|gelas|cup|porsi|lembar|butir|kg|gram|ons|liter|ikat|batang|btg';

        foreach ($chunks as $chunk) {
            $chunk = trim($chunk);
            if (empty($chunk)) {
                continue;
            }

            // Bersihkan sisa kata sambung atau pembuka di awal chunk
            $chunk = preg_replace('/^(?:dan|sama|serta|lalu|juga|beli|belikan|nitip)\s+/i', '', $chunk);
            $chunk = trim($chunk, " \t\n\r\0\x0B.,;:-");

            if (strlen($chunk) < 2) {
                continue;
            }

            $qty = 1;
            $unit = 'pcs';
            $itemName = $chunk;
            $note = '';

            // Pola 1: Angka + Satuan di akhir (contoh: "Tolak Angin 3 saset", "Roti Aoka 2 buah")
            if (preg_match('/^(.*?)\s+(\d+)\s*(' . $knownUnits . ')?$/i', $chunk, $matches)) {
                $candidateItem = trim($matches[1]);
                if (strlen($candidateItem) >= 2) {
                    $itemName = $candidateItem;
                    $qty = (int) $matches[2];
                    $unit = !empty($matches[3]) ? strtolower($matches[3]) : 'pcs';
                }
            }
            // Pola 2: Angka + Satuan di awal (contoh: "3 saset Tolak Angin", "2 bungkus Mie Sedap")
            elseif (preg_match('/^(\d+)\s*(' . $knownUnits . ')?\s+(.*?)$/i', $chunk, $matches)) {
                $qty = (int) $matches[1];
                $unit = !empty($matches[2]) ? strtolower($matches[2]) : 'pcs';
                $itemName = trim($matches[3]);
            }
            // Pola 3: Angka di tengah dengan satuan (contoh: "Aqua 600ml 2 botol dingin")
            elseif (preg_match('/^(.*?)\s+(\d+)\s*(' . $knownUnits . ')\s*(.*)$/i', $chunk, $matches)) {
                $itemName = trim($matches[1]);
                $qty = (int) $matches[2];
                $unit = strtolower($matches[3]);
                $note = trim($matches[4]);
            }
            // Pola 4: Hanya ada angka di akhir (contoh: "Roti Aoka 2")
            elseif (preg_match('/^(.*?)\s+(\d+)$/i', $chunk, $matches)) {
                $candidateItem = trim($matches[1]);
                if (strlen($candidateItem) >= 2) {
                    $itemName = $candidateItem;
                    $qty = (int) $matches[2];
                    $unit = 'pcs';
                }
            }

            // Normalisasi ejaan satuan umum
            $unitMap = [
                'bks' => 'bungkus',
                'sachet' => 'saset',
                'pak' => 'pack',
                'btl' => 'botol',
                'btg' => 'batang',
            ];
            $unit = $unitMap[$unit] ?? $unit;

            // Bersihkan kurung atau detail catatan jika ada (contoh: "Nasi Padang (lauk ayam bakar)")
            if (preg_match('/^(.*?)\s*\((.*?)\)$/', $itemName, $noteMatches)) {
                $itemName = trim($noteMatches[1]);
                $note = empty($note) ? trim($noteMatches[2]) : ($note . ' • ' . trim($noteMatches[2]));
            }

            // Ubah item name menjadi Title Case ringkas
            $itemName = ucwords(strtolower(trim($itemName)));

            if (!empty($itemName)) {
                $items[] = [
                    'id' => $id++,
                    'item' => $itemName,
                    'quantity' => max(1, $qty),
                    'unit' => $unit,
                    'notes' => $note,
                    'is_checked' => false,
                ];
            }
        }

        // Jika rule-based tidak menghasilkan item (teks terlalu pendek/unik), jadikan 1 item tunggal
        if (empty($items)) {
            $items[] = [
                'id' => 1,
                'item' => ucwords(strtolower($clean)),
                'quantity' => 1,
                'unit' => 'item',
                'notes' => '',
                'is_checked' => false,
            ];
        }

        return $items;
    }

    /**
     * Standarisasi format array checklist
     */
    protected function formatStandardItems(array $rawItems): array
    {
        $formatted = [];
        $id = 1;

        foreach ($rawItems as $it) {
            if (!is_array($it)) {
                continue;
            }

            $name = trim($it['item'] ?? $it['name'] ?? $it['product'] ?? '');
            if (empty($name)) {
                continue;
            }

            $qty = isset($it['quantity']) ? (int) $it['quantity'] : (isset($it['qty']) ? (int) $it['qty'] : 1);
            $unit = trim($it['unit'] ?? $it['satuan'] ?? 'pcs') ?: 'pcs';
            $note = trim($it['notes'] ?? $it['catatan'] ?? $it['description'] ?? '');
            $isChecked = !empty($it['is_checked']);

            $formatted[] = [
                'id' => $id++,
                'item' => ucwords(strtolower($name)),
                'quantity' => max(1, $qty),
                'unit' => strtolower($unit),
                'notes' => $note,
                'is_checked' => $isChecked,
            ];
        }

        return $formatted;
    }
}
