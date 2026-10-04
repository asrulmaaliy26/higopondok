# Aturan Proyek Higo Pondok (Higo Pondok Guidelines)

## Arsitektur Backend (Laravel)
Proyek ini menggunakan **Domain-Driven Design (DDD)**, BUKAN arsitektur MVC standar Laravel. 
Saat Anda (AI) diminta untuk membuat fitur baru atau mengedit fitur lama, Anda WAJIB mematuhi struktur berikut:

1. **Lokasi File Utama**: 
   Semua fitur berada di dalam `app/Domains/[NamaFitur]/`. JANGAN menggunakan folder standar seperti `app/Models/` atau `app/Http/Controllers/` untuk entitas bisnis.

2. **Struktur Setiap Domain (Fitur)**:
   Setiap Domain harus memiliki struktur yang terisolasi, misalnya untuk domain `Announcement`:
   - `app/Domains/Announcement/Announcement.php` (Model Eloquent)
   - `app/Domains/Announcement/Controllers/AnnouncementController.php` (Controller)
   - `app/Domains/Announcement/Requests/StoreAnnouncementRequest.php` (Form Request)
   - `app/Domains/Announcement/Routes/api.php` (Route spesifik)

3. **Aturan Model (Eloquent)**:
   - WAJIB mendefinisikan relasi (seperti `belongsTo`, `hasMany`) dengan eksplisit.
   - WAJIB menggunakan fungsi `casts()` untuk tipe data spesifik (`float`, `boolean`, `integer`).
   - SANGAT DISARANKAN menggunakan *Local Scopes* (contoh: `scopeApproved($query)`) jika ada filter data standar.

4. **Aturan Controller & Respons API**:
   - Controller TIDAK BOLEH memuat logika validasi `Request::validate()`. Semua validasi WAJIB dipindahkan ke `FormRequest`.
   - Gunakan pendekatan Eloquent Relational. (Misal: `$request->user()->canteen()->first()` daripada `Canteen::where('user_id', ...)`).
   - Selalu kembalikan respons menggunakan **API Resources** (`JsonResource`), BUKAN mengirim model secara langsung (untuk stabilitas struktur JSON).
   - Jika mengembalikan banyak data, wajib gunakan *Pagination* (`paginate(10)`).
   - Wajib menggunakan `DB::transaction()` untuk aksi kompleks yang memanipulasi lebih dari 1 tabel, guna mencegah data korup jika terjadi kegagalan.

5. **Aturan Routing**:
   - Jangan menambahkan route bisnis secara massal di `routes/api.php` utama.
   - Buatkan file `Routes/api.php` di dalam masing-masing folder Domain, lalu *include* atau daftarkan route tersebut jika diperlukan.
   - Panggilan dari frontend yang memanfaatkan peran user (Role) atau impersonasi harus menyertakan middleware yang sesuai (`auth:sanctum` & `impersonate`).

6. **Manajemen Path Penyimpanan (Storage Management)**:
   - Setiap aset yang diunggah oleh pengguna (misal: gambar produk, foto profil) WAJIB disimpan dalam folder dinamis berdasarkan peran dan nama pengguna agar tidak tumpang tindih dan mudah dilacak.
   - Format path harus berupa: `{role}_{nama_pengguna}` (seluruh spasi diganti *underscore* dan huruf kecil). Contoh: `kantin_budi_santoso/gambar.jpg`. Jika role lebih dari satu, pisahkan dengan underscore (contoh: `admin_kantin_budi`).
   - Wajib menghapus file fisik lama menggunakan `Storage::disk('public')->delete()` setiap kali ada proses `update` (penggantian file) atau `delete` data, guna mencegah memori server membengkak (*orphaned files*).

7. **Keamanan & Otorisasi Kepemilikan Data (Authorization)**:
   - Wajib memastikan bahwa pengguna hanya bisa mengubah atau menghapus data miliknya sendiri. Implementasikan *Laravel Policies* atau logika pengecekan kepemilikan (ownership) di dalam fungsi `authorize()` pada *FormRequest*.

8. **Integritas Database (Constraints & Indexing)**:
   - Wajib menambahkan `->constrained()->cascadeOnDelete()` pada setiap *Foreign Key* di file *Migration*.
   - Wajib menambahkan `->index()` pada kolom-kolom yang sering digunakan untuk filter atau pencarian (contoh: `status`, `is_available`, `category`, `role`).

---

## Arsitektur Frontend (React + Vite)
Proyek ini tidak menggunakan Blade atau Inertia, melainkan murni **React + Vite** yang dipisahkan secara API (*Decoupled*).

1. **Teknologi Utama**:
   - Styling: **Tailwind CSS**.
   - Ikon: **Lucide React**.
   - API Client: **Axios** (dikonfigurasi di `src/lib/axios.js`).

