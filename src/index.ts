import { dictionary as defaultDictionary } from './dictionary.ts';

/** A single occurrence of a bad word within the analyzed text. */
export interface BadwordLocation {
    /** The dictionary word that was found. */
    word: string;
    /** Zero-based index of the word in the original text. */
    index: number;
}

/** Detailed result returned by {@link Badwords.analyze}. */
export interface AnalysisResult {
    /** The original text that was analyzed. */
    text: string;
    /** Number of space-separated words in the text. */
    words: number;
    /** The text with bad words replaced by `***`. */
    censored: string;
    /** The unique dictionary words that were found. */
    badwords: string[];
    /** Number of entries in {@link AnalysisResult.badwords}. */
    count: number;
    /** Every occurrence of every found word, sorted by index. */
    locations: BadwordLocation[];
}

/** Leetspeak and common character substitutions used for normalization. */
const SUBSTITUTIONS: Readonly<Record<string, string>> = {
    '4': 'a', '@': 'a',
    '8': 'b',
    '(': 'c',
    '3': 'e',
    '6': 'g', '9': 'g',
    '1': 'i', '!': 'i', '|': 'i',
    '0': 'o',
    '5': 's', '$': 's',
    '7': 't',
    '2': 'z'
};

/**
 * Detects, filters, censors, and analyzes Indonesian profanity.
 *
 * Create an instance with a custom dictionary, or use the shared singleton
 * exported as the package's default export.
 */
export class Badwords {
    readonly #dictionarySet: Set<string>;

    /**
     * @param dictionary - Initial dictionary. Defaults to the bundled list.
     */
    constructor(dictionary: readonly string[] = defaultDictionary) {
        this.#dictionarySet = new Set(dictionary.filter((word) => word.length > 0));
    }

    /** A copy of the current dictionary, in insertion order. */
    get dict(): string[] {
        return [...this.#dictionarySet];
    }

    /**
     * Validates the input text to ensure it's a non-empty string.
     * @throws {Error} If the text is not a non-empty string.
     */
    private _validateInput(text: unknown): asserts text is string {
        if (text === undefined || text === null) throw new Error('string expected');
        if (text === '') throw new Error('empty string passed');
        if (typeof text !== 'string') throw new Error('string expected');
    }

    /** Normalizes text by lowercasing and replacing leetspeak characters. */
    #normalize(text: string): string {
        let normalized = '';
        for (const char of text.toLowerCase()) {
            normalized += SUBSTITUTIONS[char] ?? char;
        }
        return normalized;
    }

    /**
     * Adds one or more words to the dictionary.
     * @param words - A single word or an array of words to add.
     */
    addWords(words: string | string[]): void {
        const wordsToAdd = Array.isArray(words) ? words : [words];
        for (const word of wordsToAdd) {
            if (typeof word === 'string' && word.length > 0) {
                this.#dictionarySet.add(word.toLowerCase());
            }
        }
    }

    /**
     * Removes one or more words from the dictionary.
     * @param words - A single word or an array of words to remove.
     */
    removeWords(words: string | string[]): void {
        const wordsToRemove = Array.isArray(words) ? words : [words];
        for (const word of wordsToRemove) {
            if (typeof word === 'string') {
                this.#dictionarySet.delete(word.toLowerCase());
            }
        }
    }

    /**
     * Checks whether the text contains any dictionary word using a substring
     * search, so concatenated words are also detected.
     */
    flag(text: string): boolean {
        this._validateInput(text);
        const normalizedText = this.#normalize(text);
        for (const word of this.#dictionarySet) {
            if (normalizedText.includes(word)) return true;
        }
        return false;
    }

    /**
     * Returns every unique dictionary word found in the text, using the same
     * substring search as {@link flag}.
     */
    badwords(text: string): string[] {
        this._validateInput(text);
        const normalizedText = this.#normalize(text);
        return [...this.#dictionarySet].filter((word) => normalizedText.includes(word));
    }

    /**
     * Removes bad words from the text. Alias for `censor(text, '')` followed by
     * whitespace cleanup.
     */
    filter(text: string): string {
        this._validateInput(text);
        return this.censor(text, '').replace(/\s\s+/g, ' ').trim();
    }

    /**
     * Replaces whole words with a substitute string, handling leetspeak.
     * Concatenated words are not censored, although {@link flag} detects them.
     *
     * @param text - The text to censor.
     * @param replacement - The replacement string. Defaults to `***`.
     */
    censor(text: string, replacement = '***'): string {
        this._validateInput(text);

        if (this.#dictionarySet.size === 0) {
            return text;
        }

        const parts = text.split(/([^\p{L}\p{N}]+)/u);
        return parts
            .map((part) => (this.#dictionarySet.has(this.#normalize(part)) ? replacement : part))
            .join('');
    }

    /** Returns a detailed analysis of the text. */
    analyze(text: string): AnalysisResult {
        this._validateInput(text);

        const badwordsFound = this.badwords(text);
        const lowerCaseText = text.toLowerCase();

        const locations = badwordsFound.flatMap((word) => {
            const indices: BadwordLocation[] = [];
            let startIndex = 0;

            while ((startIndex = lowerCaseText.indexOf(word, startIndex)) > -1) {
                indices.push({ word, index: startIndex });
                startIndex += word.length;
            }

            return indices;
        });

        return {
            text,
            words: text.split(' ').length,
            censored: this.censor(text),
            badwords: badwordsFound,
            count: badwordsFound.length,
            locations: locations.sort((a, b) => a.index - b.index)
        };
    }
}

const instance = new Badwords();

export default instance;

export const flag = instance.flag.bind(instance);
export const badwords = instance.badwords.bind(instance);
export const filter = instance.filter.bind(instance);
export const censor = instance.censor.bind(instance);
export const analyze = instance.analyze.bind(instance);
export const addWords = instance.addWords.bind(instance);
export const removeWords = instance.removeWords.bind(instance);
