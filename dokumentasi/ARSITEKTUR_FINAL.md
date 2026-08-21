# Arsitektur Final Profil Aset NTT

**Status:** Rancangan final  
**Versi:** 1.0  
**Tanggal:** 2026-08-19

## 1. Ringkasan

Profil Aset NTT adalah aplikasi sistem informasi untuk menampilkan dan mengelola data aset tanah dan bangunan Pemerintah Provinsi Nusa Tenggara Timur melalui peta interaktif. Arsitektur final menggunakan PostgreSQL dengan ekstensi PostGIS agar aplikasi dapat menyimpan dan mengolah polygon bidang tanah, bukan hanya titik koordinat.

Arsitektur ini dirancang untuk berjalan pada VPS Ubuntu 22.04 dengan aaPanel, menggunakan Nginx sebagai reverse proxy/web server dan backend API sebagai satu-satunya komponen yang mengakses database.

## 2. Keputusan Teknologi

| Komponen | Teknologi | Peran |
|---|---|---|
| VPS | Ubuntu 22.04, 4 vCPU, 16 GB RAM, 200 GB disk | Infrastruktur aplikasi |
| Panel/server web | aaPanel + Nginx | Virtual host, HTTPS, static file, reverse proxy |
| Frontend | HTML, CSS, JavaScript | Antarmuka dan peta interaktif |
| Peta | Leaflet.js + Leaflet Draw | Marker, polygon, dan gambar area |
| Backend | REST API (Laravel atau Node.js/Express) | Validasi, autentikasi, CRUD, dan akses database |
| Database | PostgreSQL | Penyimpanan data relasional |
| GIS | PostGIS | Geometry polygon, spatial index, luas, jarak, dan overlap |
| File aset | Filesystem VPS | Penyimpanan gambar/dokumen, URL disimpan di database |
| HTTPS | Let's Encrypt | Enkripsi komunikasi |

Backend dapat menggunakan Laravel atau Node.js/Express. Pilihan tersebut tidak mengubah rancangan database dan API pada dokumen ini.

## 3. Diagram Arsitektur

```text
Pengguna/Admin
     |
     | HTTPS (443)
     v
Nginx / aaPanel
     |
     +--> Frontend statis (HTML, CSS, JavaScript, Leaflet)
     |
     +--> Backend REST API (Laravel atau Node.js/Express)
                |
                +--> PostgreSQL + PostGIS (localhost/private network)
                |
                +--> Filesystem untuk gambar/dokumen aset

Backup terjadwal --> lokasi backup eksternal
```

Database tidak boleh diakses langsung oleh browser. Frontend memanggil backend API, lalu backend melakukan query ke PostgreSQL.

## 4. Model Data Utama

### 4.1 Tabel `assets`

Tabel ini menyimpan informasi umum aset dan dapat menyimpan satu polygon utama apabila satu aset selalu terdiri dari satu bidang.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE assets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  pemanfaat TEXT,
  lokasi TEXT,
  kabupaten VARCHAR(100),
  alamat TEXT,
  opd VARCHAR(255),
  status_pemanfaatan VARCHAR(150),
  status_class VARCHAR(50),
  kondisi TEXT,
  luas_m2 NUMERIC(18, 2),
  klasifikasi TEXT,
  status_hak TEXT,
  tersedia TEXT,
  sertifikat TEXT,
  harga NUMERIC(18, 2),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  boundary GEOMETRY(Polygon, 4326),
  keterangan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX assets_boundary_gist_idx
  ON assets USING GIST (boundary);