2. **Data Fetching (React Query)**:
   - DILARANG keras menggunakan pola `useEffect` + `useState` murni untuk HTTP Request, kecuali sangat terpaksa.
   - WAJIB menggunakan **@tanstack/react-query** (versi 5).
   - Gunakan `useQuery` untuk menampilkan (GET) data. Manfaatkan opsi seperti `keepPreviousData` untuk fitur paginasi.
   - Gunakan `useMutation` untuk menyimpan/memperbarui/menghapus data. Gunakan properti `.isPending` (bukan `.isLoading` karena ini versi 5).
   - Setiap mutasi yang berhasil WAJIB men-trigger *Cache Invalidation* (`queryClient.invalidateQueries(['kunci-query'])`) agar layar diperbarui secara *real-time* tanpa perlu di-*refresh*.

3. **Clean Code & UX**:
   - Hindari render ulang yang tidak perlu.
   - Pastikan setiap operasi `useMutation` mengunci tombol (disabled) agar user tidak mengirim permintaan dobel.
   - Beri respons visual (seperti Spinner kecil di tombol) selama aksi sedang diproses (`isPending`).

4. **Optimistic UI (Koneksi Lambat)**:
   - SANGAT DISARANKAN mengimplementasikan **Optimistic Updates** pada operasi pengubahan (Edit) dan penghapusan (Delete) data.
   - Gunakan `onMutate` untuk membatalkan antrean *query* dan memanipulasi *cache* UI secara instan.
   - Wajib gunakan `onError` untuk melakukan *Rollback* (*restore* data ke kondisi awal) jika *request* ke server gagal/terputus.
   - Wajib gunakan `onSettled` untuk melakukan *background sync* (`invalidateQueries`) memastikan keakuratan data.

5. **Penanganan Error Global & Notifikasi**:
   - DILARANG menggunakan `alert()` bawaan browser. Wajib menggunakan pustaka seperti `react-hot-toast` atau `sonner` untuk notifikasi yang rapi.
   - `axios.js` wajib dikonfigurasi dengan *Global Interceptor* untuk menangani *response error* standar seperti `401 Unauthorized` secara terpusat (contoh: otomatis melempar user ke halaman login).

6. **Mobile-First UI Design**:
   - Selalu gunakan pendekatan *mobile-first* dalam styling menggunakan Tailwind CSS. 
   - Komponen UI utama (seperti *Card*, judul halaman, ukuran *font* untuk angka statistik) wajib menggunakan skala responsif (contoh: `p-3 sm:p-6` untuk padding, `text-xl sm:text-2xl` untuk teks judul).
   - Hindari membuat elemen raksasa pada perangkat HP (mobile). Sesuaikan proporsi tombol, padding form, dan teks agar terasa pas layaknya aplikasi native di perangkat mobile.

7. **Pemisahan Folder Platform (Mobile vs Web)**:
   - Mengingat aplikasi ini memiliki porsi aksi yang jauh lebih besar di perangkat seluler (HP) dibandingkan PC/Laptop, Anda WAJIB memisahkan struktur direktori untuk halaman (pages) antara mode Mobile dan Web.
   - Gunakan struktur sub-folder seperti `src/pages/mobile/` dan `src/pages/web/`.
   - AI harus selalu menjadikan pengerjaan versi *Mobile* sebagai prioritas utama (Mobile-First Workflow). Selesaikan fitur di layar HP terlebih dahulu sebelum menyesuaikan atau memindahkannya ke versi Web.

8. **Arsitektur UI Bersih & Modular (Clean UI Architecture)**:
   - DILARANG KERAS membuat *file* komponen (seperti `Dashboard.jsx` atau `Layout.jsx`) yang terlalu besar (monolithic) dan berisi terlalu banyak logika gabungan.
   - Wajib memisahkan fitur berdasarkan peran (Role) ke dalam file masing-masing (contoh: ekstrak `AdminDashboard`, `SantriDashboard` ke dalam folder `src/components/dashboard/mobile/`).
   - File utama seperti `Dashboard.jsx` di folder `pages` HANYA BOLEH bertugas memuat logika rute (Role Check) dan memanggil komponen spesifik.
   - Komponen Layout harus dipecah sekecil mungkin menjadi kepingan lego (misal: `TopHeader.jsx`, `MobileBottomNav.jsx`, `DesktopSidebar.jsx`). Ini wajib dilakukan agar *maintenance* fitur spesifik tidak merusak atau menyentuh kode milik fitur/peran lain.

