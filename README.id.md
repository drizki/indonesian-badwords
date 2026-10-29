<p align="center">
  <img src="https://raw.githubusercontent.com/drizki/indonesian-badwords/main/assets/readme-banner.svg" alt="Indonesian Badwords. Deteksi kata kasar Bahasa Indonesia dengan cepat dan temukan posisinya dalam teks asli." width="1440" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/indonesian-badwords"><img src="https://shieldcn.dev/npm/v/indonesian-badwords.svg?variant=default&color=acf274&labelColor=18382b&labelTextColor=eff5eb&font=geist-mono&split=true&size=sm" alt="npm version" /></a>
  <a href="https://github.com/drizki/indonesian-badwords/actions/workflows/ci.yml"><img src="https://shieldcn.dev/github/ci/drizki/indonesian-badwords.svg?variant=default&color=acf274&labelColor=18382b&labelTextColor=eff5eb&font=geist-mono&split=true&size=sm" alt="CI status" /></a>
  <a href="https://www.npmjs.com/package/indonesian-badwords"><img src="https://shieldcn.dev/npm/dm/indonesian-badwords.svg?variant=default&color=acf274&labelColor=18382b&labelTextColor=eff5eb&font=geist-mono&split=true&size=sm" alt="npm downloads per month" /></a>
  <a href="https://github.com/drizki/indonesian-badwords/blob/main/LICENSE"><img src="https://shieldcn.dev/github/license/drizki/indonesian-badwords.svg?variant=default&color=acf274&labelColor=18382b&labelTextColor=eff5eb&font=geist-mono&split=true&size=sm" alt="License" /></a>
</p>

<p align="center">
  <a href="https://github.com/drizki/indonesian-badwords/blob/main/docs/README.md">Dokumentasi</a> ·
  <a href="https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md">API</a> ·
  <a href="https://github.com/drizki/indonesian-badwords/tree/main/docs/guides">Panduan</a> ·
  <a href="https://github.com/drizki/indonesian-badwords/blob/main/CHANGELOG.md">Changelog</a> ·
  <a href="https://github.com/drizki/indonesian-badwords/blob/main/docs/contributing.md">Kontribusi</a> ·
  <a href="https://github.com/drizki/indonesian-badwords#readme">English</a>
</p>

---

# Indonesian Badwords

**Jaga chat, komentar, dan username berbahasa Indonesia tetap sopan, dengan aturan yang Anda tentukan sendiri.**

Orang menulis `g0bl0k` atau `ＧＯＢＬＯＫ` (keduanya tertangkap secara default), atau `g-o-b-l-o-k` (tertangkap dengan kebijakan evasion opsional), supaya lolos dari filter. Tim Anda juga perlu meloloskan nama seperti `Baju Bodo`, membedakan kata yang agak kasar dari yang sangat kasar, dan menyerahkan kasus yang meragukan kepada moderator. Indonesian Badwords menangani semuanya. Ia melaporkan apa yang ditemukan, bukan menebak maksud penulisnya.

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

Memerlukan Node.js 22+ (bundle browser memerlukan ES2022 dan `Intl.Segmenter`). Mendukung ESM, CommonJS, dan tipe TypeScript, tanpa dependensi runtime.

## Apa saja yang bisa dilakukan

| Kemampuan | Cara memakainya |
| --- | --- |
| Pencocokan kata utuh dengan normalisasi Unicode, huruf besar-kecil, lebar karakter, dan karakter tak terlihat, plus leetspeak (`g0bl0k`) | Aktif secara default (`mode: 'word'`, `normalization: 'standard'`) |
| Daftar default yang konservatif, daftar yang diperluas, dan kata buatan sendiri | `dictionary`, `expandedDictionary`, `new Badwords({ dictionary: [...] })` |
| Daftar yang sudah ditinjau, dipilih menurut kategori, tingkat keparahan, dan wilayah | `selectDictionary()` dari `indonesian-badwords/metadata` |
| Cara setiap kecocokan ditemukan: `exact`, `normalized`, `leetspeak`, `evasion`, atau `fuzzy` | `via` pada setiap hasil `find()` dan `analyze().locations` |
| Kategori, tingkat keparahan editorial, wilayah, serta `score` 0-100 dengan `level` | `classify()` dari `indonesian-badwords/metadata` |
| Pemisah yang disisipkan, huruf yang diulang, dan karakter mirip (opsional, terbatas) | `boundedEvasion()` dari `indonesian-badwords/evasion` |
| Salah ketik dan huruf tertukar (opsional, terbatas) | `boundedFuzzy()` dari `indonesian-badwords/fuzzy` |
| Pengecualian pada lingkup tersempit: satu frasa, atau satu rentang dalam satu panggilan | opsi `allowPhrases`, opsi panggilan `ignoreRanges` |
| Sensor dengan `***`, `mask()`, `grawlix()`, atau callback sendiri | `indonesian-badwords/censor` |
| Offset UTF-16 yang tepat pada teks asli, untuk highlight | `find()`, `analyze()` |
| Error bertipe dan batas kerja yang pasti untuk input tak tepercaya | `maxMatches` dan `limits` pada tiap kebijakan |

