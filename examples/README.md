# Browser and framework examples

[Documentation](../docs/README.md) · [Integration guide](../docs/guides/browser-and-frameworks.md)

Four small apps use the ordinary `indonesian-badwords` package. Each checks input,
censors it, renders original highlights safely, allows `Baju Bodo`, excludes a
separate quoted field, and shows failed checks as errors. The shared policy
performs one `analyze` call per input update; components render the stored result.

From this directory, with Node.js 22.12 or newer:

```bash
npm ci
npm run dev:browser
```

Replace `dev:browser` with `dev:react`, `dev:vue`, or `dev:svelte`. Open the local
URL printed by Vite. Stop the process with Ctrl+C. No server or external service
receives your input.

| Example | Main source | Local port |
| --- | --- | --- |
| Browser | [main.ts](browser/main.ts) | 4170 |
| React | [main.tsx](react/main.tsx) | 4171 |
| Vue | [App.vue](vue/App.vue) | 4172 |
| Svelte | [App.svelte](svelte/App.svelte) | 4173 |

[Shared moderation](shared/moderation.ts) owns this example's policy and the
presentation-only merging of overlapping highlight coverage. The library owns
all detection and exception logic. The examples use source-identified quote
ranges; enforce your own quote policy on the server before trusting exclusions.

## Validate changes

```bash
npm run check
npm run check:policy
npm run build
npx playwright install chromium
npm run check:browser
```

`check` uses strict TypeScript, vue-tsc, and svelte-check. Browser tests serve the production builds and run the
same interaction cases in all four apps, including Unicode offsets, phrase and
range exceptions, escaped HTML, incomplete checks, recovery, and separate app
state. Policy checks also verify custom dictionary isolation and overlap rendering.

The dependency lock pins a published baseline so a fresh checkout works before
the next release exists. CI replaces that one dependency with the candidate
release tarball and runs these checks before making the artifact available to
publishing. Framework and test tooling stay in this private examples package;
they add no dependencies or files to the published library.
