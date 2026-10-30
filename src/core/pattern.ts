export interface NativePatterns {
    simple: string;
    complex?: string;
    complexWords?: readonly string[];
    censor?: string;
    crossing?: string;
    crossingTrigger?: string;
}

// Assigned pictographs whose normalization and grapheme boundaries cannot
// change neighboring ASCII matches. Modifiers, marks and joiners are excluded.
export const NATIVE_EMOJI = String.raw`\u{1f300}-\u{1f3fa}\u{1f400}-\u{1f64f}\u{1f680}-\u{1f6d8}\u{1f6dc}-\u{1f6ec}\u{1f6f0}-\u{1f6fc}\u{1f900}-\u{1fa57}\u{1fa60}-\u{1fa6d}\u{1fa70}-\u{1fa7c}\u{1fa80}-\u{1fa8a}\u{1fa8e}-\u{1fac6}\u{1fac8}\u{1facd}-\u{1fadc}\u{1fadf}-\u{1faea}\u{1faef}-\u{1faf8}`;

const NATIVE_WORD = /^[a-z]+$/i;
const ALIASES: Readonly<Record<string, string>> = {
    a: '[a4@]', b: '[b8]', c: '[c(]', e: '[e3]', g: '[g69]',
    i: '[i1!|]', o: '[o0]', s: '[s5$]', t: '[t7]', z: '[z2]'
};
function escaped(word: string): string { return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function asciiWord(code: number): boolean {
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
}

function literalPattern(words: readonly string[]): string {
    const sorted = [...words].sort();
    function branch(from: number, to: number, offset: number): string {
        const optional = sorted[from].length === offset;
        if (optional && ++from === to) return '';
        const alternatives: string[] = [];
        while (from < to) {
            let end = from + 1;
            while (end < to && sorted[end][offset] === sorted[from][offset]) end++;
            let next = offset + 1;
            while (next < sorted[from].length && sorted[from][next] === sorted[end - 1][next]) next++;
            const prefix = sorted[from].slice(offset, next);
            alternatives.push(escaped(prefix) + branch(from, end, next));
            from = end;
        }
        const value = alternatives.length === 1 ? alternatives[0] : `(?:${alternatives.join('|')})`;
        return optional ? `(?:${value})?` : value;
    }
    return sorted.length ? branch(0, sorted.length, 0) : '(?!)';
}

/** Literal, bounded regex sources; shared by runtime custom dictionaries and the package build. */
export function prepareNativePatterns(words: readonly string[]): NativePatterns {
    const simple = literalPattern(words.filter((word) => NATIVE_WORD.test(word)));
    const complex = words.filter((word) => !NATIVE_WORD.test(word));
    const patterns: NativePatterns = { simple };
    if (complex.length) {
        patterns.complex = complex.map(escaped).join('|');
        patterns.complexWords = complex;
    }
    if (complex.length <= 16 && complex.every((word) => /^[a-z].*[a-z]$/i.test(word))) {
        // A longer phrase must precede any simple word it contains. Proper
        // crossing overlaps need the general scanner rather than replacement.
        patterns.censor = complex.length
            ? `${[...complex].sort((a, b) => b.length - a.length).map(escaped).join('|')}|${simple}` : simple;
        const crossing = new Set<string>();
        for (const left of complex) for (const right of complex) {
            for (let width = 1; width < Math.min(left.length, right.length); width++) {
                const cut = left.length - width;
                if (!asciiWord(left.charCodeAt(cut - 1)) && !asciiWord(right.charCodeAt(width))
                    && left.slice(cut) === right.slice(0, width)) crossing.add(left + right.slice(width));
            }
        }
        if (crossing.size) {
            patterns.crossing = [...crossing].map(escaped).join('|');
            const trigger = [...crossing][0].match(/[^a-z0-9]/i)?.[0];
            if (trigger && [...crossing].every((word) => word.includes(trigger))) patterns.crossingTrigger = trigger;
        }
    }
    return patterns;
}

/** A reject-only search: omit word and grapheme boundaries to keep a superset. */
export function canonicalCandidatePattern(prepared: NativePatterns, folding: boolean, global = false): RegExp | undefined {
    const literal = [prepared.complex, prepared.simple].filter(Boolean).join('|');
    const source = folding ? literal.replace(/[abcegiostz]/g, (letter) => ALIASES[letter]) : literal;
    return source.length <= 65_536 ? new RegExp(source, global ? 'gu' : 'u') : undefined;
}

/** A negative result proves that ASCII folding cannot create a dictionary occurrence. */
export function potentialPattern(words: readonly string[], bangOnly = false, prepared?: NativePatterns): RegExp {
    if (!bangOnly) {
        const literal = prepared ? [prepared.complex, prepared.simple].filter(Boolean).join('|') : literalPattern(words);
        const variants = literal.replace(/[abcegiostz]/g, (letter) => ALIASES[letter]);
        return new RegExp(`(?:^|[^a-z0-9])(?:${variants})(?![a-z0-9])|[^\\x00-\\x7f${NATIVE_EMOJI}]`, 'iu');
    }
    const patterns: string[] = [];
    let size = 0;
    for (const word of words) {
        const letters = [...word.toLowerCase()];
        for (let index = 0; index < letters.length; index++) {
            if (letters[index] === 'i') {
                const pattern = letters.map((letter, at) => at === index ? '!' : ALIASES[letter] ?? escaped(letter)).join('');
                size += pattern.length;
                if (size > 65_536) return new RegExp('[\\s\\S]');
                patterns.push(pattern);
            }
        }
    }
    return new RegExp(patterns.length ? patterns.join('|') : '(?!)', 'i');
}

/**
 * A cheap necessary test for the bang rewrite in word mode: a folded exclamation can only belong to a whole-word
 * match as an `i` with that word's own letters beside it (two either side, fewer past punctuation). The left and right
 * contexts are tested independently, which keeps the check a superset but lets the engine scan for `!` directly.
 * Undefined when the dictionary has characters this cannot reason about.
 */
export function bangCandidates(words: readonly string[]): RegExp | undefined {
    const groups = [0, 1, 2, 3].map(() => [new Set<string>(), new Set<string>()]);
    const side = (word: string, from: number, step: number): string => {
        const parts: string[] = [];
        for (let at = from; parts.length < 2 && at >= 0 && at < word.length; at += step) {
            const alphanumeric = /[a-z0-9]/i.test(word[at]);
            parts.push(ALIASES[word[at]] ?? (alphanumeric ? word[at] : '[^a-z0-9]'));
            if (!alphanumeric) break;
        }
        return (step < 0 ? parts.reverse() : parts).join('');
    };
    for (const word of words) {
        if (!/^[\x00-\x7f]*$/.test(word)) return;
        for (let index = word.indexOf('i'); index >= 0; index = word.indexOf('i', index + 1)) {
            const left = side(word, index - 1, -1), right = side(word, index + 1, 1);
            const [lefts, rights] = groups[(left ? 1 : 0) | (right ? 2 : 0)];
            lefts.add(left);
            rights.add(right);
        }
    }
    if (groups[0][0].size) return /!/;
    const terms = groups.map(([lefts, rights], key) => lefts.size ? `${key & 1 ? `(?<=(?:${[...lefts].join('|')})!)` : ''}${key & 2 ? `(?=${[...rights].join('|')})` : ''}` : '');
    return new RegExp(`!(?:${terms.filter(Boolean).join('|') || '(?!)'})`, 'i');
}
