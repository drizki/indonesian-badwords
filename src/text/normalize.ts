/** Standard normalization is case-insensitive; `none` preserves exact spelling. */
export type Normalization = 'standard' | 'none';

export interface NormalizedText {
    text: string;
    starts: number[];
    ends: number[];
    wordCharacters: boolean[];
}

const ASCII = /^[\x00-\x7f]*$/;
let wordRegex: RegExp | undefined;
let letterRegex: RegExp | undefined;
let ignorableRegex: RegExp | undefined;
let simpleSourceRegex: RegExp | undefined;
let simpleCanonicalRegex: RegExp | undefined;
let caseChangeRegex: RegExp | undefined;

// Pattern strings defer Unicode property parsing until Unicode work is needed.
// A regex literal inside a getter is still parsed when the module is loaded.
function wordPattern(): RegExp {
    return wordRegex ??= new RegExp('[\\p{L}\\p{N}\\p{M}]', 'u');
}
function letterPattern(): RegExp {
    return letterRegex ??= new RegExp('\\p{L}', 'u');
}
function ignorablePattern(): RegExp {
    return ignorableRegex ??= new RegExp('\\p{Default_Ignorable_Code_Point}', 'gu');
}
function simpleSourcePattern(): RegExp {
    return simpleSourceRegex ??= new RegExp(
        '^[\\x00-\\x7f\\uff01-\\uff5e\\u3000\\u200b\\u00ad\\u2060\\ufeff\\p{Extended_Pictographic}]*$', 'u');
}
function simpleCanonicalPattern(): RegExp {
    return simpleCanonicalRegex ??= new RegExp('^[\\x00-\\x7f\\p{Extended_Pictographic}]*$', 'u');
}
let segmenter: Intl.Segmenter | undefined;
function graphemes(text: string): Intl.Segments {
    return (segmenter ??= new Intl.Segmenter('id', { granularity: 'grapheme' })).segment(text);
}
const SUBSTITUTIONS: Readonly<Record<string, string>> = {
    '4': 'a', '@': 'a', '8': 'b', '(': 'c', '3': 'e', '6': 'g', '9': 'g',
    '1': 'i', '!': 'i', '|': 'i', '0': 'o', '5': 's', '$': 's', '7': 't', '2': 'z'
};

// ASCII characters have one source unit and cannot compose or expand. Keep
// their lexical classes and substitutions in compact tables rather than
// allocating intermediate Unicode Unit objects for ordinary chat messages.
// Flags: word = 1, letter = 2, substitution = 4, joining symbol = 8.
const ASCII_FLAGS = new Uint8Array(128);
const ASCII_FOLDED = Uint8Array.from({ length: 128 }, (_, code) => code);
for (let code = 48; code <= 57; code++) ASCII_FLAGS[code] = 1;
for (let code = 65; code <= 90; code++) ASCII_FLAGS[code] = 3;
for (let code = 97; code <= 122; code++) ASCII_FLAGS[code] = 3;
for (const [character, replacement] of Object.entries(SUBSTITUTIONS)) {
    const code = character.charCodeAt(0);
    ASCII_FOLDED[code] = replacement.charCodeAt(0);
    ASCII_FLAGS[code] |= 4 | (ASCII_FLAGS[code] & 1 ? 0 : 8);
}

function asciiJoin(text: string, index: number, code: number,
    literalBangs?: true | ReadonlySet<number>, sourceStarts?: readonly number[]): boolean {
    return Boolean(ASCII_FLAGS[code] & 8) && index > 0 && index + 1 < text.length
        && Boolean(ASCII_FLAGS[text.charCodeAt(index - 1)] & 1)
        && Boolean(ASCII_FLAGS[text.charCodeAt(index + 1)] & 1)
        && !(code === 33 && (literalBangs === true || literalBangs?.has(sourceStarts?.[index] ?? index)));
}

