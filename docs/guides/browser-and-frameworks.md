# Integrate with browsers, React, Vue, and Svelte

[Documentation](../README.md) · [Runnable examples](../../examples/README.md)

Use the ordinary package in your app's bundler. You do not need a framework
adapter. The maintained examples use Vite, strict TypeScript, and the same shared
moderation policy:

| App | Source | Checker lifetime |
| --- | --- | --- |
| Browser | [main.ts](../../examples/browser/main.ts) | One checker during app initialization. |
| React | [main.tsx](../../examples/react/main.tsx) | Lazy state initializer, one retained checker per mounted component. |
| Vue | [App.vue](../../examples/vue/App.vue) | One checker in each component's `script setup`. |
| Svelte | [App.svelte](../../examples/svelte/App.svelte) | One checker in each component instance's script. |

React Strict Mode may run development initializers twice to check purity. The
factory has no external side effects. No example compiles a checker or checks
text during ordinary rendering. Each input handler checks once and stores the
complete result; rendering reads that state.

## Run an example

From a repository checkout:

```bash
cd examples
npm ci
npm run dev:react
```

Use `dev:browser`, `dev:vue`, or `dev:svelte` for the other apps. See the
[examples README](../../examples/README.md) for ports and validation commands.

Each example demonstrates the same behavior:

- `👩🏽‍💻 g0bl0k!` is censored and highlighted using original UTF-16 locations.
- `Baju Bodo` is allowed, while another `bodo` in the message remains detectable.
- The dedicated quoted-text field supplies an ignored source range; new text
  remains checked.
- Input and matched text are rendered with text nodes or framework escaping.
- A check that exceeds the example's 1,000-unit fuzzy input bound shows an error
  and hides the previous report. Valid input recovers normally.

Keep these policies explicit in your app. The example's quote field is a UI
choice, not a quote recognizer. The server must independently decide which
ranges to exclude. Catching errors is useful for display, but do not accept a
message merely because checking it failed.

## Keep application state independent

The [shared factory](../../examples/shared/moderation.ts) creates a fresh checker
for each consumer. Custom vocabulary in one instance does not change another.
For SSR, create mutable policies per request rather than storing user-specific
words in a shared module-level instance. Immutable policies can be reused when
that is a deliberate application decision.

The examples enable one-edit OSA matching, so several dictionary variants can
match the same spelling and appear as separate locations. Locations can overlap. The examples merge that coverage for highlighting only;
they retain the library's original locations for the report. User strings never
enter `innerHTML`, `v-html`, Svelte `{@html}`, or React `dangerouslySetInnerHTML`.

## Browser requirements and delivery

The library supports Node.js 22+. Browser bundles need ES2022 and
`Intl.Segmenter`; the examples' Vite tooling needs Node.js 22.12+. The root and
optional entrypoints have no runtime dependencies. Framework dependencies belong
to the app, and the examples' separate dependency tree is not published.

The package supplies CommonJS runtimes and ESM facades. A bundler converts these
for browsers. An untransformed file URL is not a supported browser module entry.
These examples use the existing output and do not add a CDN/global build or a
`window.IndonesianBadwords` API. A separate delivery target would add another
artifact to maintain without improving this supported bundler path.

[Getting started](../getting-started.md) covers imports. The official
[Vite guide](https://vite.dev/guide/), [React initializer documentation](https://react.dev/reference/react/useState#caveats),
[Vue TypeScript guide](https://vuejs.org/guide/typescript/overview.html), and
[Svelte TypeScript guide](https://svelte.dev/docs/svelte/typescript) cover the
framework tooling used here.
