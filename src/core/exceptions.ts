import type { CheckOptions, IgnoreRange } from '../index.ts';
import { Matcher } from './matcher.ts';
import { normalizeLiteral, sourceBoundaryChecker, trimDictionaryWord, type Normalization } from '../text/normalize.ts';

export type MatchAcceptance = (start: number, end: number) => boolean;

/** Literal allow phrases have their own immutable, dictionary-independent matcher. */
export class AllowedPhrases {
    readonly #matcher: Matcher;
    readonly #normalization: Normalization;

    constructor(phrases: readonly string[], normalization: Normalization) {
        const keys = new Set<string>();
        for (const phrase of phrases) {
            if (typeof phrase !== 'string') throw new TypeError('allowPhrases entries must be strings');
            const key = trimDictionaryWord(normalizeLiteral(trimDictionaryWord(phrase), normalization).text);
            if (!key) throw new RangeError('allowPhrases entries must contain literal text');
            keys.add(key);
        }
        this.#normalization = normalization;
        this.#matcher = new Matcher([...keys].map((key, order) => ({ key, word: key, order })));
    }

    containment(text: string): MatchAcceptance {
        const spans: IgnoreRange[] = [];
        this.#matcher.scan(normalizeLiteral(text, this.#normalization), true, ({ start, end }) => {
            // End-ordered occurrences can discard individually contained spans.
            // Never union overlaps: two phrases cannot grant a larger exemption.
            while (spans.length && spans[spans.length - 1].index >= start) spans.pop();
            if (!spans.length || spans[spans.length - 1].end < end) spans.push({ index: start, end });
        }, true);
        return (start, end) => {
            let low = 0;
            let high = spans.length;
            while (low < high) {
                const middle = (low + high) >>> 1;
                if (spans[middle].index <= start) low = middle + 1;
                else high = middle;
            }
            return low > 0 && spans[low - 1].end >= end;
        };
    }
}

export function compileAllowedPhrases(phrases: readonly string[] | undefined,
    normalization: Normalization): AllowedPhrases | undefined {
    if (phrases === undefined) return;
    if (!Array.isArray(phrases)) throw new TypeError('allowPhrases must be an array of strings');
    return phrases.length ? new AllowedPhrases(phrases, normalization) : undefined;
}

function ignoredRanges(text: string, options: CheckOptions | undefined): IgnoreRange[] | undefined {
    if (options === undefined) return;
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw new TypeError('check options must be an object');
    }
    const input = options.ignoreRanges;
    if (input === undefined) return;
    if (!Array.isArray(input)) throw new TypeError('ignoreRanges must be an array');
    if (!input.length) return;
    const copied: IgnoreRange[] = [];
    for (const range of input) {
        if (!range || typeof range !== 'object' || Array.isArray(range)) {
            throw new TypeError('ignoreRanges entries must be objects');
        }
        const { index, end } = range;
        if (typeof index !== 'number' || typeof end !== 'number') {
            throw new TypeError('ignoreRanges bounds must be numbers');
        }
        if (!Number.isInteger(index) || !Number.isInteger(end) || index < 0 || end < index || end > text.length) {
            throw new RangeError('ignoreRanges bounds must be integers within the input');
        }
        copied.push({ index, end });
    }
    const boundary = sourceBoundaryChecker(text);
    for (const { index, end } of copied) {
        if (!boundary(index) || !boundary(end)) {
            throw new RangeError('ignoreRanges bounds must be complete source grapheme boundaries');
        }
    }
    copied.sort((a, b) => a.index - b.index || a.end - b.end);
    const union: IgnoreRange[] = [];
    for (const range of copied) {
        if (range.index === range.end) continue;
        const previous = union[union.length - 1];
        if (previous && range.index <= previous.end) {
            union[union.length - 1] = { index: previous.index, end: Math.max(previous.end, range.end) };
        } else union.push(range);
    }
    return union.length ? union : undefined;
}

/** Prepare source exceptions once; phrase normalization stays lazy on clean input. */
export function matchAcceptance(text: string, options: CheckOptions | undefined,
    allowed: AllowedPhrases | undefined): MatchAcceptance | undefined {
    const ranges = ignoredRanges(text, options);
    if (!ranges && !allowed) return;
    let contained: MatchAcceptance | undefined;
    return (start, end) => {
        if (ranges) {
            let low = 0;
            let high = ranges.length;
            while (low < high) {
                const middle = (low + high) >>> 1;
                if (ranges[middle].end <= start) low = middle + 1;
                else high = middle;
            }
            if (low < ranges.length && ranges[low].index < end) return false;
        }
        if (allowed) {
            contained ??= allowed.containment(text);
            if (contained(start, end)) return false;
        }
        return true;
    };
}