function foldAscii(text: string, literalBangs?: true | ReadonlySet<number>,
    sourceStarts?: readonly number[]): string {
    const value = text.toLowerCase();
    const pieces: string[] = [];
    let copied = 0;
    let from = 0;
    while (from < value.length) {
        const code = value.charCodeAt(from);
        if (!(ASCII_FLAGS[code] & 1) && !asciiJoin(value, from, code, literalBangs, sourceStarts)) {
            from++;
            continue;
        }
        let to = from;
        let flags = 0;
        while (to < value.length) {
            const code = value.charCodeAt(to);
            if (!(ASCII_FLAGS[code] & 1) && !asciiJoin(value, to, code, literalBangs, sourceStarts)) break;
            flags |= ASCII_FLAGS[code];
            to++;
        }
        // Numeric-only runs stay literal. Symbols join only when both original
        // neighbors are alphanumeric, before any substitutions are applied.
        if ((flags & 2) && (flags & 4)) {
            for (let index = from; index < to; index++) {
                const code = value.charCodeAt(index);
                if (ASCII_FOLDED[code] !== code) {
                    pieces.push(value.slice(copied, index), String.fromCharCode(ASCII_FOLDED[code]));
                    copied = index + 1;
                }
            }
        }
        from = to;
    }
    return copied ? pieces.join('') + value.slice(copied) : value;
}

function normalizeAscii(text: string, normalization: Normalization, ignoreRepeatedLetters: boolean,
    literalBangs?: true | ReadonlySet<number>): NormalizedText {
    const value = normalization === 'standard' ? foldAscii(text, literalBangs) : text;
    if (!ignoreRepeatedLetters) {
        const starts = new Array<number>(value.length);
        const ends = new Array<number>(value.length);
        const wordCharacters = new Array<boolean>(value.length);
        for (let index = 0; index < value.length; index++) {
            starts[index] = index;
            ends[index] = index + 1;
            wordCharacters[index] = Boolean(ASCII_FLAGS[value.charCodeAt(index)] & 1);
        }
        return { text: value, starts, ends, wordCharacters };
    }

    const result: NormalizedText = { text: '', starts: [], ends: [], wordCharacters: [] };
    const characters: string[] = [];
    let previous = -1;
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        if (code === previous && (ASCII_FLAGS[code] & 2)) {
            result.ends[result.ends.length - 1] = index + 1;
        } else {
            characters.push(value[index]);
            result.starts.push(index);
            result.ends.push(index + 1);
            result.wordCharacters.push(Boolean(ASCII_FLAGS[code] & 1));
        }
        previous = code;
    }
    result.text = characters.join('');
    return result;
}

/**
 * These source atoms are complete graphemes without contextual composition.
 * Marks, modifiers, joiners, regional indicators, Jamo and other scripts take
 * the general path. Compatibility symbols that introduce other letters or
 * marks also fall back after the native normalization check.
 */
function simpleCanonical(text: string): string | undefined {
    if (!simpleSourcePattern().test(text)) return undefined;
    const canonical = text.replace(ignorablePattern(), '').normalize('NFKC').toLowerCase();
    return simpleCanonicalPattern().test(canonical) ? canonical : undefined;
}

/** Whether one source atom belongs to the existing inexpensive Unicode path. */
export function isSimpleUnicodeAtom(character: string): boolean {
    return simpleCanonical(character) !== undefined;
}

/** The pre-substitution text, without allocating original-source span maps. */
export function canonicalSearchText(text: string): string {
    return text.normalize('NFKD').replace(ignorablePattern(), '').normalize('NFKC').toLowerCase();
}

/** Stable sources need no decomposition or source maps for candidate discovery. */
export function canonicalSearchView(text: string): { text: string; identity: boolean } {
    const identity = text.normalize('NFKC') === text && text.replace(ignorablePattern(), '') === text;
    return { text: identity ? text.toLowerCase() : canonicalSearchText(text), identity };
}

