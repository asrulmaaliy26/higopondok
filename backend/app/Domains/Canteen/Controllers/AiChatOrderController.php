<?php

namespace App\Domains\Canteen\Controllers;

use App\Http\Controllers\Controller;
use App\Domains\Auth\User;
use App\Domains\Canteen\AiChatLog;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\OrderItem;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Services\AiSmartOrderingService;
use App\Domains\Canteen\Services\CustomOrderParserService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AiChatOrderController extends Controller
{
    protected AiSmartOrderingService $aiService;

    public function __construct(AiSmartOrderingService $aiService)
    {
        $this->aiService = $aiService;
    }

    /**
     * Cari data santri dari database untuk autocomplete & validasi penerima
     */
    public function searchSantri(Request $request)
    {
        $query = trim($request->query('query', $request->query('q', '')));

        $santriQuery = User::query()
            ->where(function ($q) {
                $q->where(function ($sub) {
                    $sub->whereNotNull('santri_name')
                        ->where('santri_name', '!=', '');
                })->orWhereHas('roles', function ($rq) {
                    $rq->where('name', 'user');
                });
            });

        if (!empty($query)) {
            $santriQuery->where(function ($q) use ($query) {
                $q->where('santri_name', 'LIKE', "%{$query}%")
                  ->orWhere('name', 'LIKE', "%{$query}%")
                  ->orWhere('santri_room', 'LIKE', "%{$query}%");
            });
        }

        $santriList = $santriQuery->select([
                'id',
                'name',
                'santri_name',
                'santri_room',
                'santri_class',
                'santri_level',
                'phone'
            ])
            ->orderByRaw("CASE WHEN santri_name IS NOT NULL AND santri_name != '' THEN 0 ELSE 1 END")
            ->orderBy('santri_name', 'asc')
            ->take(20)
            ->get()
            ->map(function ($s) {
                return [
                    'id' => $s->id,
                    'name' => $s->name,
                    'santri_name' => $s->santri_name ?: $s->name,
                    'santri_room' => $s->santri_room ?: 'Kamar Santri',
                    'santri_class' => $s->santri_class ?: '-',
                    'santri_level' => $s->santri_level ?: 'Santri',
                    'phone' => $s->phone,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $santriList
        ]);
    }

    /**
     * Kirim pesan ke Asisten AI untuk analisis dan draf pesanan
     */
    public function chat(Request $request)
    {
        $request->validate([
            'message' => 'required|string|max:1000',
            'history' => 'nullable|array',
        ]);

        $user = $request->user();
        $history = $request->input('history', []);
        $rawMessage = $request->message;
        $result = $this->aiService->processUserChat($rawMessage, $user, $history);

        // Rekam percakapan santri untuk Continuous Learning Dataset (Aman & Kilat < 0.5ms)
        try {
            $intent = 'conversation';
            if (!empty($result['is_order_ready'])) {
                $intent = !empty($result['is_custom']) ? 'titip_beli' : 'order';
            } elseif (!empty($result['is_help_intent'])) {
                $intent = 'help_admin';
            } elseif (!empty($result['is_check_order'])) {
                $intent = 'check_order';
            } elseif (str_contains(strtolower($rawMessage), 'harga') || str_contains(strtolower($rawMessage), 'berapa')) {
                $intent = 'price_inquiry';
            } elseif (str_contains(strtolower($rawMessage), 'ongkir')) {
                $intent = 'delivery_fee';
            } elseif (str_contains(strtolower($rawMessage), 'rekomendasi') || str_contains(strtolower($rawMessage), 'menu')) {
                $intent = 'menu_explore';
            }

            AiChatLog::create([
                'user_id' => $user?->id,
                'session_id' => $request->header('X-Session-ID') ?: null,
                'raw_message' => $rawMessage,
                'normalized_message' => $result['normalized_message'] ?? null,
                'model_used' => $result['engine_used'] ?? 'local_nlp',
                'intent' => $intent,
                'is_order_ready' => !empty($result['is_order_ready']),
                'ai_response_text' => $result['reply_text'] ?? null,
                'extracted_data' => [
                    'recipient_name' => $result['recipient_name'] ?? null,
                    'recipient_room' => $result['recipient_room'] ?? null,
                    'delivery_location' => $result['delivery_location'] ?? null,
                    'canteens' => $result['canteens'] ?? [],
                    'summary' => $result['summary'] ?? [],
                    'quick_replies' => $result['quick_replies'] ?? [],
                    'custom_items' => $result['custom_items'] ?? [],
                ],
                'ip_address' => $request->ip(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('[AiChatOrderController] Gagal menyimpan ai_chat_log: ' . $e->getMessage());
        }

        return response()->json(array_merge([
            'success' => true,
        ], $result));
    }

    /**
     * Ambil kontak WhatsApp resmi Admin HiGO dan Toko/Kantin untuk CS dan Bantuan Langsung
     */
    public function supportContacts(Request $request)
    {
        $canteenId = $request->query('canteen_id') ? (int) $request->query('canteen_id') : null;
        $canteenName = $request->query('canteen_name') ?: null;

        $contacts = $this->aiService->getSupportContacts($canteenId, $canteenName, $request->user());

        return response()->json([
            'success' => true,
            'data' => $contacts
        ]);
    }

    /**
     * Konfirmasi dan buat pesanan resmi langsung dari draf chat AI
     */
    public function confirm(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Silakan login terlebih dahulu'], 401);
        }

        $isCustom = (bool) $request->input('is_custom', false);
        $rawRecipientName = trim((string) ($request->input('recipient_name') ?: ($user->is_teacher ? $user->name : ($user->santri_name ?: $user->name))));
        $recipientRoom = $request->input('recipient_room') ?: ($request->input('delivery_location') ?: ($user->is_teacher ? ($user->teacher_unit ?: 'Kantor Guru') : ($user->santri_room ?: 'Kamar Santri')));
        $deliveryLocation = $request->input('delivery_location') ?: $recipientRoom;
        $recipientPhone = $request->input('recipient_phone') ?: ($user->phone ?: '08123456789');

        $matchedSantri = null;
        if (!$user->is_teacher) {
            // Validasi: Wajib cocok dengan data santri yang terdaftar di database
            $matchedSantri = User::where(function ($q) use ($rawRecipientName) {
                    $q->where('santri_name', $rawRecipientName)
                      ->orWhere('name', $rawRecipientName);
                })
                ->where(function ($q) {
                    $q->whereNotNull('santri_name')
                      ->orWhereHas('roles', fn($rq) => $rq->where('name', 'user'));
                })
                ->first();

            if (!$matchedSantri && !empty($rawRecipientName)) {
                // Coba pencarian fleksibel LIKE
                $matchedSantri = User::where(function ($q) use ($rawRecipientName) {
                        $q->where('santri_name', 'LIKE', "%{$rawRecipientName}%")
                          ->orWhere('name', 'LIKE', "%{$rawRecipientName}%");
                    })
                    ->where(function ($q) {
                        $q->whereNotNull('santri_name')
                          ->orWhereHas('roles', fn($rq) => $rq->where('name', 'user'));
                    })
                    ->first();
            }

            if (!$matchedSantri) {
                return response()->json([
                    'message' => "Nama penerima '{$rawRecipientName}' tidak ditemukan dalam data santri pondok. Silakan cari dan pilih santri yang terdaftar.",
                    'error_code' => 'SANTRI_NOT_FOUND'
                ], 422);
            }

            // Gunakan data santri resmi dari database
            $recipientName = $matchedSantri->santri_name ?: $matchedSantri->name;
            $recipientRoom = $request->input('recipient_room') ?: ($request->input('delivery_location') ?: ($matchedSantri->santri_room ?: $recipientRoom));
            $deliveryLocation = $request->input('delivery_location') ?: $recipientRoom;
            $recipientPhone = $matchedSantri->phone ?: $recipientPhone;
            $recipientClass = $matchedSantri->santri_class ?: $user->santri_class;
            $recipientLevel = $matchedSantri->santri_level ?: $user->santri_level;
        } else {
            $recipientName = $rawRecipientName;
            $recipientClass = null;
            $recipientLevel = null;
        }

        DB::beginTransaction();
        try {
            $checkoutId = 'CHK-' . date('Ymd') . '-' . strtoupper(Str::random(6));
            $createdOrderIds = [];

            if ($isCustom) {
                // PESANAN KHUSUS / TITIP BELI
                $canteenId = $request->input('canteens.0.canteen_id') ?: Canteen::first()->id;
                $customNotes = $request->input('custom_notes') ?: $request->input('message');

                $parser = app(CustomOrderParserService::class);
                $customItems = $request->input('custom_items') ?: $parser->parseNotes($customNotes);

                $order = Order::create([
                    'checkout_id' => $checkoutId,
                    'user_id' => $user->id,
                    'canteen_id' => $canteenId,
                    'is_custom' => true,
                    'custom_notes' => $customNotes,
                    'custom_items' => $customItems,
                    'status' => 'pending',
                    'payment_status' => 'unpaid',
                    'total_price' => 0,
                    'delivery_fee' => Order::CUSTOM_DELIVERY_FEE, // 3500
                    'admin_fee' => Order::CUSTOM_ADMIN_FEE,       // 2500
                    'delivery_location' => $deliveryLocation,
                    'order_for' => $user->is_teacher ? 'guru' : 'santri',
                    'is_priority' => (bool) $user->is_teacher,
                    'recipient_santri_name' => $recipientName,
                    'recipient_santri_room' => $recipientRoom,
                    'recipient_santri_class' => $recipientClass,
                    'recipient_santri_level' => $recipientLevel,
                    'recipient_phone' => $recipientPhone,
                ]);

                $createdOrderIds[] = $order->id;
            } else {
                // PESANAN KATALOG REGULER
                $canteens = $request->input('canteens', []);
                if (empty($canteens)) {
                    throw new \Exception('Tidak ada produk yang dipilih dalam pesanan.');
                }

                foreach ($canteens as $cData) {
                    $canteen = Canteen::findOrFail($cData['canteen_id']);
                    $items = $cData['items'] ?? [];
                    if (empty($items)) {
                        continue;
                    }

                    $totalQty = collect($items)->sum('quantity');
                    $today = now('Asia/Jakarta')->format('Y-m-d');
                    $userIndex = Order::getUserDailyIndex($user->id, $canteen->id, $today);
                    $fees = Order::calculateUserRankedFees($totalQty, $userIndex, $canteen);

                    $order = Order::create([
                        'checkout_id' => $checkoutId,
                        'user_id' => $user->id,
                        'canteen_id' => $canteen->id,
                        'is_custom' => false,
                        'custom_notes' => null,
                        'status' => 'pending',
                        'payment_status' => 'unpaid',
                        'total_price' => 0,
                        'delivery_fee' => $fees['delivery_fee'],
                        'admin_fee' => $fees['admin_fee'],
                        'delivery_location' => $deliveryLocation,
                        'order_for' => $user->is_teacher ? 'guru' : 'santri',
                        'is_priority' => (bool) $user->is_teacher,
                        'recipient_santri_name' => $recipientName,
                        'recipient_santri_room' => $recipientRoom,
                        'recipient_santri_class' => $recipientClass,
                        'recipient_santri_level' => $recipientLevel,
                        'recipient_phone' => $recipientPhone,
                    ]);

                    $subtotal = 0;
                    foreach ($items as $it) {
                        $product = Product::findOrFail($it['product_id']);
                        $price = (float) ($product->discount_price ?: $product->price);
                        $itemSubtotal = $price * (int) $it['quantity'];

                        OrderItem::create([
                            'order_id' => $order->id,
                            'product_id' => $product->id,
                            'quantity' => $it['quantity'],
                            'price' => $price,
                            'subtotal' => $itemSubtotal,
                            'hpp' => $product->hpp ?: ($price > 1000 ? $price - 1000 : $price),
                            'notes' => $it['notes'] ?? null,
                        ]);

                        $subtotal += $itemSubtotal;
                    }

                    $order->update([
                        'total_price' => $subtotal + $fees['delivery_fee'] + $fees['admin_fee'],
                    ]);

                    $createdOrderIds[] = $order->id;
                }
            }

            DB::commit();

            // Tandai chat log santri terakhir berhasil dikonversi menjadi pesanan nyata
            if ($user && !empty($createdOrderIds)) {
                try {
                    AiChatLog::where('user_id', $user->id)
                        ->where('is_converted', false)
                        ->latest()
                        ->first()
                        ?->update([
                            'is_converted' => true,
                            'order_id' => $createdOrderIds[0] ?? null,
                        ]);
                } catch (\Throwable $e) {
                    Log::warning('[AiChatOrderController] Gagal mengupdate konversi ai_chat_log: ' . $e->getMessage());
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Pesanan berhasil dibuat otomatis oleh Asisten AI!',
                'checkout_id' => $checkoutId,
                'order_ids' => $createdOrderIds,
            ], 200);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('[AiChatOrderController] Gagal membuat pesanan via AI: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Gagal membuat pesanan: ' . $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Ambil data log percakapan santri untuk evaluasi dan peningkatan akurasi AI (Admin / Kantin)
     */
    public function getLogs(Request $request)
    {
        $query = AiChatLog::with(['user:id,name,santri_name', 'order:id,status,total_price'])
            ->latest();

        if ($request->has('intent')) {
            $query->where('intent', $request->query('intent'));
        }

        if ($request->has('is_converted')) {
            $query->where('is_converted', filter_var($request->query('is_converted'), FILTER_VALIDATE_BOOLEAN));
        }

        $logs = $query->paginate(20);

        $stats = [
            'total_chats' => AiChatLog::count(),
            'total_order_ready' => AiChatLog::where('is_order_ready', true)->count(),
            'total_converted' => AiChatLog::where('is_converted', true)->count(),
            'conversion_rate' => AiChatLog::count() > 0 
                ? round((AiChatLog::where('is_converted', true)->count() / AiChatLog::count()) * 100, 1) . '%' 
                : '0%',
        ];

        return response()->json([
            'success' => true,
            'stats' => $stats,
            'data' => $logs,
        ]);
    }

    /**
     * Export data log chat menjadi format dataset JSONL untuk Fine-Tuning Model Gemini / Vertex AI
     */
    public function exportTrainingData(Request $request)
    {
        $logs = AiChatLog::where('is_order_ready', true)
            ->whereNotNull('ai_response_text')
            ->latest()
            ->take(500)
            ->get();

        $lines = [];
        foreach ($logs as $log) {
            $lines[] = json_encode([
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => $log->raw_message,
                    ],
                    [
                        'role' => 'model',
                        'content' => json_encode($log->extracted_data, JSON_UNESCAPED_UNICODE),
                    ]
                ]
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }

        $content = implode("\n", $lines);

        return response($content, 200, [
            'Content-Type' => 'application/x-jsonlines',
            'Content-Disposition' => 'attachment; filename="higo_ai_training_dataset_' . date('Ymd_His') . '.jsonl"',
        ]);
    }
}
