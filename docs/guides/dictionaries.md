# Choose a dictionary

[Documentation](../README.md) · [Metadata reference](../metadata.md)

A dictionary determines which spellings are candidates. Matching settings decide
which forms of those spellings the checker accepts. The library does not infer
whether a speaker intended an insult.

## Default or expanded

```ts
import { Badwords, expandedDictionary } from 'indonesian-badwords';

const conservative = new Badwords();
const expanded = new Badwords({ dictionary: expandedDictionary });
conservative.flag('anjing peliharaan'); // => false
expanded.flag('anjing peliharaan'); // => true
conservative.flag('jancuk'); // => true
conservative.flag('kehed'); // => true
```

The root exports 227 default terms and variants, 117 contextual additions, and
their combined 344-entry expanded list. The default list excludes common literal
uses such as `anjing` and `babi`. It includes regional profanity, including
Javanese `jancuk` and Sundanese `kehed`; this is not a claim of complete dialect
coverage.

## Select reviewed words

The optional metadata module provides separate source-reviewed profiles. Choose
once during setup; detection calls do not need to consult metadata:

```ts
import { Badwords } from 'indonesian-badwords';
import { selectDictionary } from 'indonesian-badwords/metadata';

const checker = new Badwords({
  dictionary: selectDictionary({
    profiles: ['reviewed-core', 'reviewed-contextual'],
    categories: ['sexual-vulgarity'],
    minSeverity: 3,
  }),
});
checker.flag('kontol'); // => true
```

`reviewedDictionary` contains 172 core spellings; `reviewedExpandedDictionary`
adds 94 contextual spellings. Reviewed profiles do not change the root lists.
A selector can narrow by documented abusive-use region too. Values within one
array are alternatives; different selectors must all match. Empty arrays
select nothing. Unknown values throw instead of broadening the policy.

Read the [selection contract](../metadata.md#selection-rules) before using
severity or region filters. A region label records cited usage, not speaker
identity or current popularity. Unknown severity or region values do not pass
an explicit filter for them.

## Add your own vocabulary

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords({ dictionary: ['customterm'] });
checker.addWords(['anotherterm']);
checker.removeWords('customterm');
checker.flag('customterm'); // => false
checker.flag('anotherterm'); // => true
```

Supplying `dictionary` replaces the initial list. To extend the default list,
create a default checker and call `addWords`. Mutations affect that instance;
`dict` returns a copy. The module-level `addWords` and `removeWords` (and
`badwords.addWords` on the default export) mutate a process-wide shared checker; the
functions are deprecated, so prefer your own `new Badwords()` instance. Removing a word
removes it everywhere. Use a [phrase exception](exceptions.md) if the word should remain
detectable outside a known name or expression.

With a bounded `evasion` or `fuzzy` policy, `addWords` and `removeWords` still throw
the policy's limit error (for example `maxCompileStates`) from the call that would
exceed it, and leave the dictionary unchanged, so loading words one at a time and
skipping the rejected ones works. The matcher itself is built once, on the next scan.

## Inspect why a term is included

Look up `getMetadata(hit.word)` after matching. Use `/catalog` to inspect source
claims, review status, and editorial decisions. The [source
reference](../metadata.md#inspect-a-policy-decision) explains the records and
their limits. Presence in the inventory does not mean a spelling belongs to a
reviewed matching profile.

For a proposed addition, supply a coarse/abusive usage source and a nearby benign
counterexample. See [contributing](../contributing.md).
