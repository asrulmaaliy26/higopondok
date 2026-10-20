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
     * Mendukung multi-gambar bukti transfer (akumulasi cicilan bayar atau filter foto valid)
     *
     * @param Order|Collection $orders
     * @param string|array $imagePaths
     * @param array $localScanPaths Optional local file paths for zero-latency direct AI scanning (Option 1)
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

        if (empty($paths)) {
            return [
                'verified' => false,
                'message' => 'Tidak ada file gambar yang diberikan.',
                'scan' => null,
            ];
        }

        // Hitung total tagihan yang harus dibayar
        $totalExpected = 0.0;
        foreach ($orderCollection as $order) {
            $totalExpected += (float) $order->total_price;
        }

        $orderIds = $orderCollection->pluck('id')->toArray();
        $checkoutIds = $orderCollection->pluck('checkout_id')->filter()->unique()->toArray();

        $scannedResults = [];
        $validReceipts = [];
        $accumulatedAmount = 0.0;
        $usedRefNumbers = [];
        $hasDuplicateFraud = false;
        $duplicateRefName = null;

        // Pindai setiap gambar yang diunggah
        foreach ($paths as $idx => $path) {
            // Opsi 1: Prioritaskan path file lokal sementara jika ada dan valid
            $scanTarget = (!empty($localScanPaths[$idx]) && file_exists($localScanPaths[$idx]))
                ? $localScanPaths[$idx]
                : $path;

            $scan = $this->scanReceipt($scanTarget);
            $scan['file_path'] = $path; // Tetap simpan path resmi/URL drive untuk database & frontend
            $scan['file_index'] = $idx + 1;
            $scannedResults[] = $scan;

            $isReceipt = !empty($scan['is_transfer_receipt']);
            $isSuccess = ($scan['status'] ?? '') === 'SUCCESS';
            $detectedAmount = isset($scan['amount']) && is_numeric($scan['amount']) ? (float) $scan['amount'] : 0.0;
            $refNumber = !empty($scan['ref_number']) ? trim($scan['ref_number']) : null;

            if ($isReceipt && $isSuccess) {
                // Anti-fraud check: Cek apakah nomor referensi ini sudah pernah dipakai oleh pesanan lain yang lunas
                if ($refNumber && strlen($refNumber) >= 6) {
                    $duplicateQuery = Order::where('payment_status', 'paid')
                        ->where('payment_ref_number', 'like', "%{$refNumber}%")
                        ->whereNotIn('id', $orderIds);

                    if (!empty($checkoutIds)) {
                        $duplicateQuery->whereNotIn('checkout_id', $checkoutIds);
                    }

                    if ($duplicateQuery->exists() || in_array($refNumber, $usedRefNumbers)) {
                        $hasDuplicateFraud = true;
                        $duplicateRefName = $refNumber;
                        Log::warning("[ReceiptScanner] Fraud terdeteksi: No Referensi {$refNumber} sudah pernah digunakan!");
                        continue;
                    }

                    $usedRefNumbers[] = $refNumber;
                }

                $validReceipts[] = $scan;
                $accumulatedAmount += $detectedAmount;
            }
        }

        $now = now('Asia/Jakarta');

        // Syarat Auto-Verify Lunas:
        // 1. Ada minimal 1 bukti transfer valid
        // 2. Akumulasi nominal transfer >= Total Tagihan (toleransi rounding 50)
        // 3. Tidak ada deteksi penipuan nomor referensi duplikat
        $isAmountValid = !empty($validReceipts) && ($accumulatedAmount >= ($totalExpected - 50));

        $rawNotes = array_filter(array_map(fn($v) => $v['ai_note'] ?? null, $scannedResults));
        $combinedAiNotes = !empty($rawNotes) ? implode('; ', $rawNotes) : null;

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
                if ($ord->status === 'pending') {
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

                $ocrData = count($scannedResults) === 1 ? $scannedResults[0] : [
                    'summary' => 'multi_proof_verified',
                    'total_accumulated' => $accumulatedAmount,
                    'proofs' => $scannedResults,
                ];
                if ($overpaid > 0) {
                    $ocrData['overpaid_amount'] = $overpaid;
                }
                $ocrData['ai_note'] = $combinedAiNotes ?: ($scannedResults[0]['ai_note'] ?? null);
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
                'scan' => count($scannedResults) === 1 ? $scannedResults[0] : [
                    'is_transfer_receipt' => true,
                    'status' => 'SUCCESS',
                    'amount' => $accumulatedAmount,
                    'proofs' => $scannedResults,
                    'ai_note' => $combinedAiNotes,
                    'condition_note' => $conditionNote,
                ],
            ];
        }

        // JIKA TIDAK MEMENUHI SYARAT OTOMATIS:
        // Simpan hasil scan AI ke pesanan agar admin/toko bisa melihat catatan AI, namun status tetap 'waiting_confirmation'
        $reason = '';
        if ($hasDuplicateFraud) {
            $reason = "⚠️ PERHATIAN: Nomor referensi {$duplicateRefName} terdeteksi sudah pernah digunakan sebelumnya!";
        } elseif (empty($validReceipts)) {
            $reason = '⚠️ Gambar yang diunggah tidak terdeteksi sebagai struk transfer resmi.';
        } elseif (!$isAmountValid) {
            $fmtDetected = number_format($accumulatedAmount, 0, ',', '.');
            $fmtExpected = number_format($totalExpected, 0, ',', '.');
            $kurang = number_format($totalExpected - $accumulatedAmount, 0, ',', '.');
            $reason = "⚠️ KURANG BAYAR: Terbaca transfer Rp {$fmtDetected}, total tagihan Rp {$fmtExpected} (Kekurangan: Rp {$kurang}).";
        } else {
            $reason = 'Menunggu verifikasi pembayaran manual oleh admin.';
        }

        $fullConditionNote = $reason . ($combinedAiNotes ? " Catatan AI: {$combinedAiNotes}" : '');

        foreach ($orderCollection as $ord) {
            $ord->payment_status = 'waiting_confirmation';
            $ord->payment_verified_by = null;
            if (!empty($usedRefNumbers)) {
                $ord->payment_ref_number = implode(', ', array_unique($usedRefNumbers));
            }
            $ocrData = count($scannedResults) === 1 ? $scannedResults[0] : [
                'summary' => 'multi_proof_pending',
                'total_accumulated' => $accumulatedAmount,
                'proofs' => $scannedResults,
            ];
            $ocrData['ai_note'] = $combinedAiNotes ?: ($scannedResults[0]['ai_note'] ?? null);
            $ocrData['condition_note'] = $fullConditionNote;
            $ord->payment_ocr_data = $ocrData;
            $ord->save();
        }

        return [
            'verified' => false,
            'message' => $fullConditionNote,
            'scan' => count($scannedResults) === 1 ? $scannedResults[0] : [
                'is_transfer_receipt' => !empty($validReceipts),
                'status' => 'PENDING',
                'amount' => $accumulatedAmount,
                'proofs' => $scannedResults,
                'ai_note' => $combinedAiNotes,
                'condition_note' => $fullConditionNote,
            ],
        ];
    }
}
