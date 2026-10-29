# Get started

[Documentation](README.md)

Install the package in your application:

```bash
npm install indonesian-badwords
```

## Run a check

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords();
checker.flag('terima kasih'); // => false
checker.flag('dasar g0bl0k!'); // => true
checker.censor('dasar g0bl0k!'); // => 'dasar ***!'
```

Create one checker for each independent application policy and reuse it across
messages. Construction prepares the dictionary; it does not belong inside a
render function or an input handler. `addWords` and `removeWords` change that
instance only. In an SSR application, create a checker per request when its
policy can change between users.

CommonJS works too:

```js
const { Badwords } = require('indonesian-badwords');
const checker = new Badwords();
checker.censor('goblok'); // => '***'
```

The named exports `flag`, `find`, `badwords`, `censor`, `filter`, and `analyze`
use a shared default instance. Use an independent `Badwords` instance when your
app changes its dictionary or needs several policies.

## Choose the result you need

| App task | Method |
| --- | --- |
| Accept or reject a message | `flag()` |
| Display censored text | `censor()` |
| Render highlights in the original message | `find()` |
| Build a moderation report with text, counts, and locations | `analyze()` |
| List unique matched dictionary words | `badwords()` |
| Remove matches and tidy whitespace | `filter()` |

```ts
import { Badwords } from 'indonesian-badwords';

const checker = new Badwords();
const message = '👩🏽‍💻 g0bl0k!';
const result = checker.analyze(message);
result.censored; // => '👩🏽‍💻 ***!'
result.occurrenceCount; // => 1
result.locations; // => [{ word: 'goblok', index: 8, end: 14, match: 'g0bl0k', via: { kind: 'leetspeak', folds: 2 } }]
```

Locations refer to the original string's UTF-16 offsets. Render slices as text;
do not insert user input into `innerHTML`. See the [browser and framework
examples](guides/browser-and-frameworks.md) for safe highlighting.

## Supported environments

Node.js 22 or newer is supported. ESM, CommonJS, and TypeScript declarations ship
in the package. Browser applications should bundle the ordinary package for
ES2022 and provide `Intl.Segmenter`. The package does not install polyfills or
create a browser global. The maintained Vite examples require Node.js 22.12+
for their development tooling; that does not change the library's Node.js floor.

The default dictionary matches whole words and avoids many common literal
uses. It already handles case, compatibility characters, internal leetspeak,
and invisible obfuscation. It does not infer intent or perform general stemming.

Next, [configure a chat policy](guides/chat-moderation.md), [choose a
dictionary](guides/dictionaries.md), or look up [method contracts](api.md).
