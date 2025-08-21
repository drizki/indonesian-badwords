/**
 * A class to manage and process Indonesian bad words.
 * This class provides methods to detect, filter, censor, and analyze text for profanity.
 */
class Badwords {
    /**
     * Initializes the Badwords instance.
     * It loads the default dictionary and character substitution map.
     */
    constructor() {
        // Load the dictionary from the JSON file.
        const dictionary = require('./dict.json');
        
        // Use a Set for efficient O(1) average time complexity lookups.
        this._dictionarySet = new Set(dictionary);
        
        // Keep an array for backward compatibility and regex generation.
        this.dict = [...this._dictionarySet];

        // Map for leetspeak and common character substitutions.
        this._substitutions = {
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
    }

    /**
     * Validates the input text to ensure it's a non-empty string.
     * @private
     * @param {string} text - The text to validate.
     * @throws {Error} if the text is not a non-empty string.
     */
    _validateInput(text) {
        if (text === undefined || text === null) throw new Error('string expected');
        if (text === '') throw new Error('empty string passed');
        if (typeof text !== 'string') throw new Error('string expected');
    }

    /**
     * Normalizes a text by replacing substituted characters (leetspeak).
     * @private
     * @param {string} text - The text to normalize.
     * @returns {string} The normalized text.
     */
    _normalize(text) {
        // Return a normalized version of the text for checking purposes.
        return text.toLowerCase().split('').map(char => this._substitutions[char] || char).join('');
    }
    
    /**
     * Rebuilds the internal array dictionary from the Set.
     * @private
     */
    _rebuildDictArray() {
        this.dict = [...this._dictionarySet];
    }

    /**
     * Adds one or more words to the bad words dictionary.
     * @param {string|string[]} words - A single word or an array of words to add.
     */
    addWords(words) {
        const wordsToAdd = Array.isArray(words) ? words : [words];
        wordsToAdd.forEach(word => {
            if (typeof word === 'string') {
                this._dictionarySet.add(word.toLowerCase());
            }
        });
        this._rebuildDictArray();
    }

    /**
     * Removes one or more words from the bad words dictionary.
     * @param {string|string[]} words - A single word or an array of words to remove.
     */
    removeWords(words) {
        const wordsToRemove = Array.isArray(words) ? words : [words];
        wordsToRemove.forEach(word => {
            if (typeof word === 'string') {
                this._dictionarySet.delete(word.toLowerCase());
            }
        });
        this._rebuildDictArray();
    }

    /**
     * Checks if a text contains any bad words using an aggressive substring search.
     * This method will detect concatenated words (e.g., "bajingankontol").
     * @param {string} text - The text to check.
     * @returns {boolean} - True if the text contains a bad word, false otherwise.
     */
    flag(text) {
        this._validateInput(text);
        const normalizedText = this._normalize(text);
        return this.dict.some(word => normalizedText.includes(word));
    }

    /**
     * Finds all unique dictionary bad words present in a given text using substring search.
     * @param {string} text - The text to scan.
     * @returns {string[]} - An array of unique dictionary bad words found in the text.
     */
    badwords(text) {
        this._validateInput(text);
        const normalizedText = this._normalize(text);
        return this.dict.filter(word => normalizedText.includes(word));
    }

    /**
     * Removes bad words from a text. This method is an alias for censor(text, '').
     * @param {string} text - The text to filter.
     * @returns {string} - The filtered text.
     */
    filter(text) {
        this._validateInput(text);
        const censored = this.censor(text, '');
        // Clean up extra spaces that might result from replacement.
        return censored.replace(/\s\s+/g, ' ').trim();
    }

    /**
     * Censors bad words in a text with a replacement string.
     * This method processes text word-by-word to correctly censor leetspeak variations.
     * Note: It will not censor concatenated words (e.g., "bajingankontol"), but `flag()` will still detect them.
     * @param {string} text - The text to censor.
     * @param {string} [replacement='***'] - The string to replace bad words with.
     * @returns {string} - The censored text.
     */
    censor(text, replacement = '***') {
        this._validateInput(text);
        
        if (this.dict.length === 0) {
            return text;
        }

        // Split the text while preserving delimiters (spaces, punctuation).
        // The regex uses Unicode property escapes (\p{L}, \p{N}) to correctly handle letters and numbers
        // from various languages, which is more robust than a-zA-Z0-9.
        const wordsAndDelimiters = text.split(/([^\p{L}\p{N}]+)/u);

        const censoredParts = wordsAndDelimiters.map(part => {
            // Normalize the part for checking, but censor the original part.
            const normalizedPart = this._normalize(part);
            if (this._dictionarySet.has(normalizedPart)) {
                return replacement;
            }
            return part; // Return the original part if it's not a bad word or is a delimiter.
        });

        return censoredParts.join('');
    }

    /**
     * Analyzes a text for bad words and returns a detailed object.
     * @param {string} text - The text to analyze.
     * @returns {object} - An analysis object.
     */
    analyze(text) {
        this._validateInput(text);
        
        const badwordsFound = this.badwords(text); // Uses aggressive detection
        const words = text.split(' ');
        
        const locations = badwordsFound.flatMap(word => {
            const indices = [];
            let startIndex = 0;
            const lowerCaseText = text.toLowerCase();
            
            while((startIndex = lowerCaseText.indexOf(word, startIndex)) > -1) {
                indices.push({ word: word, index: startIndex });
                startIndex += word.length;
            }
            return indices;
        });

        return {
            text,
            words: words.length,
            censored: this.censor(text), // Uses word-by-word censoring for accuracy
            badwords: badwordsFound,
            count: badwordsFound.length,
            locations: locations.sort((a, b) => a.index - b.index)
        };
    }
}

// Export a singleton instance for backward compatibility.
module.exports = new Badwords();
