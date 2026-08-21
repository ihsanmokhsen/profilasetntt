# Profil Aset NTT

Aplikasi web interaktif untuk menampilkan profil aset pemerintah Provinsi Nusa Tenggara Timur (NTT) dalam bentuk peta. Aplikasi ini membantu pengguna melihat lokasi aset, status pemanfaatan, informasi detail aset, serta melakukan pencarian berdasarkan kabupaten, nama pemanfaat, atau perangkat daerah.

## 1. Tujuan Aplikasi

Aplikasi ini dibuat untuk:
- menampilkan data aset secara visual dalam bentuk peta,
- mempermudah pencarian aset berdasarkan lokasi dan kriteria tertentu,
- memberikan informasi detail mengenai aset dan status pemanfaatannya,
- memudahkan pengguna melihat aset dalam area tertentu melalui fitur gambar area.

## 2. Fitur Utama

- Peta interaktif berbasis Leaflet
- Marker aset dengan warna berbeda:
  - merah: aset yang sudah dimanfaatkan
  - hijau: aset yang belum dimanfaatkan
- Sidebar daftar aset yang bisa diklik untuk langsung menuju lokasi di peta
- Filter pencarian berdasarkan:
  - kabupaten/kota
  - nama pemanfaat
  - perangkat daerah (OPD)
- Fitur menggambar area (rectangle/polygon) untuk menampilkan aset yang berada di dalam area tertentu
- Popup detail aset yang berisi informasi lengkap seperti:
  - nama aset
  - alamat
  - kondisi
  - luas
  - klasifikasi
  - status hak
  - keterangan
  - harga
- Tombol WhatsApp untuk menghubungi terkait informasi aset

## 3. Teknologi yang Digunakan

- HTML
- CSS
- JavaScript
- Leaflet.js untuk peta interaktif
- Leaflet Draw untuk fitur menggambar area

## 4. Struktur File Proyek

- index.html: struktur tampilan utama aplikasi
- style.css: styling tampilan antarmuka
- script.js: logika aplikasi, peta, filter, marker, dan fitur area
- data.js: data aset yang ditampilkan di peta
- asset/: folder untuk gambar pendukung aset

## 5. Cara Menjalankan Aplikasi

### Opsi 1: Jalankan dengan server lokal (disarankan)
1. Buka terminal di folder proyek.
2. Jalankan perintah berikut:

```bash
python3 -m http.server 8000
```

3. Buka browser dan akses:

```text
http://localhost:8000
```

### Opsi 2: Buka langsung file HTML
Anda juga dapat membuka file index.html secara langsung di browser, tetapi menjalankan melalui server lokal lebih disarankan agar semua aset dan file berjalan lebih stabil.

## 6. Cara Menggunakan Aplikasi

1. Buka halaman aplikasi.
2. Gunakan filter di sidebar untuk mencari aset tertentu.
3. Klik salah satu item pada daftar untuk melihat lokasi aset di peta.
4. Klik marker pada peta untuk melihat detail informasi aset.
5. Gunakan fitur gambar area untuk menampilkan aset yang berada dalam area tertentu.
6. Klik tombol reset untuk mengembalikan tampilan peta ke kondisi awal.

## 7. Catatan

Aplikasi ini menggunakan data statis yang tersimpan di file data.js. Jika ingin menambahkan atau mengubah data aset, silakan edit file tersebut sesuai format data yang sudah ada.
