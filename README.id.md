<p align="center">
  <img src="https://raw.githubusercontent.com/drizki/indonesian-badwords/main/assets/readme-banner.svg" alt="Indonesian Badwords. Deteksi kata kasar Bahasa Indonesia dengan cepat dan temukan posisinya dalam teks asli." width="1440" />
</p>

# Indonesian Badwords

[![npm](https://img.shields.io/npm/v/indonesian-badwords.svg)](https://www.npmjs.com/package/indonesian-badwords) [![CI](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml/badge.svg)](https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml) [![Unduhan](https://img.shields.io/npm/dt/indonesian-badwords.svg)](https://www.npmjs.com/package/indonesian-badwords) [![Lisensi MIT](https://img.shields.io/npm/l/indonesian-badwords.svg)](https://github.com/drizki/indonesian-badwords/blob/main/LICENSE)

[English](https://github.com/drizki/indonesian-badwords#readme) · [Bahasa Indonesia](https://github.com/drizki/indonesian-badwords/blob/main/README.id.md)

**Kenali kata kasar meski ejaannya diubah.**

Pendeteksi kata kasar Bahasa Indonesia yang cepat untuk chat, komentar, dan
konten pengguna. Kenali kata yang disamarkan atau salah ketik, tentukan apa yang
boleh muncul di aplikasi, lalu atur bagaimana hasil sensornya ditampilkan.

<table>
  <tr>
    <td align="center" width="33%"><h3>1,77 µs</h3>Cek pesan ASCII tanpa kata kasar<br />280 karakter</td>
    <td align="center" width="33%"><h3>~12 KB</h3>Bundle browser default<br />minifikasi + gzip</td>
    <td align="center" width="33%"><h3>0</h3>Dependensi runtime</td>
  </tr>
</table>

Angka waktu memakai median benchmark sintetis setelah warmup di Node.js 24.22.1
dengan konfigurasi default.
[Lihat pengukurannya](https://github.com/drizki/indonesian-badwords/blob/main/docs/performance.md).

## Memulai

```bash
npm install indonesian-badwords
```

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords();

checker.flag('terima kasih'); // => false
checker.flag('dasar g0bl0k!'); // => true
checker.censor('dasar g0bl0k!'); // => 'dasar ***!'
```

Gunakan dengan JavaScript atau TypeScript. Mendukung ESM dan CommonJS.
Memerlukan Node.js 22+; bundle browser memerlukan dukungan ES2022 dan `Intl.Segmenter`.

## Kenali kata yang disamarkan

`g0bl0k` dan `ＧＯＢＬＯＫ` sudah terdeteksi dengan konfigurasi default, termasuk
kata yang disisipi karakter tak terlihat. Aktifkan opsi evasion dan fuzzy untuk
menangani huruf yang dipisah, pengulangan huruf, karakter mirip, atau typo.

Dengan konfigurasi di bawah, semua ejaan ini bisa disensor:

| Pesan | Hasil | Yang ditangani |
| --- | --- | --- |
| `dasar g-o-b-l-o-k!` | `dasar ***!` | Pemisah di antara huruf |
| `dasar gobloook!` | `dasar ***!` | Pengulangan huruf |
| `dasar gοblοk!` | `dasar ***!` | Karakter Yunani tertentu yang mirip huruf Latin |
| `dasar goblox!` | `dasar ***!` | Satu huruf diganti |
| `dasar golbok!` | `dasar ***!` | Dua huruf bersebelahan tertukar |
| `dasar g-o-b-l-o-x!` | `dasar ***!` | Pemisah dan typo sekaligus |

Fuzzy matching mendukung Levenshtein untuk perubahan ejaan dan OSA untuk huruf
bersebelahan yang tertukar. Tentukan perubahan dan toleransi yang sesuai untuk
aplikasi. Kedua fitur ini punya batas kerja yang bisa diatur. Pencocokan yang
lebih luas juga bisa menandai kata biasa, jadi uji aturannya dengan teks dari aplikasi.

<details>
<summary>Coba konfigurasi pencocokan di atas</summary>

```ts
import { Badwords } from 'indonesian-badwords';
import { boundedEvasion, latinLookalikes } from 'indonesian-badwords/evasion';
import { boundedFuzzy } from 'indonesian-badwords/fuzzy';

const tolerant = new Badwords({
  fuzzy: boundedFuzzy({ model: 'osa', maxEdits: 1 }),
  evasion: boundedEvasion({
    separators: { characters: [' ', '.', '_', '-'], maxGap: 1, maxTotal: 8 },
    repetitions: { maxExtraPerLetter: 2, maxTotal: 8 },
    confusables: { mappings: latinLookalikes, maxTotal: 2 },
  }),
});

tolerant.censor('dasar g-o-b-l-o-x!'); // => 'dasar ***!'
```

[Opsi evasion](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/evasion.md)
· [Fuzzy matching](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/fuzzy-matching.md)

</details>

## Atur hasil sensor

Ganti seluruh kata, pertahankan huruf di awal dan akhir, atau buat label sendiri.
Berikut hasil dari pesan yang sama:

| Pengganti | Pesan | Hasil |
| --- | --- | --- |
| Default | `dasar g0bl0k!` | `dasar ***!` |
| Pertahankan huruf pertama dan terakhir | `dasar g0bl0k!` | `dasar g****k!` |
| Callback kustom | `dasar g0bl0k!` | `dasar [goblok]!` |

```ts
import { Badwords } from 'indonesian-badwords';
import { mask } from 'indonesian-badwords/censor';

const checker = new Badwords();
const message = 'dasar g0bl0k!';

checker.censor(message);
checker.censor(message, mask({ keepFirst: 1, keepLast: 1 }));
checker.censor(message, ({ words }) => `[${words[0]}]`);
```

Bisa juga memakai karakter mask sendiri atau simbol grawlix acak. Callback
menerima teks asli, posisi kecocokan, dan kata kamus yang terdeteksi, sehingga
hasilnya bisa disesuaikan dengan tampilan aplikasi. Semua cara sensor memakai
aturan pencocokan yang sama dengan deteksi.
[Contoh sensor](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/censoring.md).

## Tentukan pengecualian

Izinkan frasa tertentu sambil tetap memeriksa bagian pesan lainnya. Nama pakaian
seperti `Baju Bodo` bisa dikecualikan tanpa membiarkan hinaan lain, termasuk kata
`bodo` di luar nama tersebut:

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords({ allowPhrases: ['Baju Bodo'] });

checker.censor('Baju Bodo goblok bodo'); // => 'Baju Bodo *** ***'
```

Aplikasi juga bisa mengecualikan rentang teks tertentu, misalnya kutipan atau
kode yang sudah dikenali. Bagian lainnya tetap diperiksa.
[Pengecualian frasa dan rentang teks](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/exceptions.md).

Pilihan kamus menentukan apa yang ditandai. Daftar default tidak menyertakan
kata yang punya penggunaan biasa, seperti `anjing` dan `babi`. Gunakan kamus
yang diperluas jika kata tersebut perlu dideteksi dalam penggunaan apa pun:

| Teks | Kamus default | Kamus diperluas |
| --- | --- | --- |
| `anjing peliharaan` | Tidak ditandai | Menandai `anjing` |

Kosakata regional juga tersedia, seperti `jancuk` dari bahasa Jawa dan `kehed`
dari bahasa Sunda. Metadata opsional bisa memilih kata yang sudah ditinjau
berdasarkan kategori, penggunaan regional yang terdokumentasi, dan tingkat
kekasaran tiap entri. Bisa juga menggunakan daftar sendiri. Katalog sumber
memuat penjelasan, rujukan, dan status peninjauan di balik pilihan tersebut.
[Pilih kamus](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/dictionaries.md).

## Gunakan hasilnya untuk highlight dan moderasi

Dapatkan ejaan yang muncul dalam pesan beserta kata kamus yang cocok. Posisi
kecocokan mengacu pada teks asli, sehingga aplikasi bisa menandai karakter yang
tepat meski ejaannya perlu dinormalisasi:

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords();

checker.find('👩🏽‍💻 g0bl0k!');
// [{ word: 'goblok', index: 8, end: 14, match: 'g0bl0k' }]
```

Rangkaian karakter Unicode tetap utuh, termasuk huruf bertanda diakritik dan
emoji. Gunakan `analyze()` untuk mendapatkan daftar kata unik, jumlah kemunculan,
teks yang sudah disensor, dan lokasi kecocokan dalam satu hasil. Gunakan
`filter()` untuk menghapus kecocokan dan merapikan spasi.
[Format hasil](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md#results-and-errors).

## Tambahkan fitur sesuai kebutuhan

Bundle browser default sekitar 12 KB setelah minifikasi dan gzip. Helper sensor,
evasion, fuzzy matching, metadata, dan katalog sumber diimpor terpisah.
Menambahkan deteksi typo tidak mengharuskan aplikasi memuat katalog sumber.
Pemilihan kategori kamus dilakukan saat setup, bukan setiap kali pesan diperiksa.

Metode yang sama bisa digunakan dengan setiap konfigurasi. Kode untuk deteksi,
sensor, dan pelaporan tetap bisa dipakai saat opsi pencocokan ditambahkan.

## Performa yang bisa diuji

Benchmark mencakup input ASCII dan Unicode, posisi kecocokan, sensor, callback,
kamus kustom, pengecualian, evasion, dan fuzzy matching. Berikut sebagian hasil
pengukuran dengan konfigurasi default:

| Teks | Operasi | Median |
| --- | --- | ---: |
| Paragraf ASCII tanpa kata kasar, 4.000 karakter | `flag` | 24,45 µs |
| Paragraf ASCII tanpa kata kasar, 4.000 karakter | `censor` | 5,56 µs |
| Aksen, emoji, dan satu kecocokan literal, 4.000 unit UTF-16 | `flag` | 29,79 µs |

Angka ini adalah median benchmark sintetis setelah warmup di Node.js 24.22.1,
tanpa waktu setup. Opsi tambahan punya biaya masing-masing. Jalankan
`npm run benchmark` dari repository untuk mengukur runtime yang digunakan.
[Hasil lengkap dan metodologi](https://github.com/drizki/indonesian-badwords/blob/main/docs/performance.md).

## Dokumentasi

Panduan teknis tersedia dalam bahasa Inggris:

Mulai dari [indeks dokumentasi](https://github.com/drizki/indonesian-badwords/blob/main/docs/README.md)
untuk setup, konfigurasi, contoh browser/framework, dan troubleshooting.

[Referensi API](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md)
· [Kamus dan sumber](https://github.com/drizki/indonesian-badwords/blob/main/docs/metadata.md)
· [Benchmark](https://github.com/drizki/indonesian-badwords/blob/main/docs/performance.md)

## Kontribusi

Ada kata kasar yang lolos atau teks biasa yang ikut ditandai? Buka issue dengan
contoh teks, hasil yang diharapkan, dan contoh serupa yang seharusnya aman.
Untuk menambah entri kamus, sertakan sumber yang menunjukkan penggunaan kasarnya. Gunakan [form laporan kamus](https://github.com/drizki/indonesian-badwords/issues/new?template=dictionary-report.yml)
dan baca [panduan kontribusi](https://github.com/drizki/indonesian-badwords/blob/main/docs/contributing.md).

Semoga bermanfaat 😉
