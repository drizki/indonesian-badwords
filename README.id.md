<p align="center">
  <img src="https://raw.githubusercontent.com/drizki/indonesian-badwords/main/assets/readme-banner.svg" alt="Indonesian Badwords. Cek kata kasar dengan cepat dan dapatkan posisinya dalam teks asli. Mendukung TypeScript, ESM, CommonJS, tanpa dependensi runtime." width="1440" />
</p>

# Indonesian Badwords

[![npm](https://img.shields.io/npm/v/indonesian-badwords.svg)](https://www.npmjs.com/package/indonesian-badwords) [![CI](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml/badge.svg)](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml) [![Unduhan](https://img.shields.io/npm/dt/indonesian-badwords.svg)](https://www.npmjs.com/package/indonesian-badwords) [![Lisensi MIT](https://img.shields.io/npm/l/indonesian-badwords.svg)](https://github.com/drizki/indonesian-badwords/blob/main/LICENSE)

[English](https://github.com/drizki/indonesian-badwords#readme) · [Bahasa Indonesia](https://github.com/drizki/indonesian-badwords/blob/main/README.id.md)

Deteksi kata kasar dalam Bahasa Indonesia dengan cepat. Kenali kata meski
ejaannya disamarkan, sensor hasilnya, dan dapatkan posisinya dalam teks asli.

Gunakan dengan JavaScript atau TypeScript di Node.js maupun bundle browser.
Mendukung ESM dan CommonJS, tanpa dependensi runtime.

## Memulai

```bash
npm install indonesian-badwords
```

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords();

checker.flag('terima kasih');    // false
checker.flag('dasar g0bl0k!');   // true
checker.censor('dasar g0bl0k!'); // 'dasar ***!'
checker.find('dasar g0bl0k!');
// [{ word: 'goblok', index: 6, end: 12, match: 'g0bl0k' }]
```

Memerlukan Node.js 22+. Bundle browser memerlukan dukungan ES2022 dan `Intl.Segmenter`.

## Fitur

- Kenali kata yang disamarkan, seperti `g0bl0k`, huruf fullwidth, atau karakter
  tak terlihat. Aktifkan opsi evasion dan fuzzy untuk menangani huruf yang
  dipisah, pengulangan huruf, karakter mirip tertentu, dan typo.
- Dapatkan posisi kata dalam teks asli. Pencocokan dan sensor tidak memotong
  huruf bertanda diakritik atau rangkaian emoji.
- Pilih kamus sesuai kebutuhan: daftar default yang konservatif, daftar yang
  lebih luas, atau daftar sendiri. Metadata opsional bisa menyaringnya menurut
  kategori, penggunaan regional yang terdokumentasi, dan tingkat kekasaran
  tiap entri.
- Atur hasil sensor: teks pengganti, mask kustom, simbol grawlix, atau callback
  sendiri. Deteksi dan sensor memakai aturan pencocokan yang sama.
- Kecualikan frasa atau bagian teks tertentu. Pengecualian di satu bagian tidak
  menyembunyikan kata kasar di bagian lain dalam pesan yang sama.
- Lihat alasan dan sumber di balik entri kamus lewat katalog terpisah.
  Pemindai opsional, metadata, dan sumber tidak ikut dimuat lewat impor biasa.

Secara default, library mencocokkan kata utuh. Kata seperti `anjing` dan `babi`
juga punya makna biasa, jadi keduanya tidak masuk kamus default. Gunakan kamus
yang diperluas kalau aplikasi perlu mendeteksinya.
[Lihat pilihan kamus dan aturan pencocokan](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md#instances-and-dictionaries).

## Performa

| Konfigurasi default | Hasil |
| --- | ---: |
| Pesan ASCII tanpa kata kasar, 280 karakter, `flag` | 1,77 µs per panggilan |
| Paragraf ASCII tanpa kata kasar, 4.000 karakter, `flag` | 24,45 µs per panggilan |
| Bundle browser setelah minifikasi dan gzip | Sekitar 12 KB |

Angka waktu memakai median benchmark sintetis setelah warmup di Node.js 24.22.1.
Hasil bisa berbeda menurut teks, perangkat, dan runtime yang dipakai.
[Lihat hasil lengkap dan cara menjalankan benchmark](https://github.com/drizki/indonesian-badwords/blob/main/docs/performance.md).

## Dokumentasi

Panduan teknis tersedia dalam bahasa Inggris:

- [API, aturan pencocokan, dan kustomisasi](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md)
- [Kamus, kategori, penggunaan regional, dan sumber](https://github.com/drizki/indonesian-badwords/blob/main/docs/metadata.md)
- [Performa dan benchmark](https://github.com/drizki/indonesian-badwords/blob/main/docs/performance.md)
- [Migrasi ke v2](https://github.com/drizki/indonesian-badwords/blob/main/docs/migrating-v2.md)
- [Pengembangan dan rilis npm](https://github.com/drizki/indonesian-badwords/blob/main/docs/maintaining.md)

## Kontribusi

Ada kata kasar yang lolos, atau teks biasa malah kena sensor? Buka issue dengan
contoh teks, hasil yang diharapkan, dan contoh serupa yang seharusnya aman.
Untuk menambah entri kamus, sertakan sumber yang menunjukkan penggunaan kasarnya.

Semoga bermanfaat 😉