CREATE INDEX assets_kabupaten_idx ON assets (kabupaten);
CREATE INDEX assets_opd_idx ON assets (opd);
CREATE INDEX assets_status_idx ON assets (status_class);
```

`latitude` dan `longitude` tetap dapat digunakan sebagai centroid atau fallback marker. Sumber utama geometri bidang adalah `boundary`.

### 4.2 Tabel `asset_parcels` (disarankan untuk pengembangan)

Gunakan tabel ini jika satu aset dapat memiliki beberapa bidang, sertifikat, atau polygon terpisah.

```sql
CREATE TABLE asset_parcels (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  nomor_sertifikat VARCHAR(150),
  luas_m2 NUMERIC(18, 2),
  boundary GEOMETRY(Polygon, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX asset_parcels_boundary_gist_idx
  ON asset_parcels USING GIST (boundary);
```

Untuk tahap awal, `boundary` dapat berada di `assets`. Jika kebutuhan pertanahan berkembang, migrasikan polygon ke `asset_parcels` tanpa mengubah identitas aset utamanya.

### 4.3 Tabel pendukung

Tabel berikut dapat ditambahkan bersama fitur terkait:

- `asset_images`: banyak gambar untuk satu aset.
- `asset_documents`: dokumen sertifikat atau dokumen pendukung.
- `asset_status_history`: riwayat perubahan status.
- `users`/`profiles`: profil dan peran admin/operator.

File gambar dan dokumen disimpan di filesystem, bukan sebagai binary di database. Database hanya menyimpan path, nama file, tipe, dan metadata.

## 5. Aturan Data Spasial

1. Polygon disimpan sebagai `GEOMETRY(Polygon, 4326)`.
2. Data GeoJSON menggunakan urutan `[longitude, latitude]`.
3. Ring polygon harus tertutup: titik terakhir sama dengan titik pertama.
4. Backend harus menolak geometry yang tidak valid.
5. Geometry harus diperiksa dengan `ST_IsValid` sebelum disimpan.
6. Perhitungan luas sebaiknya memakai CRS berbasis meter, bukan langsung derajat EPSG:4326.
7. Karena wilayah NTT dapat melintasi beberapa zona UTM, CRS untuk perhitungan harus ditentukan berdasarkan lokasi bidang atau kebijakan GIS yang disepakati.
8. Spatial index GiST wajib dibuat untuk query wilayah, jarak, dan overlap.

Contoh validasi:

```sql
SELECT id, ST_IsValid(boundary)
FROM assets
WHERE boundary IS NOT NULL;
```

Contoh mengambil GeoJSON untuk Leaflet:

```sql
SELECT
  id,
  nama,
  ST_AsGeoJSON(boundary)::json AS boundary
FROM assets
WHERE boundary IS NOT NULL;
```

Contoh pencarian bidang yang beririsan:

```sql
SELECT a.id, b.id
FROM assets a
JOIN assets b ON a.id < b.id
WHERE a.boundary IS NOT NULL
  AND b.boundary IS NOT NULL
  AND ST_Intersects(a.boundary, b.boundary);
```

## 6. API Backend

Endpoint minimum yang disarankan:

```text
GET    /api/assets
GET    /api/assets/{id}
POST   /api/assets
PUT    /api/assets/{id}
DELETE /api/assets/{id}
POST   /api/assets/{id}/images
GET    /api/assets/within?polygon={geojson}
GET    /api/assets/nearby?lat={lat}&lng={lng}&radius={meter}
```

Aturan API:

- Endpoint `GET` publik hanya mengembalikan data yang memang boleh ditampilkan.
- `POST`, `PUT`, dan `DELETE` wajib memerlukan autentikasi dan otorisasi admin/operator.
- Input polygon diterima sebagai GeoJSON, divalidasi di backend, lalu dikonversi ke PostGIS.
- Backend menggunakan parameterized query/ORM untuk mencegah SQL injection.
- Response geometry dikembalikan sebagai GeoJSON agar langsung dapat digunakan Leaflet.
- Pagination wajib diterapkan pada daftar aset.

## 7. Frontend

Kode frontend saat ini berada di root proyek:

- `index.html`: struktur halaman.
- `style.css`: tampilan.
- `script.js`: peta, filter, marker, dan interaksi.
- `data.js`: sumber data statis sementara.
- `marked-areas.js`: area penanda sementara.

Tahap migrasi:

1. Pertahankan tampilan dan interaksi Leaflet yang sudah ada.
2. Ganti sumber `window.PROFIL_ASET_NTT_ASSETS` dari `data.js` dengan data API.
3. Render `boundary` dari GeoJSON sebagai `L.geoJSON`.
4. Pertahankan marker menggunakan centroid atau koordinat tersimpan.
5. Gunakan Leaflet Draw untuk input polygon baru.
6. Kirim hasil gambar ke backend sebagai GeoJSON.
7. Tampilkan pesan validasi jika polygon rusak atau tumpang tindih.

## 8. Deployment VPS

Direktori produksi yang disarankan:

```text
/var/www/profil-aset/
├── frontend/
├── backend/
├── storage/assets/
├── storage/documents/
└── releases/
```

Konfigurasi umum:

- Nginx melayani frontend dan meneruskan `/api` ke backend.
- Backend berjalan sebagai user aplikasi non-root.
- PostgreSQL hanya listen pada `localhost` atau private network.
- Domain diarahkan ke IP VPS `212.85.26.65`.
- HTTPS diaktifkan melalui Let's Encrypt pada aaPanel.
- Jika backend Node.js, gunakan process manager seperti PM2.
- Jika backend Laravel, gunakan PHP-FPM dan worker queue jika diperlukan.

Port publik minimum:

```text
22/tcp   SSH (sebaiknya dibatasi berdasarkan IP)
80/tcp   HTTP untuk redirect ke HTTPS
443/tcp  HTTPS
```

Port PostgreSQL `5432` tidak dibuka ke internet.

## 9. Keamanan

- Jangan menjalankan backend, worker, atau proses deployment sebagai `root`.
- Gunakan user database khusus aplikasi, bukan superuser PostgreSQL.
- Simpan secret pada environment variable, bukan di JavaScript frontend atau Git.
- Gunakan SSH key dan nonaktifkan login root berbasis password setelah key teruji.
- Aktifkan firewall dan Fail2ban.
- Batasi ukuran serta tipe file upload.
- Ganti nama file upload secara acak dan cegah eksekusi script di folder upload.
- Terapkan validasi server-side untuk seluruh data aset dan polygon.
- Gunakan role `admin`, `operator`, dan `viewer` jika diperlukan.
- Catat aktivitas perubahan data penting.
- Pastikan CORS hanya mengizinkan domain aplikasi.

## 10. Backup dan Pemulihan

Kebijakan minimum:

- Backup PostgreSQL otomatis setiap hari.
- Backup gambar dan dokumen setiap hari atau setiap dua hari.
- Backup VPS penuh tetap dilakukan mingguan.
- Simpan backup di lokasi eksternal, bukan hanya di VPS yang sama.
- Retensi backup minimal 30 hari.
- Uji restore secara berkala.

Backup harus mencakup:

```text
Database PostgreSQL + PostGIS
Folder storage/assets/
Folder storage/documents/
Konfigurasi backend dan Nginx
Environment/secrets melalui prosedur aman, bukan repository publik
```

## 11. Migrasi Data dari `data.js`

1. Buat database PostgreSQL dan aktifkan PostGIS.
2. Buat schema dan migration tabel.
3. Normalisasi nilai harga menjadi angka, misalnya `3642800000`.
4. Normalisasi luas menjadi `luas_m2` jika data memungkinkan.
5. Import data aset dari `data.js` melalui script migrasi satu kali.
6. Validasi latitude, longitude, dan polygon.
7. Upload gambar ke storage server.
8. Simpan URL/path gambar pada tabel terkait.
9. Cocokkan jumlah data hasil import dengan data sumber.
10. Uji marker, polygon, filter, popup, dan query spatial.
11. Setelah API stabil, jadikan `data.js` hanya sebagai backup/arsip dan bukan sumber data produksi.

## 12. Tahapan Implementasi

### Fase 1 — Infrastruktur

- Menyiapkan domain dan virtual host di aaPanel.
- Menyiapkan HTTPS.
- Memasang PostgreSQL dan PostGIS.
- Membuat user database non-superuser.
- Menyiapkan firewall dan backup.

### Fase 2 — Backend dan database

- Membuat migration.
- Membuat API daftar/detail aset.
- Membuat validasi polygon.
- Membuat autentikasi admin.
- Membuat CRUD aset dan upload file.

### Fase 3 — Integrasi frontend

- Mengganti data statis dengan API.
- Menampilkan GeoJSON polygon di Leaflet.
- Menambahkan form input/edit polygon.
- Mengaktifkan filter server-side bila jumlah data besar.

### Fase 4 — GIS dan administrasi

- Query bidang dalam area.
- Query radius/jarak.
- Deteksi overlap.
- Perhitungan luas.
- Riwayat perubahan.
- Export GeoJSON/CSV bila diperlukan.

## 13. Keputusan Final

Arsitektur produksi yang dipilih:

```text
Frontend HTML/CSS/JavaScript + Leaflet
Nginx melalui aaPanel
Backend REST API Laravel atau Node.js/Express
PostgreSQL + PostGIS
Filesystem VPS untuk gambar dan dokumen
HTTPS Let's Encrypt
Backup database dan file ke lokasi eksternal
```

**Database final:** PostgreSQL dengan PostGIS.

**Representasi bidang tanah:** GeoJSON pada API dan `geometry` Polygon pada database.

**Akses database:** hanya dari backend melalui jaringan lokal/private, tidak langsung dari browser.