Metode: `flag`, `find`, `badwords`, `censor`, `filter`, `analyze`. Evasion dan fuzzy tidak aktif sampai Anda memberikan kebijakannya.

## Prinsip

- **Ketepatan nomor satu.** Teks aman yang ikut ditandai adalah bug. Daftar default tidak memuat kata yang punya arti sehari-hari, seperti `anjing` dan `babi`; pencocokan yang lebih luas harus Anda aktifkan sendiri.
- **Tidak menebak konteks.** Pustaka ini melaporkan apa yang cocok dan bagaimana ia cocok. Aplikasi Andalah yang memutuskan tindakannya. `score` menilai kata yang cocok, bukan niat penulis pesan.
- **Kendali pada lingkup tersempit.** Ubah satu kata, satu frasa, satu kategori, atau satu panggilan, bukan seluruh checker.
- **Andal untuk input tak tepercaya.** Hasilnya deterministik, kerjanya dibatasi, dan batas yang terlampaui memunculkan error bertipe, bukan hasil "bersih" yang menyesatkan.
- **Cepat.** Pemeriksaan sepanjang pesan chat hanya butuh mikrodetik, dan fitur opsional tidak membesarkan impor default.

## Resep

### Sensor kecocokan exact dan leetspeak, antrekan yang fuzzy untuk ditinjau

Setiap kemunculan membawa `via`, jadi satu kali pemeriksaan bisa memperlakukan kecocokan pasti dan tebakan secara berbeda.

```ts
import { Badwords } from 'indonesian-badwords';
import { boundedFuzzy } from 'indonesian-badwords/fuzzy';

const checker = new Badwords({ dictionary: ['goblok'], fuzzy: boundedFuzzy() });
const review: string[] = [];

const output = checker.censor('goblok g0bl0k goblox', (context) => {
  const kinds = context.occurrences().map(({ via }) => via.kind);
  if (kinds.every((kind) => kind === 'fuzzy')) {
    review.push(context.match);
    return context.match;
  }
  return '***';
});

output; // => '*** *** goblox'
review; // => ['goblox']
```

### Klasifikasikan pesan lalu tentukan tindakannya

`classify()` menambahkan kategori, tingkat keparahan, dan wilayah pada tiap kecocokan, lalu meringkas pesannya. `level` bernilai `none`, `unrated`, `mild`, `moderate`, `strong`, atau `extreme`. `level` `unrated` (dengan `score` `null`) berarti ada kata yang cocok tetapi tidak punya tingkat keparahan, misalnya kata buatan sendiri. Ini tidak pernah berarti bersih.

```ts
import { Badwords } from 'indonesian-badwords';
import { classify } from 'indonesian-badwords/metadata';

const checker = new Badwords();

function decide(message: string): 'allow' | 'mask' | 'review' | 'block' {
  const result = classify(checker.analyze(message));
  if (result.level === 'none') return 'allow';
  // Matched but unrated is never clean: a person looks at it.
  if (result.level === 'unrated' || result.summary.unrated + result.summary.unclassified > 0) return 'review';
  return (result.score ?? 0) >= 60 ? 'block' : 'mask';
}

decide('terima kasih'); // => 'allow'
decide('dasar g0bl0k!'); // => 'mask'
decide('dasar cibai'); // => 'review'
```

