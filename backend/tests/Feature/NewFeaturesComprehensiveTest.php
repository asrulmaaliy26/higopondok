<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Domains\Auth\User;
use App\Domains\Auth\WalletTransaction;
use App\Domains\Admin\AdminExpense;
use App\Domains\Canteen\Canteen;
use App\Domains\Canteen\Product;
use App\Domains\Canteen\Order;
use App\Domains\Canteen\Services\WhatsAppNotificationService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class NewFeaturesComprehensiveTest extends TestCase
{
    use DatabaseTransactions;

    protected User $superAdmin;
    protected User $santri;
    protected User $kantinOwner;
    protected Canteen $canteen;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');

        $this->superAdmin = User::firstOrCreate(
            ['email' => 'superadmin_test_suite@higopondok.id'],
            ['name' => 'Super Admin Suite', 'password' => bcrypt('password'), 'phone' => '081111111111']
        );
        $this->superAdmin->syncRoles(['super_admin']);

        $this->santri = User::firstOrCreate(
            ['email' => 'santri_test_suite@higopondok.id'],
            [
                'name' => 'Wali Santri Test',
                'password' => bcrypt('password'),
                'phone' => '081234567890',
                'santri_name' => 'Ahmad Test',
                'santri_room' => 'Asmah/G1',
                'santri_class' => '7A',
                'santri_level' => 'SMP',
                'balance' => 0,
                'santri_daily_limit' => 0,
                'santri_dietary_notes' => null,
            ]
        );
        $this->santri->update([
            'balance' => 0,
            'santri_daily_limit' => 0,
            'santri_dietary_notes' => null,
        ]);
        $this->santri->syncRoles(['user']);

        $this->kantinOwner = User::firstOrCreate(
            ['email' => 'kantin_test_suite@higopondok.id'],
            ['name' => 'Owner Kantin Test', 'password' => bcrypt('password'), 'phone' => '081999999999']
        );
        $this->kantinOwner->syncRoles(['kantin']);

        $this->canteen = Canteen::firstOrCreate(
            ['user_id' => $this->kantinOwner->id],
            [
                'name' => 'Kantin Test Suite',
                'status' => 'approved',
                'is_open' => true,
                'open_time' => '00:00:00',
                'close_time' => '23:59:59',
                'closed_days' => [],
                'delivery_fee' => 3000,
                'admin_fee' => 2000,
                'category' => 'pondok',
            ]
        );
        $this->canteen->update([
            'status' => 'approved',
            'open_time' => '00:00:00',
            'close_time' => '23:59:59',
            'closed_days' => [],
            'force_closed' => false,
        ]);

        $this->product = Product::create([
            'canteen_id' => $this->canteen->id,
            'name' => 'Nasi Goreng Test',
            'price' => 15000,
            'hpp' => 10000,
            'stock' => 50,
            'is_available' => true,
            'category' => 'Makanan',
        ]);
    }

    public function test_santri_preferences_dietary_notes_and_daily_limit_can_be_updated(): void
    {
        $res = $this->actingAs($this->santri)->putJson('/api/me', [
            'santri_dietary_notes' => 'Alergi kacang dan jangan pakai es',
            'santri_daily_limit' => 30000,
        ]);

        $res->assertStatus(200);
        $this->santri->refresh();
        $this->assertEquals('Alergi kacang dan jangan pakai es', $this->santri->santri_dietary_notes);
        $this->assertEquals(30000.0, (float) $this->santri->santri_daily_limit);
    }

    public function test_wallet_topup_request_and_admin_approve_and_reject_flow(): void
    {
        // 1. Wali submits topup request
        $proof = UploadedFile::fake()->image('bukti_tf.jpg');
        $res = $this->actingAs($this->santri)->post('/api/wallet/topup', [
            'amount' => 100000,
            'proof_image' => $proof,
            'notes' => 'TF BCA Wali',
        ], ['Accept' => 'application/json']);

        $res->assertStatus(201);
        $txId = $res->json('transaction.id');
        $this->assertNotNull($txId);
        $this->assertEquals('pending', $res->json('transaction.status'));

        // 2. Admin lists pending topups
        $listRes = $this->actingAs($this->superAdmin)->getJson('/api/admin/wallet/topups?status=pending');
        $listRes->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, $listRes->json('pending_count'));

        // 3. Admin approves topup
        $approveRes = $this->actingAs($this->superAdmin)->postJson("/api/admin/wallet/topups/{$txId}/approve");
        $approveRes->assertStatus(200)
            ->assertJsonPath('transaction.status', 'completed');

        $this->santri->refresh();
        $this->assertEquals(100000.0, (float) $this->santri->balance);

        // 4. Reject flow test
        $res2 = $this->actingAs($this->santri)->post('/api/wallet/topup', [
            'amount' => 50000,
            'proof_image' => UploadedFile::fake()->image('blur.jpg'),
        ], ['Accept' => 'application/json']);
        $tx2Id = $res2->json('transaction.id');

        $rejectRes = $this->actingAs($this->superAdmin)->postJson("/api/admin/wallet/topups/{$tx2Id}/reject", [
            'admin_notes' => 'Foto buram',
        ]);
        $rejectRes->assertStatus(200)
            ->assertJsonPath('transaction.status', 'rejected');

        $this->santri->refresh();
        $this->assertEquals(100000.0, (float) $this->santri->balance);
    }

    public function test_checkout_with_wallet_and_daily_limit_enforcement(): void
    {
        $this->santri->update([
            'balance' => 100000,
            'santri_daily_limit' => 25000, // Product 15k + fees (~5k) = 20k (passes); 2x = 30k + fees (blocked)
        ]);

        // 1. Order exceeding daily limit should be blocked
        $failRes = $this->actingAs($this->santri)->postJson('/api/orders/batch', [
            'payment_method' => 'wallet',
            'canteens' => [
                [
                    'canteen_id' => $this->canteen->id,
                    'items' => [
                        ['product_id' => $this->product->id, 'quantity' => 2],
                    ],
                ],
            ],
        ]);
        $failRes->assertStatus(400);
        $this->assertStringContainsString('batas jajan harian', strtolower($failRes->json('error')));

        // 2. Order within daily limit using wallet succeeds & marks paid immediately
        $okRes = $this->actingAs($this->santri)->postJson('/api/orders/batch', [
            'payment_method' => 'wallet',
            'canteens' => [
                [
                    'canteen_id' => $this->canteen->id,
                    'items' => [
                        ['product_id' => $this->product->id, 'quantity' => 1],
                    ],
                ],
            ],
        ]);
        $okRes->assertStatus(201);
        $grandTotal = (float) $okRes->json('grand_total');
        $this->assertEquals('paid', $okRes->json('orders.0.payment_status'));

        $this->santri->refresh();
        $this->assertEquals(100000.0 - $grandTotal, (float) $this->santri->balance);
        $this->assertDatabaseHas('wallet_transactions', [
            'user_id' => $this->santri->id,
            'type' => 'payment',
            'amount' => $grandTotal,
            'status' => 'completed',
        ]);
    }

    public function test_pay_existing_checkout_with_wallet(): void
    {
        $this->santri->update(['balance' => 80000, 'santri_daily_limit' => 0]);

        $checkoutRes = $this->actingAs($this->santri)->postJson('/api/orders/batch', [
            'payment_method' => 'manual',
            'canteens' => [
                [
                    'canteen_id' => $this->canteen->id,
                    'items' => [
                        ['product_id' => $this->product->id, 'quantity' => 1],
                    ],
                ],
            ],
        ]);
        $checkoutRes->assertStatus(201);
        $checkoutId = $checkoutRes->json('checkout_id');
        $grandTotal = (float) $checkoutRes->json('grand_total');
        $this->assertEquals('unpaid', $checkoutRes->json('orders.0.payment_status'));

        $payRes = $this->actingAs($this->santri)->postJson("/api/orders/checkout/{$checkoutId}/pay-wallet");
        $payRes->assertStatus(200);
        $this->assertEquals(80000.0 - $grandTotal, (float) $payRes->json('balance'));
    }

    public function test_admin_finance_payroll_recap_70_15_5_10_and_expenses_deduction(): void
    {
        $today = now('Asia/Jakarta')->toDateString();

        // Create a completed order today with known profit (HPJ 30000 - HPP 20000 = 10000 profit, admin_fee 2000)
        $order = Order::create([
            'user_id' => $this->santri->id,
            'canteen_id' => $this->canteen->id,
            'status' => 'completed',
            'payment_status' => 'paid',
            'total_price' => 35000,
            'delivery_fee' => 3000,
            'admin_fee' => 2000,
            'delivery_location' => 'Asmah/G1',
        ]);
        $order->items()->create([
            'product_id' => $this->product->id,
            'quantity' => 2,
            'price' => 15000,
            'subtotal' => 30000,
        ]);

        // Create an expense today (Rp 500)
        AdminExpense::create([
            'admin_id' => $this->superAdmin->id,
            'expense_date' => $today,
            'title' => 'Kertas Struk Test',
            'category' => 'perlengkapan',
            'amount' => 500,
            'payment_method' => 'cash',
        ]);

        $res = $this->actingAs($this->superAdmin)->getJson("/api/admin/finance/summary?period=day&start_date={$today}&end_date={$today}");
        $res->assertStatus(200);

        $payrollSummary = $res->json('payroll_recap.summary');
        $dailyList = $res->json('payroll_recap.daily_list');

        $this->assertNotEmpty($dailyList);
        $totalProfit = (float) $payrollSummary['total_profit'];
        $this->assertGreaterThanOrEqual(10000, $totalProfit);
        $this->assertEquals(round($totalProfit * 0.70), (float) $payrollSummary['total_asrul']);
        $this->assertEquals(round($totalProfit * 0.15), (float) $payrollSummary['total_anma']);
        $this->assertEquals(round($totalProfit * 0.05), (float) $payrollSummary['total_qori']);
        $this->assertEquals(round($totalProfit * 0.10), (float) $payrollSummary['total_satpam']);
        $this->assertEquals(
            (float) $payrollSummary['total_admin_net'] - (float) $payrollSummary['total_expenses'],
            (float) $payrollSummary['total_admin_balance']
        );
    }

    public function test_whatsapp_notification_service_phone_formatting(): void
    {
        $this->assertEquals('628123456789', WhatsAppNotificationService::formatPhone('0812-3456-789'));
        $this->assertEquals('628123456789', WhatsAppNotificationService::formatPhone('8123456789'));
        $this->assertEquals('628123456789', WhatsAppNotificationService::formatPhone('+62 812 3456 789'));
        $this->assertNull(WhatsAppNotificationService::formatPhone(''));
    }
}