9. **Optimasi Performa Frontend & Backend (WAJIB DITERAPKAN TERUS-MENERUS)**:
   - **Frontend Code Splitting (React.lazy)**: Seluruh rute halaman baru WAJIB diimpor menggunakan `React.lazy(() => import(...))` di `App.jsx` dan dibungkus `React.Suspense`. DILARANG KERAS mengimpor halaman secara sinkron (`import Page from ...`) di rute utama agar ukuran initial bundle tetap di bawah 350 KB.
   - **Frontend Global Cache (React Query v5)**: `queryClient` WAJIB disetel dengan `staleTime: 1000 * 60 * 5` (5 menit) dan `gcTime: 1000 * 60 * 30` (30 menit) serta `refetchOnWindowFocus: false` agar perpindahan antar halaman/tab berlangsung instan (0 ms) tanpa spamming request ke backend.
   - **Optimistic UI Updates**: Operasi perubahan status krusial (seperti proses pesanan, validasi pembayaran, update keranjang) WAJIB memanfaatkan `onMutate` untuk memanipulasi cache seketika sebelum respon server tiba, serta `onError` untuk rollback data jika gagal.
   - **Backend Query Optimization**: DILARANG keras membiarkan *N+1 Query Problem*. Selalu gunakan pola *Eager Loading* (`with('relasi')`) setiap kali mengembalikan daftar (list/pagination) data yang memiliki relasi.

10. **Penahan Benturan UI (Error Boundaries)**:
    - Wajib mengimplementasikan *Error Boundary* di level rute atau komponen besar. Ini untuk mencegah layar putih mati total (*Blank White Screen of Death*) jika terjadi *crash* pada logika komponen (misal: mengakses `.map()` pada data `undefined`). Selalu tampilkan *fallback* UI (pesan error ramah) agar pengguna tetap bisa menavigasi ke halaman lain.

11. **Aturan Tema UI (UI Theme Rules)**:
    - Warna utama aplikasi Higo Pondok adalah **Hijau** (`green-`).
    - DILARANG menggunakan warna tema lain (seperti `orange-`, `blue-`, dsb.) sebagai elemen utama UI atau mewakili *role* tertentu (misal Kantin tidak boleh lagi menggunakan tema orange).
    - Pengecualian hanya untuk warna semantik: `red-` (untuk error/hapus/tutup), `amber-` (untuk peringatan/menunggu/impersonasi).
12. **Sinkronisasi Database dan Seeder (Database & Seeder Sync)**:
    - Setiap kali ada perubahan struktur database (tabel baru, kolom baru, perubahan tipe data) melalui file Migration, WAJIB juga untuk memperbarui file Seeder yang relevan (`database/seeders/...`).
    - Hal ini untuk memastikan bahwa *mock data* atau data awal sistem selalu sinkron dengan struktur tabel terbaru dan bisa langsung digunakan untuk *testing* (contoh: `php artisan migrate:fresh --seed`) tanpa menimbulkan *error* akibat kolom yang belum terisi.

13. **Aturan Desain UI Kompak & Flat Bebas Lengkungan (High-Density & Flat Sharp UI Guidelines)**:
    - **Sudut Flat & Tegas (`rounded-none`)**:
      - Seluruh elemen antarmuka (Card, Modal Popup/Dialog, Tombol/Button, Input Form, Dropdown/Select, Badge Status, Tab Navigasi, Container Bukti/Gambar) WAJIB menggunakan sudut tegas / siku flat (`rounded-none`).
      - DILARANG KERAS menggunakan border melengkung berlebih seperti `rounded-3xl`, `rounded-2xl`, `rounded-xl`, atau `rounded-full` (kecuali indikator spinner bulat/animasi loading).
    - **Kepadatan Informasi Maksimal (High Density & Space-Saving)**:
      - Selalu prioritaskan efisiensi ruang layar vertikal dan horizontal.
      - Gunakan padding yang ramping (misal: modal `p-3 sm:p-4`, card `p-2 sm:p-2.5`, tombol `py-1.5` hingga `py-2`, gap antar elemen `gap-1` hingga `gap-2`).
      - DILARANG membiarkan ruang kosong berlebih (*whitespace bloat*) agar informasi penting langsung terlihat tanpa perlu banyak scrolling baik di perangkat mobile maupun desktop.
    - **Standar Modal Popup / Dialog Kompak**:
      - Seluruh modal wajib tampil flat (`rounded-none`), berbingkai tegas (`border border-gray-200 dark:border-gray-800`), berlatar belakang solid (`bg-white dark:bg-gray-900`), dengan header ramping, tombol tutup kotak tegas (`rounded-none`), dan tombol aksi persegi flat (`rounded-none`).
    - **Data Rekapitulasi & Tabel**:
      - Seluruh rekapitulasi data numerik/finansial (rekap per toko, kurir, santri, dsb.) WAJIB disajikan dalam struktur **Tabel (`<table>`) atau Grid terstruktur** yang lurus dan rata.
      - Kolom angka finansial/kuantitas wajib rata kanan (`text-right`) dengan font monospaced (`font-mono`) agar digit ribuan sejajar sempurna. DILARANG menggunakan chip fleksibel yang meliuk-liuk atau tidak sejajar untuk data perbandingan kuantitatif.

