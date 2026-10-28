import type { CensorCallback, CensorContext } from './index.ts';
export type { CensorCallback, CensorContext, CensorReplacement } from './index.ts';

/** Counts of original graphemes to preserve; first takes priority when clamped. */
export interface KeepOptions {
    keepFirst?: number;
    keepLast?: number;
}
export interface MaskOptions extends KeepOptions {
    /** One visible standalone, well-formed grapheme. Defaults to `*`. */
    character?: string;
}
export interface GrawlixOptions extends KeepOptions {
    /** A string of symbols or an array of individual graphemes. Defaults to `@#$%!`. */
    symbols?: string | readonly string[];
    /** Called once per replacement symbol; must return a number in [0, 1). */
    random?: () => number;
}

let segmenter: Intl.Segmenter | undefined;
function graphemes(text: string): string[] {
    segmenter ??= new Intl.Segmenter('id', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), ({ segment }) => segment);
}
function optionsObject(value: unknown): asserts value is object {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('options must be an object');
}
function keepCount(value: unknown, name: string): number {
    if (value === undefined) return 0;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw new TypeError(`${name} must be a nonnegative safe integer`);
    }
    return value;
}
function symbol(value: unknown, name: string): string {
    if (typeof value !== 'string' || !value || /[\ud800-\udfff]/u.test(value)
        || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(value)
        // Standalone format controls and default-ignorable letters (including
        // Hangul fillers) can pass segmentation while producing an empty mask.
        // Complete emoji may contain ZWJ, tags or variation selectors; require
        // a visible base, and retain the stable-boundary checks below.
        || /^[\p{Cf}\p{M}\p{White_Space}\p{Default_Ignorable_Code_Point}]+$/u.test(value)
        || graphemes(value).length !== 1 || graphemes(value + value).length !== 2
        || graphemes(`A${value}A`).length !== 3) {
        throw new TypeError(`${name} must be one visible standalone, well-formed grapheme without control characters`);
    }
    return value;
}
function rewrite(context: CensorContext, keepFirst: number, keepLast: number, choose: () => string): string {
    if (!context || typeof context.match !== 'string') throw new TypeError('censor context match must be a string');
    const parts = graphemes(context.match);
    if (!parts.length) return '';
    const first = Math.min(keepFirst, parts.length - 1);
    const last = Math.min(keepLast, parts.length - first - 1);
    for (let index = first; index < parts.length - last; index++) parts[index] = choose();
    return parts.join('');
}

/** Replace original graphemes, preserving configured edges and masking at least one. */
export function mask(options: MaskOptions = {}): CensorCallback {
    optionsObject(options);
    const character = symbol(options.character === undefined ? '*' : options.character, 'character');
    const first = keepCount(options.keepFirst, 'keepFirst');
    const last = keepCount(options.keepLast, 'keepLast');
    const choose = (): string => character;
    return (context) => rewrite(context, first, last, choose);
}

/** Replace original graphemes with symbols selected by the supplied random source. */
export function grawlix(options: GrawlixOptions = {}): CensorCallback {
    optionsObject(options);
    const value = options.symbols === undefined ? '@#$%!' : options.symbols;
    if (typeof value !== 'string' && !Array.isArray(value)) throw new TypeError('symbols must be a string or an array of graphemes');
    const symbols = (typeof value === 'string' ? graphemes(value) : Array.from(value)).map((value) => symbol(value, 'symbol'));
    if (!symbols.length) throw new TypeError('symbols must contain at least one grapheme');
    const random = options.random === undefined ? Math.random : options.random;
    if (typeof random !== 'function') throw new TypeError('random must be a function');
    const first = keepCount(options.keepFirst, 'keepFirst');
    const last = keepCount(options.keepLast, 'keepLast');
    const choose = (): string => {
        const value = random();
        if (typeof value !== 'number') throw new TypeError('random must return a number');
        if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must return a finite number in [0, 1)');
        return symbols[Math.floor(value * symbols.length)];
    };
    return (context) => rewrite(context, first, last, choose);
}