export function previousCodePoint(text: string, index: number): number {
    index--;
    if (index > 0 && text.charCodeAt(index) >= 0xdc00 && text.charCodeAt(index) <= 0xdfff
        && text.charCodeAt(index - 1) >= 0xd800 && text.charCodeAt(index - 1) <= 0xdbff) index--;
    return index;
}

export function wordAt(text: string, index: number): boolean {
    if (index < 0 || index >= text.length) return false;
    const code = text.charCodeAt(index);
    return code < 128 ? Boolean(ASCII_FLAGS[code] & 1)
        : wordPattern().test(String.fromCodePoint(text.codePointAt(index)!));
}

function joinedAt(text: string, index: number): boolean {
    if (wordAt(text, index)) return true;
    const code = text.charCodeAt(index);
    return code !== 33 && Boolean(ASCII_FLAGS[code] & 8)
        && wordAt(text, previousCodePoint(text, index)) && wordAt(text, index + 1);
}

const CANDIDATE_SUBSTITUTIONS = /[0-9@$(|!]/g;
/** Inspect only substitution-containing runs; internal bangs retain dictionary-dependent handling. */
export function foldCandidateText(text: string): string | undefined {
    CANDIDATE_SUBSTITUTIONS.lastIndex = 0;
    const pieces: string[] = [];
    let copied = 0;
    let occurrence: RegExpExecArray | null;
    while ((occurrence = CANDIDATE_SUBSTITUTIONS.exec(text)) !== null) {
        const at = occurrence.index;
        if (occurrence[0] === '!') {
            // Only a lone bang can sit between word characters; skip the rest of a run.
            if (text[at + 1] === '!') while (text[CANDIDATE_SUBSTITUTIONS.lastIndex] === '!') CANDIDATE_SUBSTITUTIONS.lastIndex++;
            else if (wordAt(text, previousCodePoint(text, at)) && wordAt(text, at + 1)) return;
            continue;
        }
        if (!joinedAt(text, at)) continue;
        let start = at;
        while (start > 0) {
            const previous = previousCodePoint(text, start);
            if (!joinedAt(text, previous)) break;
            start = previous;
        }
        let end = at + 1;
        while (end < text.length && joinedAt(text, end)) end += text.codePointAt(end)! > 0xffff ? 2 : 1;
        let hasLetter = false;
        for (let index = start; index < end; index += text.codePointAt(index)! > 0xffff ? 2 : 1) {
            const code = text.charCodeAt(index);
            if (code < 128 ? ASCII_FLAGS[code] & 2
                : letterPattern().test(String.fromCodePoint(text.codePointAt(index)!))) {
                hasLetter = true;
                break;
            }
        }
        if (hasLetter) {
            const value = text.slice(start, end).replace(/[0-9@$(|]/g, character => SUBSTITUTIONS[character]);
            pieces.push(text.slice(copied, start), value);
            copied = end;
        }
        CANDIDATE_SUBSTITUTIONS.lastIndex = end;
    }
    return copied ? pieces.join('') + text.slice(copied) : text;
}

/** Check changing non-ASCII case mappings without walking ordinary lowercase text. */
export function caseWidthStable(text: string): boolean {
    const pattern = caseChangeRegex ??= new RegExp('(?=[^\\x00-\\x7f])(?:\\p{Uppercase}|\\p{Lt})', 'gu');
    pattern.lastIndex = 0;
    let occurrence: RegExpExecArray | null;
    while ((occurrence = pattern.exec(text)) !== null) {
        if (occurrence[0].toLowerCase().length !== occurrence[0].length) return false;
    }
    return true;
}

function normalizeSimpleUnicode(text: string, ignoreRepeatedLetters: boolean,
    literalBangs?: true | ReadonlySet<number>): NormalizedText | undefined {
    const canonical = simpleCanonical(text);
    if (canonical === undefined) return undefined;

    const starts = new Array<number>(canonical.length);
    const ends = new Array<number>(canonical.length);
    let sourceIndex = 0;
    let outputIndex = 0;
    for (const character of text) {
        const code = character.codePointAt(0)!;
        const sourceEnd = sourceIndex + character.length;
        if (code !== 0x200b && code !== 0x00ad && code !== 0x2060 && code !== 0xfeff) {
            const width = code < 128 || (code >= 0xff01 && code <= 0xff5e) || code === 0x3000
                ? 1 : character.normalize('NFKC').length;
            for (let unit = 0; unit < width; unit++) {
                starts[outputIndex] = sourceIndex;
                ends[outputIndex++] = sourceEnd;
            }
        }
        sourceIndex = sourceEnd;
    }
    // CRLF is one grapheme, including pairs brought together by removing an
    // ignorable control. Preserve both source atoms as one complete span.
    for (let index = 0; index + 1 < canonical.length; index++) {
        if (canonical.charCodeAt(index) === 13 && canonical.charCodeAt(index + 1) === 10) {
            starts[index + 1] = starts[index];
            ends[index] = ends[index + 1];
        }
    }

    const value = foldAscii(canonical, literalBangs, starts);
    if (!ignoreRepeatedLetters) {
        const wordCharacters = new Array<boolean>(value.length);
        for (let index = 0; index < value.length; index++) {
            wordCharacters[index] = Boolean(ASCII_FLAGS[value.charCodeAt(index)] & 1);
        }
        return { text: value, starts, ends, wordCharacters };
    }

    const result: NormalizedText = { text: '', starts: [], ends: [], wordCharacters: [] };
    const characters: string[] = [];
    let previous = -1;
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        if (code === previous && (ASCII_FLAGS[code] & 2)) {
            result.ends[result.ends.length - 1] = ends[index];
        } else {
            characters.push(value[index]);
            result.starts.push(starts[index]);
            result.ends.push(ends[index]);
            result.wordCharacters.push(Boolean(ASCII_FLAGS[code] & 1));
        }
        previous = code;
    }
    result.text = characters.join('');
    return result;
}

/** Exact Unicode input needs source segmentation once, without normalization intermediates. */
function normalizeExactUnicode(text: string, ignoreRepeatedLetters: boolean): NormalizedText {
    const result: NormalizedText = { text,
        starts: ignoreRepeatedLetters ? [] : new Array<number>(text.length),
        ends: ignoreRepeatedLetters ? [] : new Array<number>(text.length),
        wordCharacters: ignoreRepeatedLetters ? [] : new Array<boolean>(text.length) };
    const characters: string[] = [];
    let previous = '';
    let outputIndex = 0;
    for (const { segment, index } of graphemes(text)) {
        const end = index + segment.length;
        for (const character of segment) {
            if (ignoreRepeatedLetters && character === previous && letterPattern().test(character)) {
                for (let unit = outputIndex - character.length; unit < outputIndex; unit++) {
                    result.ends[unit] = end;
                }
            } else {
                if (ignoreRepeatedLetters) characters.push(character);
                const isWord = wordPattern().test(character);
                for (let unit = 0; unit < character.length; unit++) {
                    result.starts[outputIndex] = index;
                    result.ends[outputIndex] = end;
                    result.wordCharacters[outputIndex++] = isWord;
                }
            }
            previous = character;
        }
    }
    if (ignoreRepeatedLetters) result.text = characters.join('');
    return result;
}

interface Unit { character: string; start: number; end: number }

/** Trim only complete whitespace graphemes, keeping normalization keys portable. */
export function trimDictionaryWord(text: string): string {
    if (ASCII.test(text)) return text.trim();
    let start = -1;
    let end = 0;
    for (const { segment, index } of graphemes(text)) {
        if (!/^\s+$/u.test(segment)) {
            if (start === -1) start = index;
            end = index + segment.length;
        }
    }
    return start === -1 ? '' : text.slice(start, end);
}

function unicodeUnits(text: string, normalization: Normalization): Unit[] {
    // Decompose original graphemes BEFORE resegmentation: compatibility Jamo,
    // for example, can compose across original character boundaries.
    const decomposed: string[] = [];
    const starts: number[] = [];
    const ends: number[] = [];
    for (const { segment, index } of graphemes(text)) {
        const value = normalization === 'standard'
            ? segment.normalize('NFKD').replace(ignorablePattern(), '') : segment;
        decomposed.push(value);
        for (let unit = 0; unit < value.length; unit++) {
            starts.push(index);
            ends.push(index + segment.length);
        }
    }

    const composed: string[] = [];
    const composedStarts: number[] = [];
    const composedEnds: number[] = [];
    for (const { segment, index: start } of graphemes(decomposed.join(''))) {
        const end = start + segment.length;
        const value = normalization === 'standard' ? segment.normalize('NFKC') : segment;
        composed.push(value);
        for (let unit = 0; unit < value.length; unit++) {
            composedStarts.push(starts[start]);
            composedEnds.push(ends[end - 1]);
        }
    }

    const canonical = composed.join('');
    const lowercase = normalization === 'standard' ? canonical.toLowerCase() : canonical;
    const result: Unit[] = [];
    let lowerIndex = 0;
    let canonicalIndex = 0;
    for (const character of canonical) {
        const width = normalization === 'standard' ? character.toLowerCase().length : character.length;
        for (const lowered of lowercase.slice(lowerIndex, lowerIndex + width)) {
            result.push({ character: lowered, start: composedStarts[canonicalIndex],
                end: composedEnds[canonicalIndex + character.length - 1] });
        }
        canonicalIndex += character.length;
        lowerIndex += width;
    }
    return result;
}

function recompose(units: Unit[]): Unit[] {
    const text = units.map(({ character }) => character).join('');
    // Source graphemes are already complete. Lowercasing and ASCII folding
    // preserve their boundaries; only newly composable output needs another
    // segmentation pass and a fresh set of provenance arrays.
    if (ASCII.test(text) || text.normalize('NFKC') === text) return units;
    const starts: number[] = [];
    const ends: number[] = [];
    for (const unit of units) {
        for (let offset = 0; offset < unit.character.length; offset++) {
            starts.push(unit.start);
            ends.push(unit.end);
        }
    }
    const result: Unit[] = [];
    for (const { segment, index } of graphemes(text)) {
        for (const character of segment.normalize('NFKC')) {
            result.push({ character, start: starts[index], end: ends[index + segment.length - 1] });
        }
    }
    return result;
}

/** Literal phrase matching shares Unicode provenance but never folds leetspeak or repeats. */
export function normalizeLiteral(text: string, normalization: Normalization): NormalizedText {
    if (ASCII.test(text)) {
        const result = normalizeAscii(normalization === 'standard' ? text.toLowerCase() : text, 'none', false);
        for (let index = 0; index + 1 < text.length; index++) {
            if (text.charCodeAt(index) === 13 && text.charCodeAt(index + 1) === 10) {
                result.starts[index + 1] = result.starts[index];
                result.ends[index] = result.ends[index + 1];
            }
        }
        return result;
    }
    if (normalization === 'none') return normalizeExactUnicode(text, false);
    const result: NormalizedText = { text: '', starts: [], ends: [], wordCharacters: [] };
    const characters: string[] = [];
    for (const unit of recompose(unicodeUnits(text, 'standard'))) {
        characters.push(unit.character);
        const code = unit.character.charCodeAt(0);
        const isWord = code < 128 ? Boolean(ASCII_FLAGS[code] & 1) : wordPattern().test(unit.character);
        for (let offset = 0; offset < unit.character.length; offset++) {
            result.starts.push(unit.start);
            result.ends.push(unit.end);
            result.wordCharacters.push(isWord);
        }
    }
    result.text = characters.join('');
    return result;
}

/** Original source boundaries, deferring segmentation until a non-ASCII edge needs it. */
export function sourceBoundaryChecker(text: string): (index: number) => boolean {
    let segments: Intl.Segments | undefined;
    return (index) => {
        if (index === 0 || index === text.length) return true;
        const left = text.charCodeAt(index - 1), right = text.charCodeAt(index);
        // Adjacent ASCII scalars break under UAX29, except CR × LF.
        if (left < 128 && right < 128) return left !== 13 || right !== 10;
        segments ??= graphemes(text);
        return segments.containing(index)?.index === index;
    };
}

/** Dictionary keys do not need source provenance. */
export function normalizeKey(text: string, normalization: Normalization): string {
    if (normalization === 'none') return text;
    if (ASCII.test(text)) return foldAscii(text);
    const canonical = simpleCanonical(text);
    return canonical === undefined ? normalize(text, normalization).text : foldAscii(canonical);
}

/** Normalize while preserving complete source grapheme/expansion boundaries. */
export function normalize(text: string, normalization: Normalization, ignoreRepeatedLetters = false,
    literalBangs?: true | ReadonlySet<number>): NormalizedText {
    if (ASCII.test(text)) return normalizeAscii(text, normalization, ignoreRepeatedLetters, literalBangs);
    if (normalization === 'none') return normalizeExactUnicode(text, ignoreRepeatedLetters);
    const simple = normalizeSimpleUnicode(text, ignoreRepeatedLetters, literalBangs);
    if (simple) return simple;
    let units = unicodeUnits(text, normalization);
    if (normalization === 'standard') {
        // Determine joins before any substitution. Unconverted symbols split
        // runs; literal/protected exclamations cannot lend letter meaning to numbers.
        const flags = new Uint8Array(units.length);
        for (let index = 0; index < units.length; index++) {
            const character = units[index].character;
            const code = character.charCodeAt(0);
            flags[index] = code < 128 ? ASCII_FLAGS[code] & 3
                : Number(wordPattern().test(character)) | (Number(letterPattern().test(character)) << 1);
        }
        for (let index = 1; index + 1 < units.length; index++) {
            const unit = units[index];
            if (!(flags[index] & 1) && SUBSTITUTIONS[unit.character]
                && (flags[index - 1] & 1) && (flags[index + 1] & 1)
                && !(unit.character === '!' && (literalBangs === true || literalBangs?.has(unit.start)))) {
                flags[index] |= 4;
            }
        }
        let from = 0;
        while (from < units.length) {
            if (!(flags[from] & 5)) { from++; continue; }
            let to = from;
            let hasLetter = false;
            while (to < units.length && (flags[to] & 5)) {
                hasLetter ||= Boolean(flags[to] & 2);
                to++;
            }
            if (hasLetter) {
                for (let position = from; position < to; position++) {
                    const character = units[position].character;
                    units[position].character = SUBSTITUTIONS[character] ?? character;
                }
            }
            from = to;
        }
        // Folding a digit or symbol can create a newly composable base+mark
        // pair (1 + acute -> i + acute -> í). Finish in stable NFKC form.
        units = recompose(units);
    }

    const output: Unit[] = ignoreRepeatedLetters ? [] : units;
    for (const unit of ignoreRepeatedLetters ? units : []) {
        const previous = output.at(-1);
        if (ignoreRepeatedLetters && previous?.character === unit.character && letterPattern().test(unit.character)) {
            previous.end = unit.end;
        } else {
            output.push(unit);
        }
    }
    const result: NormalizedText = { text: '', starts: [], ends: [], wordCharacters: [] };
    const characters: string[] = [];
    for (const unit of output) {
        characters.push(unit.character);
        const code = unit.character.charCodeAt(0);
        const isWord = code < 128 ? Boolean(ASCII_FLAGS[code] & 1) : wordPattern().test(unit.character);
        for (let offset = 0; offset < unit.character.length; offset++) {
            result.starts.push(unit.start);
            result.ends.push(unit.end);
            result.wordCharacters.push(isWord);
        }
    }
    result.text = characters.join('');
    return result;
}
