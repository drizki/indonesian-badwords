import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

// Informational measurements, not CI timing assertions. Run after npm run build.
// Each case has a separate process, a 256 MiB V8 heap, and a 20-second timeout.
// maxRSS includes import, construction, warmups, and measurements for that case.
const worker = process.argv.includes('--worker');
const quick = process.argv.includes('--quick');

function repeatToLength(text, length) {
    return text.repeat(Math.ceil(length / text.length)).slice(0, length);
}

function alphabeticId(number) {
    let output = '';
    do {
        output = String.fromCharCode(97 + number % 26) + output;
        number = Math.floor(number / 26);
    } while (number > 0);
    return output;
}

function makeInput(kind) {
    switch (kind) {
        case 'chat-clean':
            return repeatToLength('Apa kabar? Pesanan sudah sampai. Terima kasih atas bantuannya. ', 280);
        case 'paragraph-clean':
            return repeatToLength('Kami mengembangkan layanan pendidikan bagi masyarakat. Pendaftaran dibuka besok pagi. ', 4_000);
        case 'long-token':
            return repeatToLength('pengembanganinfrastrukturpendidikan', 64_000);
        case 'chat-leetspeak':
            return repeatToLength('D4s4r g0bl0k! Jangan ganggu kami lagi. ', 280);
        case 'dense-occurrences':
            return repeatToLength('kontol goblok ngentot ', 20_000);
        case 'unicode':
            return repeatToLength('😀 Pesan: ＧＯＢＬＯＫ dan kon\u200btol. ', 4_000);
        case 'overlapping-prefixes':
            return 'a'.repeat(5_000);
        default:
            throw new Error(`Unknown input kind: ${kind}`);
    }
}

async function measure(job) {
    const { Badwords } = await import('../dist/esm/index.js');
    const options = job.dictionary?.startsWith('prefixes')
        ? { dictionary: Array.from({ length: 64 }, (_, index) => 'a'.repeat(index + 1)),
            mode: job.dictionary === 'prefixes-word' ? 'word' : 'substring' }
        : job.dictionary === 'large-custom'
            ? { dictionary: Array.from({ length: 10_000 }, (_, index) => `x${alphabeticId(index)}x`) }
            : {};
    const text = makeInput(job.input);
    const constructorStart = performance.now();
    const detector = new Badwords(options);
    const constructionMs = performance.now() - constructorStart;
    globalThis.gc?.();
    const baselineHeapMiB = process.memoryUsage().heapUsed / 1_048_576;
    const baselineMaxRssMiB = process.resourceUsage().maxRSS / 1_024;
    const times = [];
    let result;
    let operationStart;

    try {
        for (let index = 0; index < job.warmups; index++) detector[job.method](text);
        for (let index = 0; index < job.iterations; index++) {
            operationStart = performance.now();
            result = detector[job.method](text);
            times.push(performance.now() - operationStart);
        }
    } catch (error) {
        if (!job.allowLimit || !(error instanceof RangeError)) throw error;
        return {
            id: job.id,
            method: job.method,
            inputChars: text.length,
            dictionaryTerms: detector.dict.length,
            status: 'limited',
            message: error.message,
            maxRssMiB: Number((process.resourceUsage().maxRSS / 1_024).toFixed(2))
        };
    }

    times.sort((left, right) => left - right);
    globalThis.gc?.();
    return {
        id: job.id,
        method: job.method,
        inputChars: text.length,
        dictionaryTerms: detector.dict.length,
        status: 'measured',
        warmups: job.warmups,
        iterations: job.iterations,
        constructionMs: Number(constructionMs.toFixed(3)),
        medianMs: Number(times[Math.floor(times.length / 2)].toFixed(3)),
        p95Ms: Number(times[Math.ceil(times.length * 0.95) - 1].toFixed(3)),
        baselineHeapMiB: Number(baselineHeapMiB.toFixed(2)),
        endingHeapMiB: Number((process.memoryUsage().heapUsed / 1_048_576).toFixed(2)),
        baselineMaxRssMiB: Number(baselineMaxRssMiB.toFixed(2)),
        maxRssMiB: Number((process.resourceUsage().maxRSS / 1_024).toFixed(2)),
        resultSize: typeof result === 'boolean' ? Number(result)
            : Array.isArray(result) || typeof result === 'string' ? result.length
                : result.locations.length
    };
}

if (worker) {
    try {
        const job = JSON.parse(readFileSync(0, 'utf8'));
        console.log(JSON.stringify(await measure(job)));
    } catch (error) {
        console.error(`${error.name}: ${error.message}`);
        process.exitCode = 1;
    }
} else {
    const jobs = [
        ['clean-chat-280', 'chat-clean', 'flag'],
        ['clean-paragraph-4000-flag', 'paragraph-clean', 'flag'],
        ['clean-paragraph-4000-analyze', 'paragraph-clean', 'analyze'],
        ['benign-token-64000', 'long-token', 'flag'],
        ['leetspeak-chat-280', 'chat-leetspeak', 'censor'],
        ['dense-20000-unique-terms', 'dense-occurrences', 'badwords'],
        ['dense-20000-find', 'dense-occurrences', 'find'],
        ['dense-20000-censor', 'dense-occurrences', 'censor'],
        ['dense-20000-analyze', 'dense-occurrences', 'analyze'],
        ['unicode-4000-flag', 'unicode', 'flag'],
        ['unicode-4000-analyze', 'unicode', 'analyze'],
        ['custom-10000-terms', 'paragraph-clean', 'flag', 'large-custom'],
        ['overlap-5000-word-clean', 'overlapping-prefixes', 'flag', 'prefixes-word'],
        ['overlap-5000-flag', 'overlapping-prefixes', 'flag', 'prefixes'],
        ['overlap-5000-unique-terms', 'overlapping-prefixes', 'badwords', 'prefixes'],
        ['overlap-5000-find', 'overlapping-prefixes', 'find', 'prefixes'],
        ['overlap-5000-censor', 'overlapping-prefixes', 'censor', 'prefixes'],
        ['overlap-5000-analyze', 'overlapping-prefixes', 'analyze', 'prefixes']
    ];

    console.log(JSON.stringify({
        type: 'environment',
        node: process.version,
        v8: process.versions.v8,
        platform: process.platform,
        architecture: process.arch,
        measurements: 'Informational local measurements; synthetic workloads do not establish real-world accuracy or throughput.',
        memory: 'RSS is peak for the isolated case process, including import, construction, warmups, and measurements; V8 heap cap is 256 MiB.',
        limits: 'An explicit RangeError is recorded as limited for adversarial overlap workloads; other errors, child failures, or the 20-second resource timeout fail the script.'
    }));

    for (const [id, input, method, dictionary] of jobs) {
        const job = {
            id, input, method, dictionary,
            warmups: quick ? 1 : 5,
            iterations: quick ? 3 : 15,
            allowLimit: dictionary === 'prefixes'
        };
        const child = spawnSync(process.execPath, [
            '--max-old-space-size=256', '--expose-gc', fileURLToPath(import.meta.url), '--worker'
        ], {
            input: JSON.stringify(job),
            encoding: 'utf8',
            timeout: 20_000,
            maxBuffer: 1_048_576
        });
        if (child.error || child.status !== 0) {
            console.error(JSON.stringify({
                id, status: 'failed', signal: child.signal,
                message: child.error?.message ?? child.stderr.trim()
            }));
            process.exitCode = 1;
            break;
        }
        console.log(child.stdout.trim());
    }
}
