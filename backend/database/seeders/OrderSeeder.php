<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Domains\Auth\User;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\OrderItem;
use Illuminate\Support\Facades\DB;

class OrderSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Ambil 3 user santri / wali yang ada
        $users = User::whereIn('id', [11, 12, 13])->get();
        if ($users->count() < 3) {
            $users = User::whereDoesntHave('roles', function($q) {
                $q->whereIn('name', ['admin', 'kantin']);
            })->take(3)->get();
        }

        if ($users->isEmpty()) {
            $this->command->error("User tidak ditemukan.");
            return;
        }

        // 2. Ambil toko/kantin yang sudah ada di database beserta produk resminya
        $canteens = Canteen::with('products')->get();
        if ($canteens->isEmpty()) {
            $this->command->error("Toko / Kantin tidak ditemukan.");
            return;
        }

        $sampleNotes = [
            "Pedas level 2, es batu sedikit",
            "Jangan pakai bawang goreng",
            "Minta kuah dipisah",
            "Bungkus plastik double",
            "Pedas manis, jangan terlalu asin",
            "Es jeruk manis, es dikit aja",
            "Tanpa saus sambal",
            "Tolong beri sendok dan garpu 2 pasang",
            "Saus dipisah ya kak",
            "Level 3 ekstra pedas",
        ];

        $sampleCustomNotes = [
            "Tolong diantarkan sebelum jam istirahat santri.",
            "Titipkan di pos satpam depan asrama jika saya sedang sholat.",
            "Mohon konfirmasi via WA jika ada kendala pengiriman.",
            "Titip di kamar santri Al-Majid R.04 ya kak.",
            "Diproses segera ya, santri sudah menunggu.",
            "Terima kasih kurir & kantin!"
        ];

        $locations = [
            "Asrama Al Majid R.01",
            "Asrama Sunan Giri R.04",
            "Gedung B Kamar 12",
            "Asrama Putri Khadijah R.02",
            "Kompleks Santri C-05"
        ];

        $statuses = ['pending', 'processing', 'completed'];

        $courier = User::where('name', 'like', '%kurir1%')->first() ?: User::whereHas('roles', fn($q) => $q->where('name', 'kurir'))->first();
        $courierId = $courier ? $courier->id : null;

        DB::beginTransaction();
        try {
            $totalOrdersCount = 0;
            $totalItemsCount = 0;

            // Setiap user memesan 2 pesanan di SETIAP kantin/toko
            foreach ($canteens as $canteen) {
                $canteenProducts = $canteen->products->values();
                if ($canteenProducts->isEmpty()) {
                    continue;
                }

                $cfg = Order::getPricingConfig();
                $isKota = strtolower($canteen->category ?? 'kauman') === 'kota';
                $baseDeliveryFee = $isKota ? $cfg['base_delivery_fee'] : 2000;
                $adminFee = $isKota ? $cfg['base_admin_fee'] : 1000;

                foreach ($users as $user) {
                    for ($orderNum = 1; $orderNum <= 2; $orderNum++) {
                        $orderDate = now()->subMinutes(rand(5, 120));
                        $dateFolder = $this->getIndonesianDateFolder($orderDate);
                        $userName = strtolower(str_replace(' ', '_', $user->santri_name ?: $user->name));
                        $userName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $userName) ?: 'user';

                        // Buat pesanan baru
                        $order = Order::create([
                            'checkout_id' => 'CHK-' . $orderDate->format('Ymd') . '-' . strtoupper(\Illuminate\Support\Str::random(6)),
                            'user_id' => $user->id,
                            'canteen_id' => $canteen->id,
                            'courier_id' => $courierId,
                            'is_custom' => false,
                            'custom_notes' => $sampleCustomNotes[array_rand($sampleCustomNotes)],
                            'status' => $orderNum === 1 ? 'pending' : 'processing',
                            'payment_status' => ($orderNum === 1) ? 'paid' : 'unpaid',
                            'proof_of_payment' => $orderNum === 1 ? ["{$dateFolder}/{$userName}/proof/sample_payment.jpg"] : null,
                            'proof_of_purchase' => $orderNum === 2 ? ["{$dateFolder}/{$userName}/proff_kantin/sample_struk.jpg"] : null,
                            'proof_of_delivery' => $orderNum === 2 ? ["{$dateFolder}/{$userName}/proff_delivery/sample_delivery.jpg"] : null,
                            'total_price' => 0,
                            'admin_fee' => $adminFee,
                            'delivery_fee' => $baseDeliveryFee,
                            'delivery_location' => $user->santri_room ?: $locations[array_rand($locations)],
                            'created_at' => $orderDate,
                        ]);

                        $totalItemsQty = 0;
                        $subtotalItems = 0;

                        // Tarik 4 item produk asli milik toko ini
                        for ($i = 0; $i < 4; $i++) {
                            // Ambil produk asli dari toko ini secara acak
                            $product = $canteenProducts[$i % $canteenProducts->count()];
                            
                            $quantity = rand(1, 3);
                            $price = $product->discount_price ?: $product->price;
                            $itemSubtotal = $price * $quantity;

                            OrderItem::create([
                                'order_id' => $order->id,
                                'product_id' => $product->id,
                                'quantity' => $quantity,
                                'price' => $price,
                                'subtotal' => $itemSubtotal,
                                'notes' => $sampleNotes[array_rand($sampleNotes)],
                                'created_at' => $order->created_at,
                            ]);

                            $subtotalItems += $itemSubtotal;
                            $totalItemsQty += $quantity;
                            $totalItemsCount++;
                        }

                        // Hitung ongkir & admin terpusat via model Order
                        $fees = Order::calculateOrderFees($totalItemsQty);
                        $finalDeliveryFee = $fees['delivery_fee'];
                        $finalAdminFee = $fees['admin_fee'];
                        $grandTotal = $subtotalItems + $finalDeliveryFee + $finalAdminFee;

                        $order->update([
                            'total_price' => $grandTotal,
                            'delivery_fee' => $finalDeliveryFee,
                            'admin_fee' => $finalAdminFee,
                        ]);

                        $totalOrdersCount++;
                    }
                }
            }

            DB::commit();
            $this->command->info("Berhasil membuat {$totalOrdersCount} pesanan dengan total {$totalItemsCount} produk asli toko untuk 3 user!");

        } catch (\Exception $e) {
            DB::rollBack();
            $this->command->error("Gagal menjalankan OrderSeeder: " . $e->getMessage());
        }
    }

    /**
     * Dapatkan nama folder hari dan tanggal bahasa Indonesia.
     * Contoh: senin18Januari2025
     */
    private function getIndonesianDateFolder($date = null): string
    {
        $carbon = $date ? \Carbon\Carbon::parse($date)->setTimezone('Asia/Jakarta') : \Carbon\Carbon::now('Asia/Jakarta');
        $days = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
        $months = [
            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
            5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
            9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
        ];

        $dayName = $days[$carbon->dayOfWeek];
        $dayNum = $carbon->day;
        $monthName = $months[$carbon->month];
        $year = $carbon->year;

        return "{$dayName}{$dayNum}{$monthName}{$year}";
    }
}
