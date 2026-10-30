/** Checks, without building a scanner, whether a dictionary stays within a compiler's finite compile budgets. */
export interface DictionaryBudget {
    /**
     * Removes then adds keys (the matcher keys of dictionary words). Throws the compiler's own limit error, exactly as
     * compiling the resulting dictionary would, and then leaves the budget unchanged.
     */
    change(add: readonly string[], remove: readonly string[]): void;
}

interface TrieNode { next: Map<number, TrieNode>; refs: number }
/** The distinct-prefix count (states, root included) a Matcher trie would have, kept incrementally. */
export class KeyTrie {
    states = 1;
    readonly #root: TrieNode = { next: new Map(), refs: 0 };
    add(key: string): void {
        let node = this.#root;
        for (let index = 0; index < key.length; index++) {
            const code = key.charCodeAt(index);
            let child = node.next.get(code);
            if (!child) { child = { next: new Map(), refs: 0 }; node.next.set(code, child); this.states++; }
            child.refs++;
            node = child;
        }
    }
    remove(key: string): void {
        let node = this.#root;
        for (let index = 0; index < key.length; index++) {
            const code = key.charCodeAt(index);
            const child = node.next.get(code)!;
            if (--child.refs === 0) { node.next.delete(code); this.states--; }
            node = child;
        }
    }
}

/** Reference-counted key set with an atomic change(); subclasses keep their own aggregates and verify() them. */
export abstract class KeyBudget implements DictionaryBudget {
    protected readonly trie = new KeyTrie();
    readonly #counts = new Map<string, number>();
    protected enter(_key: string): void {}
    protected leave(_key: string): void {}
    /** Throws when the current key set exceeds a budget, in the order the compiler checks them. */
    protected abstract verify(): void;
    #apply(key: string, up: boolean): boolean {
        const count = this.#counts.get(key) ?? 0;
        if (!up && !count) return false;
        const next = count + (up ? 1 : -1);
        if (next) this.#counts.set(key, next); else this.#counts.delete(key);
        if (up && !count) { this.trie.add(key); this.enter(key); }
        else if (!up && !next) { this.trie.remove(key); this.leave(key); }
        return true;
    }
    change(add: readonly string[], remove: readonly string[]): void {
        const done: Array<[string, boolean]> = [];
        try {
            for (const key of remove) if (this.#apply(key, false)) done.push([key, false]);
            for (const key of add) if (this.#apply(key, true)) done.push([key, true]);
            this.verify();
        } catch (error) {
            for (let index = done.length - 1; index >= 0; index--) this.#apply(done[index][0], !done[index][1]);
            throw error;
        }
    }
}
