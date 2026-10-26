<?php

namespace App\Domains\Canteen\Services;

use App\Domains\Canteen\Order;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReceiptScannerService
{
    /**
     * Model Gemini yang digunakan secara berurutan jika terjadi kendala/demand spike
     */
    protected array $models = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
        'gemini-3-flash-preview',
    ];

    /**
     * Dapatkan API Key Gemini
     */
    protected function getApiKey(): ?string
    {
        return config('services.gemini.api_key') ?: env('GEMINI_API_KEY');
    }

    /**
     * Pindai dan ekstrak data dari gambar struk / bukti pembayaran
     */
    public function scanReceipt(string $imagePath): array
    {
        $apiKey = $this->getApiKey();
        if (empty($apiKey)) {
            Log::warning('[ReceiptScanner] GEMINI_API_KEY belum disetel di backend/.env');
            return [
                'is_transfer_receipt' => false,
                'status' => 'UNKNOWN',
                'amount' => null,
                'date' => null,
                'time' => null,
                'ref_number' => null,
                'source_bank' => null,
                'recipient_name' => null,
                'confidence_score' => 0.0,
                'error' => 'GEMINI_API_KEY tidak ditemukan',
            ];
        }

        // Tentukan sumber data file gambar (Lokal / Temp / Disk Public / Google Drive / URL)
        $fileContents = null;
        $mime = 'image/jpeg';

        if (file_exists($imagePath) && is_file($imagePath)) {
            $mime = @mime_content_type($imagePath) ?: 'image/jpeg';
            $fileContents = @file_get_contents($imagePath);
        } elseif (Storage::disk('public')->exists($imagePath)) {
            $storagePath = Storage::disk('public')->path($imagePath);
            $mime = @mime_content_type($storagePath) ?: 'image/jpeg';
            $fileContents = @file_get_contents($storagePath);
        } else {
            // Fallback untuk URL eksternal atau Google Drive disk
            try {
                if (filter_var($imagePath, FILTER_VALIDATE_URL)) {
                    $resp = Http::timeout(15)->get($imagePath);
                    if ($resp->successful()) {
                        $fileContents = $resp->body();
                        $mime = $resp->header('Content-Type') ?: 'image/jpeg';
                    }
                } elseif (config('filesystems.disks.google') && Storage::disk('google')->exists($imagePath)) {
                    $fileContents = Storage::disk('google')->get($imagePath);
                    $mime = Storage::disk('google')->mimeType($imagePath) ?: 'image/jpeg';
                }
            } catch (\Throwable $e) {
                Log::warning("[ReceiptScanner] Gagal membaca gambar dari disk google/URL: " . $e->getMessage());
            }
        }

        if ($fileContents === null || $fileContents === false) {
            Log::error("[ReceiptScanner] File gambar tidak dapat dibaca di server: {$imagePath}");
            return [
                'is_transfer_receipt' => false,
                'status' => 'UNKNOWN',
                'amount' => null,
                'error' => 'File gambar tidak ditemukan atau gagal dibaca di server',
            ];
        }

        $base64Data = base64_encode($fileContents);

        $prompt = 'Kamu adalah sistem kecerdasan buatan (AI) pembaca bukti transfer m-Banking, struk ATM, dan pembayaran QRIS di Indonesia.
Analisis gambar struk pembayaran ini secara teliti dan akurat.
Kembalikan respon HANYA dalam format JSON valid tanpa tanda markdown (```json):
{
  "is_transfer_receipt": boolean (true jika gambar ini memang bukti bayar/transfer uang/m-banking/QRIS/struk e-wallet),
  "status": "SUCCESS" | "FAILED" | "PENDING" | "UNKNOWN" (status transfer: Berhasil/Sukses/Selesai/Paid => "SUCCESS", Gagal => "FAILED", Menunggu => "PENDING"),
  "amount": integer atau null (total nominal bersih yang ditransfer/dibayar, angka bulat tanpa simbol mata uang Rp atau titik/koma, contoh: 25000),
  "date": "YYYY-MM-DD" atau null (tanggal transaksi jika tertera),
  "time": "HH:MM" atau null (jam & menit transaksi jika tertera),
  "ref_number": string atau null (nomor referensi / ID transaksi / no ref unik),
  "source_bank": string atau null (nama bank atau aplikasi pengirim seperti BCA, BRI, Mandiri, BNI, BSI, QRIS, Dana, GoPay, OVO, ShopeePay),
  "recipient_name": string atau null (nama penerima transfer jika terlihat),
  "confidence_score": float (skor keyakinan AI antara 0.0 hingga 1.0),
  "ai_note": string (catatan detail kondisi bukti transfer untuk superadmin: sebutkan apakah gambar jelas/buram/terpotong, ada tanggal transaksi atau tidak, kejelasan nominal, atau jika bukan bukti bayar)
}';

        $payload = [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt],
                        [
                            'inline_data' => [
                                'mime_type' => $mime,
                                'data' => $base64Data,
                            ],
                        ],
                    ],
                ],
            ],
            'generationConfig' => [
                'response_mime_type' => 'application/json',
                'temperature' => 0.1,
            ],
        ];

        foreach ($this->models as $modelName) {
            try {
                $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$modelName}:generateContent?key={$apiKey}";

                $response = Http::withHeaders([
                    'Content-Type' => 'application/json',
                ])
                ->timeout(10)
                ->post($endpoint, $payload);

                if ($response->successful()) {
                    $jsonRes = $response->json();
                    $text = $jsonRes['candidates'][0]['content']['parts'][0]['text'] ?? null;
                    if ($text) {
                        $parsed = json_decode(trim($text), true);
                        if (is_array($parsed)) {
                            $parsed['model_used'] = $modelName;
                            return $parsed;
                        }
                    }
                } else {
                    Log::warning("[ReceiptScanner] Model {$modelName} gagal: HTTP {$response->status()} - {$response->body()}");
                }
            } catch (\Throwable $e) {
                Log::warning("[ReceiptScanner] Error memanggil model {$modelName}: " . $e->getMessage());
            }
        }

        return [
            'is_transfer_receipt' => false,
            'status' => 'UNKNOWN',
            'amount' => null,
            'error' => 'Semua model AI sedang sibuk atau tidak dapat merespons.',
        ];
    }

    /**
     * Verifikasi bukti pembayaran terhadap tagihan pesanan dan ubah status jika valid
     * Mendukung multi-gambar bukti transfer (akumulasi cicilan bayar, patch kekurangan, filter foto valid, dan cegah hitung ganda)
     *
     * @param Order|Collection $orders
     * @param string|array $imagePaths
     * @param array $localScanPaths Optional local file paths for zero-latency direct AI scanning
     * @return array
     */
    public function verifyAndApplyPayment($orders, string|array $imagePaths, array $localScanPaths = []): array
    {
        $orderCollection = $orders instanceof Collection ? $orders : collect([$orders]);
        if ($orderCollection->isEmpty()) {
            return [
                'verified' => false,
                'message' => 'Pesanan tidak ditemukan.',
                'scan' => null,
            ];
        }

        $paths = is_array($imagePaths) ? $imagePaths : [$imagePaths];
        $paths = array_values(array_filter($paths));

        // Hitung total tagihan yang harus dibayar
        $totalExpected = 0.0;
        foreach ($orderCollection as $order) {
            $totalExpected += (float) $order->total_price;
        }

        $orderIds = $orderCollection->pluck('id')->toArray();
        $checkoutIds = $orderCollection->pluck('checkout_id')->filter()->unique()->toArray();

        // 1. Ambil bukti transfer valid yang sudah tersimpan sebelumnya pada pesanan ini
        $existingValidReceipts = $this->getExistingValidReceipts($orderCollection);
        $existingRawProofs = $this->getExistingRawProofs($orderCollection);

        $seenFingerprints = [];
        $validReceipts = [];
        $accumulatedAmount = 0.0;
        $usedRefNumbers = [];
        $hasDuplicateFraud = false;
        $duplicateRefName = null;

        // Muat bukti transfer valid yang sudah ada sebelumnya (untuk akumulasi / "menambal" kekurangan bayar)
        foreach ($existingValidReceipts as $prevReceipt) {
            $fp = $this->getReceiptFingerprint($prevReceipt);
            $seenFingerprints[$fp] = true;
            $validReceipts[] = $prevReceipt;
            $prevAmt = isset($prevReceipt['amount']) && is_numeric($prevReceipt['amount']) ? (float) $prevReceipt['amount'] : 0.0;
            $accumulatedAmount += $prevAmt;

            if (!empty($prevReceipt['ref_number'])) {
                $ref = trim($prevReceipt['ref_number']);
                if (!in_array($ref, $usedRefNumbers)) {
                    $usedRefNumbers[] = $ref;
                }
            }
        }

        $scannedResults = [];

        // 2. Pindai setiap berkas gambar yang baru diunggah
        foreach ($paths as $idx => $path) {
            $scanTarget = (!empty($localScanPaths[$idx]) && file_exists($localScanPaths[$idx]))
                ? $localScanPaths[$idx]
                : $path;

            $scan = $this->scanReceipt($scanTarget);
            $scan['file_path'] = $path; // Tetap simpan path resmi untuk database & frontend
            $scan['file_index'] = count($existingRawProofs) + $idx + 1;
            $scannedResults[] = $scan;

            $isReceipt = !empty($scan['is_transfer_receipt']);
            $isSuccess = ($scan['status'] ?? '') === 'SUCCESS';
            $detectedAmount = isset($scan['amount']) && is_numeric($scan['amount']) ? (float) $scan['amount'] : 0.0;
            $refNumber = !empty($scan['ref_number']) ? trim($scan['ref_number']) : null;

            if ($isReceipt && $isSuccess && $detectedAmount > 0) {
                // Anti-fraud check: Cek apakah nomor referensi ini sudah pernah dipakai oleh pesanan LAIN yang lunas
                if ($refNumber && strlen($refNumber) >= 6) {
                    $duplicateQuery = Order::where('payment_status', 'paid')
                        ->where('payment_ref_number', 'like', "%{$refNumber}%")
                        ->whereNotIn('id', $orderIds);

                    if (!empty($checkoutIds)) {
                        $duplicateQuery->whereNotIn('checkout_id', $checkoutIds);
                    }

                    if ($duplicateQuery->exists()) {
                        $hasDuplicateFraud = true;
                        $duplicateRefName = $refNumber;
                        Log::warning("[ReceiptScanner] Fraud terdeteksi: No Referensi {$refNumber} sudah pernah digunakan pada pesanan lain yang lunas!");
                        continue;
                    }
                }

                // Cek duplikasi struk dalam pesanan ini (struk yang sama diunggah ulang atau multi-upload struk yang sama)
                // Jika struk sama: JANGAN dijumlahkan ganda, dan JANGAN dianggap fraud!
                $fingerprint = $this->getReceiptFingerprint($scan, $scanTarget);
                if (isset($seenFingerprints[$fingerprint])) {
                    Log::info("[ReceiptScanner] Struk duplikat terdeteksi dalam pesanan ini (Key: {$fingerprint}). Nominal transfer tidak dijumlahkan berulang.");
                    if ($refNumber && !in_array($refNumber, $usedRefNumbers)) {
                        $usedRefNumbers[] = $refNumber;
                    }
                    continue; // Abaikan penambahan ganda nominal
                }

                $seenFingerprints[$fingerprint] = true;
                if ($refNumber && !in_array($refNumber, $usedRefNumbers)) {
                    $usedRefNumbers[] = $refNumber;
                }

                $validReceipts[] = $scan;
                $accumulatedAmount += $detectedAmount;
            }
        }

        // Gabungkan seluruh bukti pembayaran (lama + baru) untuk disimpan di database
        $allProofsCombined = $this->mergeProofLists($existingRawProofs, $scannedResults);
        $now = now('Asia/Jakarta');

        // Syarat Auto-Verify Lunas:
        // 1. Ada minimal 1 bukti transfer valid
        // 2. Akumulasi nominal transfer >= Total Tagihan (toleransi rounding 50)
        // 3. Tidak ada deteksi penipuan nomor referensi dari pesanan lain
        $isAmountValid = !empty($validReceipts) && ($accumulatedAmount >= ($totalExpected - 50));

        $rawNotes = array_filter(array_map(fn($v) => $v['ai_note'] ?? null, $allProofsCombined));
        $combinedAiNotes = !empty($rawNotes) ? implode('; ', array_unique($rawNotes)) : null;
        $refNumbersString = !empty($usedRefNumbers) ? implode(', ', array_unique($usedRefNumbers)) : null;

        if ($isAmountValid && !$hasDuplicateFraud) {
            // VERIFIKASI BERHASIL -> OTOMATIS LUNAS
            $overpaid = max(0.0, $accumulatedAmount - $totalExpected);
            $overpaidInfo = ($overpaid > 0) ? " [Kelebihan Bayar: Rp " . number_format($overpaid, 0, ',', '.') . "]" : '';

            $fmtAccumulated = number_format($accumulatedAmount, 0, ',', '.');
            $conditionNote = "✅ Bukti transfer valid & nominal sesuai (Rp {$fmtAccumulated}).";
            if ($overpaid > 0) {
                $conditionNote .= " Lebih bayar: Rp " . number_format($overpaid, 0, ',', '.') . ".";
            }
            if ($combinedAiNotes) {
                $conditionNote .= " Kondisi AI: {$combinedAiNotes}";
            }

            foreach ($orderCollection as $ord) {
                $ord->payment_status = 'paid';
                $ord->payment_verified_by = 'ai_gemini';
                if (!empty($refNumbersString)) {
                    $ord->payment_ref_number = $refNumbersString;
                }

                // Otomatis lanjutkan pesanan ke 'processing' agar langsung masuk antrean kurir jika masih pending
                if (in_array($ord->status, ['pending', 'waiting_confirmation'])) {
                    $ord->status = 'processing';

                    if (!$ord->courier_id) {
                        $assignedCourierId = DB::table('canteen_couriers')
                            ->where('canteen_id', $ord->canteen_id)
                            ->value('courier_id');
                        if (!$assignedCourierId) {
                            $assignedCourierId = \App\Domains\Auth\User::role('kurir')->value('id');
                        }
                        if ($assignedCourierId) {
                            $ord->courier_id = $assignedCourierId;
                        }
                    }
                }

                $ocrData = [
                    'summary' => count($allProofsCombined) === 1 ? ($allProofsCombined[0]['summary'] ?? 'single_proof_verified') : 'multi_proof_verified',
                    'total_accumulated' => $accumulatedAmount,
                    'total_expected' => $totalExpected,
                    'valid_receipts_count' => count($validReceipts),
                    'proofs' => $allProofsCombined,
                ];
                if ($overpaid > 0) {
                    $ocrData['overpaid_amount'] = $overpaid;
                }
                $ocrData['ai_note'] = $combinedAiNotes ?: ($validReceipts[0]['ai_note'] ?? null);
                $ocrData['condition_note'] = $conditionNote;
                $ord->payment_ocr_data = $ocrData;

                // Sinkronkan created_at ke hari ini jika pesanan lama
                $isNotToday = !Carbon::parse($ord->created_at, 'Asia/Jakarta')->isToday();
                if ($isNotToday) {
                    $ord->created_at = $now;
                    $ord->items()->update(['created_at' => $now]);
                }

                $ord->save();
            }

            $refInfo = !empty($refNumbersString) ? " (Ref: {$refNumbersString})" : '';

            if (count($validReceipts) > 1) {
                $banks = implode(' + ', array_filter(array_map(fn($v) => $v['source_bank'] ?? 'Bank', $validReceipts)));
                $msg = "Pembayaran Rp {$fmtAccumulated} dari " . count($validReceipts) . " bukti transfer ({$banks}) berhasil diverifikasi otomatis oleh AI! Pesanan LUNAS dan otomatis dilanjutkan ke kurir (Sedang Diproses){$refInfo}{$overpaidInfo}.";
            } else {
                $bank = !empty($validReceipts[0]['source_bank']) ? " via {$validReceipts[0]['source_bank']}" : '';
                $msg = "Pembayaran Rp {$fmtAccumulated}{$bank} berhasil diverifikasi otomatis oleh AI! Pesanan LUNAS dan otomatis dilanjutkan ke kurir (Sedang Diproses){$refInfo}{$overpaidInfo}.";
            }

            return [
                'verified' => true,
                'message' => $msg,
                'scan' => [
                    'is_transfer_receipt' => true,
                    'status' => 'SUCCESS',
                    'amount' => $accumulatedAmount,
                    'valid_receipts_count' => count($validReceipts),
                    'ref_number' => $refNumbersString,
                    'proofs' => $allProofsCombined,
                    'ai_note' => $combinedAiNotes,
                    'condition_note' => $conditionNote,
                ],
            ];
        }

        // JIKA TIDAK MEMENUHI SYARAT OTOMATIS:
        // Status pesanan TIDAK DIBATALKAN. Tetap 'waiting_confirmation' agar user bisa mengunggah ulang / menambal
        $reason = '';
        if ($hasDuplicateFraud) {
            $reason = "⚠️ PERHATIAN: Nomor referensi {$duplicateRefName} terdeteksi sudah pernah digunakan pada pesanan lain yang lunas sebelumnya!";
        } elseif (empty($validReceipts)) {
            $reason = '⚠️ Gambar yang diunggah tidak terdeteksi sebagai struk transfer resmi. Silakan unggah bukti transfer yang valid.';
        } elseif (!$isAmountValid) {
            $fmtDetected = number_format($accumulatedAmount, 0, ',', '.');
            $fmtExpected = number_format($totalExpected, 0, ',', '.');
            $kurang = number_format($totalExpected - $accumulatedAmount, 0, ',', '.');

            $newValidCount = count($validReceipts) - count($existingValidReceipts);
            if (!empty($paths) && $newValidCount === 0 && count($existingValidReceipts) > 0) {
                $reason = "⚠️ Gambar baru tidak terdeteksi sebagai struk transfer resmi. Total transfer valid sebelumnya: Rp {$fmtDetected}, total tagihan Rp {$fmtExpected} (Kekurangan: Rp {$kurang}). Silakan unggah struk transfer tambahan.";
            } else {
                $reason = "⚠️ KURANG BAYAR: Terbaca transfer Rp {$fmtDetected}, total tagihan Rp {$fmtExpected} (Kekurangan: Rp {$kurang}). Silakan unggah struk tambahan untuk melunasi.";
            }
        } else {
            $reason = 'Menunggu verifikasi pembayaran manual oleh admin.';
        }

        $fullConditionNote = $reason . ($combinedAiNotes ? " Catatan AI: {$combinedAiNotes}" : '');

        foreach ($orderCollection as $ord) {
            $ord->payment_status = 'waiting_confirmation';
            $ord->payment_verified_by = null;
            if (!empty($refNumbersString)) {
                $ord->payment_ref_number = $refNumbersString;
            }
            $ocrData = [
                'summary' => count($allProofsCombined) === 1 ? ($allProofsCombined[0]['summary'] ?? 'single_proof_pending') : 'multi_proof_pending',
                'total_accumulated' => $accumulatedAmount,
                'total_expected' => $totalExpected,
                'valid_receipts_count' => count($validReceipts),
                'proofs' => $allProofsCombined,
            ];
            $ocrData['ai_note'] = $combinedAiNotes ?: ($allProofsCombined[0]['ai_note'] ?? null);
            $ocrData['condition_note'] = $fullConditionNote;
            $ord->payment_ocr_data = $ocrData;
            $ord->save();
        }

        return [
            'verified' => false,
            'message' => $fullConditionNote,
            'scan' => [
                'is_transfer_receipt' => !empty($validReceipts),
                'status' => 'PENDING',
                'amount' => $accumulatedAmount,
                'valid_receipts_count' => count($validReceipts),
                'ref_number' => $refNumbersString,
                'proofs' => $allProofsCombined,
                'ai_note' => $combinedAiNotes,
                'condition_note' => $fullConditionNote,
            ],
        ];
    }

    /**
     * Ekstrak seluruh riwayat bukti transfer (raw) yang tersimpan pada pesanan
     */
    protected function getExistingRawProofs(Collection $orderCollection): array
    {
        $firstOrder = $orderCollection->first();
        if (!$firstOrder || empty($firstOrder->payment_ocr_data)) {
            return [];
        }

        $ocrData = $firstOrder->payment_ocr_data;
        if (is_string($ocrData)) {
            $ocrData = json_decode($ocrData, true);
        }
        if (!is_array($ocrData)) {
            return [];
        }

        if (!empty($ocrData['proofs']) && is_array($ocrData['proofs'])) {
            return $ocrData['proofs'];
        }

        if (!empty($ocrData['is_transfer_receipt']) || isset($ocrData['amount']) || isset($ocrData['status'])) {
            return [$ocrData];
        }

        return [];
    }

    /**
     * Ekstrak riwayat bukti pembayaran VALID yang sudah tersimpan sebelumnya pada pesanan
     */
    protected function getExistingValidReceipts(Collection $orderCollection): array
    {
        $rawProofs = $this->getExistingRawProofs($orderCollection);
        $validExisting = [];

        foreach ($rawProofs as $proof) {
            if (!is_array($proof)) {
                continue;
            }
            $isReceipt = !empty($proof['is_transfer_receipt']);
            $isSuccess = ($proof['status'] ?? '') === 'SUCCESS';
            $amount = isset($proof['amount']) && is_numeric($proof['amount']) ? (float) $proof['amount'] : 0.0;

            if ($isReceipt && $isSuccess && $amount > 0) {
                $validExisting[] = $proof;
            }
        }

        return $validExisting;
    }

    /**
     * Dapatkan fingerprint unik dari struk untuk pencegahan duplikasi dalam satu pesanan
     */
    protected function getReceiptFingerprint(array $receipt, ?string $localPath = null): string
    {
        $ref = !empty($receipt['ref_number']) ? strtolower(trim($receipt['ref_number'])) : null;
        if ($ref && strlen($ref) >= 4) {
            return 'ref:' . $ref;
        }

        if ($localPath && file_exists($localPath)) {
            $fileMd5 = @md5_file($localPath);
            if ($fileMd5) {
                return 'fhash:' . $fileMd5;
            }
        }

        $bank = !empty($receipt['source_bank']) ? strtolower(trim($receipt['source_bank'])) : 'unknown';
        $amount = isset($receipt['amount']) && is_numeric($receipt['amount']) ? (float)$receipt['amount'] : 0.0;
        $date = !empty($receipt['date']) ? trim($receipt['date']) : '';
        $time = !empty($receipt['time']) ? trim($receipt['time']) : '';

        if ($amount > 0 && ($date || $time)) {
            return 'sig:' . "{$bank}_{$amount}_{$date}_{$time}";
        }

        if (!empty($receipt['file_path'])) {
            return 'path:' . md5($receipt['file_path']);
        }

        return 'id:' . uniqid();
    }

    /**
     * Gabungkan daftar bukti lama dan bukti baru tanpa duplikasi file_path
     */
    protected function mergeProofLists(array $existingProofs, array $newProofs): array
    {
        $combined = $existingProofs;
        $existingPaths = [];
        foreach ($existingProofs as $p) {
            if (!empty($p['file_path'])) {
                $existingPaths[$p['file_path']] = true;
            }
        }

        foreach ($newProofs as $newP) {
            $path = $newP['file_path'] ?? null;
            if ($path && isset($existingPaths[$path])) {
                // Perbarui entri yang ada jika file_path sama
                foreach ($combined as $k => $c) {
                    if (($c['file_path'] ?? null) === $path) {
                        $combined[$k] = array_merge($c, $newP);
                        break;
                    }
                }
            } else {
                $combined[] = $newP;
                if ($path) {
                    $existingPaths[$path] = true;
                }
            }
        }

        // Beri penomoran ulang file_index agar rapi
        foreach ($combined as $i => &$item) {
            $item['file_index'] = $i + 1;
        }
        unset($item);

        return $combined;
    }
}