[Definisi score dan level](https://github.com/drizki/indonesian-badwords/blob/main/docs/metadata.md#the-score)

### Pilih kosakata Anda

```ts
import { Badwords } from 'indonesian-badwords';
import { selectDictionary } from 'indonesian-badwords/metadata';

const checker = new Badwords({
  dictionary: selectDictionary({ categories: ['insult'], minSeverity: 2 }),
});

checker.flag('dasar goblok'); // => true
```

Selektornya adalah `profiles`, `categories`, `regions`, dan `minSeverity` (1 sampai 4). Kosakata regional mencakup bahasa Jawa, seperti `jancuk`, dan bahasa Sunda, seperti `kehed`. Tingkat keparahan menggambarkan satu entri kamus, bukan seluruh pesan. [Panduan kamus](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/dictionaries.md).

### Tangkap ejaan yang disamarkan dan salah ketik

`g0bl0k` dan teks full-width sudah cocok tanpa pengaturan apa pun. Kebijakan evasion dan fuzzy menangkap lebih banyak, tetapi juga mencocokkan kata biasa: dengan `maxEdits: 1`, `bangsa`, `kampung`, dan `kontrol` hanya berjarak satu edit dari kata di daftar. Uji dengan teks dari aplikasi Anda, dan arahkan kecocokan `fuzzy` ke peninjauan (resep pertama), jangan langsung disensor.

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

[Opsi evasion](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/evasion.md) · [Fuzzy matching](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/fuzzy-matching.md)

### Atur tampilan sensor dan pengecualiannya

```ts
import { Badwords } from 'indonesian-badwords';
import { mask } from 'indonesian-badwords/censor';

const plain = new Badwords();
plain.censor('dasar g0bl0k!', mask({ keepFirst: 1, keepLast: 1 })); // => 'dasar g****k!'
plain.censor('dasar g0bl0k!', ({ words }) => `[${words[0]}]`); // => 'dasar [goblok]!'

const checker = new Badwords({ allowPhrases: ['Baju Bodo'] });
checker.censor('Baju Bodo goblok bodo'); // => 'Baju Bodo *** ***'
checker.censor('goblok\nBaju Bodo goblok', '***', { ignoreRanges: [{ index: 0, end: 7 }] }); // => 'goblok\nBaju Bodo ***'
```

Frasa yang diizinkan hanya membebaskan dirinya sendiri, bukan sisa pesan. [Sensor](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/censoring.md) · [Pengecualian](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/exceptions.md)

### Beri highlight pada teks asli

`index` dan `end` adalah offset UTF-16 pada teks yang Anda berikan, dan `match` sama dengan `text.slice(index, end)`, bahkan setelah normalisasi.

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords();

checker.find('👩🏽‍💻 g0bl0k!').map(({ word, index, end, match }) => ({ word, index, end, match }));
// [{ word: 'goblok', index: 8, end: 14, match: 'g0bl0k' }]
```

## Kecepatan

Diukur dengan checker default di Node.js 24.22.1 (median benchmark sintetis setelah warmup, tanpa waktu setup).

<table>
  <tr>
    <td align="center" width="33%"><h3>1,77 µs</h3>Cek pesan ASCII tanpa kata kasar<br />280 karakter</td>
    <td align="center" width="33%"><h3>~12 KB</h3>Bundle browser default<br />minifikasi + gzip</td>
    <td align="center" width="33%"><h3>0</h3>Dependensi runtime</td>
  </tr>
</table>

| Teks | Operasi | Median |
| --- | --- | ---: |
| Paragraf ASCII tanpa kata kasar, 4.000 karakter | `flag` | 24,45 µs |
| Paragraf ASCII tanpa kata kasar, 4.000 karakter | `censor` | 5,56 µs |
| Aksen, emoji, dan satu kecocokan literal, 4.000 unit UTF-16 | `flag` | 29,79 µs |

Opsi tambahan punya biaya masing-masing. Jalankan `npm run benchmark` dari repository untuk mengukur runtime Anda. [Metodologi dan hasil lengkap](https://github.com/drizki/indonesian-badwords/blob/main/docs/performance.md).

## Dokumentasi

Panduan teknis tersedia dalam bahasa Inggris.

[Indeks dokumentasi](https://github.com/drizki/indonesian-badwords/blob/main/docs/README.md) · [Referensi API](https://github.com/drizki/indonesian-badwords/blob/main/docs/api.md) · [Kamus dan metadata](https://github.com/drizki/indonesian-badwords/blob/main/docs/metadata.md) · [Panduan moderasi chat](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/chat-moderation.md) · [Troubleshooting](https://github.com/drizki/indonesian-badwords/blob/main/docs/guides/troubleshooting.md) · [llms.txt](https://github.com/drizki/indonesian-badwords/blob/main/llms.txt)

## Kontribusi

Ada kata kasar yang lolos atau teks biasa yang ikut ditandai? Buka issue dengan contoh teks, hasil yang diharapkan, dan contoh serupa yang seharusnya aman. Untuk menambah entri kamus, sertakan sumber yang menunjukkan penggunaan kasarnya. Gunakan [form laporan kamus](https://github.com/drizki/indonesian-badwords/issues/new?template=dictionary-report.yml) dan baca [panduan kontribusi](https://github.com/drizki/indonesian-badwords/blob/main/docs/contributing.md).

Semoga bermanfaat 😉
