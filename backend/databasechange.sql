-- 1. Tambahkan kolom santri terlebih dahulu
ALTER TABLE users 
ADD santri_name VARCHAR(255) NULL AFTER password,
ADD santri_room VARCHAR(255) NULL AFTER santri_name,
ADD santri_class VARCHAR(255) NULL AFTER santri_room,
ADD santri_level VARCHAR(255) NULL AFTER santri_class;

-- 2. UPDATE/FORMAT ULANG DATA LAMA MENJADI JSON TERLEBIH DAHULU (PENTING!)
-- Menggunakan JSON_ARRAY agar otomatis lolos validasi strict JSON
UPDATE orders 
SET proof_of_delivery = JSON_ARRAY(proof_of_delivery)
WHERE proof_of_delivery IS NOT NULL AND JSON_VALID(proof_of_delivery) = 0;

-- 3. SETELAH DATANYA BERFORMAT ARRAY JSON VALID, BARU UBAH TIPE KOLOMNYA
ALTER TABLE orders 
MODIFY proof_of_delivery JSON NULL;

-- 4. Tambahkan kolom JSON yang baru
ALTER TABLE orders 
ADD proof_of_payment JSON NULL AFTER proof_of_delivery;

-- 5. Tambahkan kolom Soft Deletes (deleted_at) untuk fitur Kotak Sampah / Recycle Bin
ALTER TABLE orders 
ADD deleted_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at;
