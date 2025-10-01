# eslint-plugin-date-fns

[![npm](https://img.shields.io/npm/v/eslint-plugin-date-fns.svg)](https://www.npmjs.com/package/eslint-plugin-date-fns)
[![main](https://github.com/ChristianMurphy/eslint-plugin-date-fns/actions/workflows/main.yml/badge.svg)](https://github.com/ChristianMurphy/eslint-plugin-date-fns/actions/workflows/main.yml)

Date handling lint rules that steer JavaScript/TypeScript code toward clarity and safety by preferring date-fns over ambiguous Date constructor usage.

Designed for ESLint v9 (flat config), TypeScript (via typescript-eslint), Node 22+, and ESM projects.

## Why use this plugin?

The `new Date(string)` constructor and multi-argument `new Date(y, m, d, ...)` are hard to read and easy to misuse. These rules move you toward explicit, readable date-fns calls with safe autofixes where possible.

## Requirements

- Node.js: 22+
- ESLint: 9.x
- TypeScript: 5.x
- typescript-eslint: 8.x
- date-fns: 4.x
- Module system: ESM only (`"type": "module"`)

## Installation

```bash  
npm i -D eslint eslint-plugin-date-fns typescript typescript-eslint @typescript-eslint/parser
```

The plugin includes date-fns as a dependency and adds date-fns imports as part of autofixes. Your project will automatically have access to date-fns functions when using this plugin.

## Quick start (ESLint flat config, ESM)

```js
// eslint.config.js (ESM)
import tseslint from "typescript-eslint";
import dateFnsPlugin from "eslint-plugin-date-fns";

export default [
  // your other configs ...
  dateFnsPlugin.configs.recommended, // enables core rules as "error"
  dateFnsPlugin.configs.diagnostic,  // enables diagnostic rules as "warn"
];
```

### Available Presets

**`recommended`** - Core date-fns rules that prevent common bugs and enforce safe patterns (all set to "error"):
- `no-bare-date-call`
- `no-date-coercion-literals`
- `no-date-constructor-string`
- `no-legacy-year-components`
- `prefer-date-fns-from-epoch`
- `prefer-iso-literal-over-components`
- `require-isvalid-after-parse`

**`diagnostic`** - Code quality and maintainability rules that may have false positives in some contexts (set to "warn"):
- `no-magic-time` - Detects numeric literals that appear to be time constants

You can use both presets together, or just one depending on your needs.

If you want to configure rules individually:

```js
import dateFnsPlugin from "eslint-plugin-date-fns";

export default [
  {
    plugins: {
      "date-fns": dateFnsPlugin,
    },
    rules: {
      "date-fns/no-bare-date-call": "error",
      "date-fns/no-date-coercion-literals": "error",
      "date-fns/no-date-constructor-string": "error",
      "date-fns/no-legacy-year-components": "error",
      "date-fns/no-magic-time": "error",
      "date-fns/prefer-date-fns-from-epoch": "error",
      "date-fns/prefer-iso-literal-over-components": "error",
      "date-fns/require-isvalid-after-parse": "error",
    },
  },
];
```

## Rules

### Recommended Preset

These rules prevent common date handling bugs and enforce safe patterns.

| Rule | What it guards | Autofix | Suggestions | Comments | Docs |
| -------------------------------------- | ------------------------------------------------------------------------- | ---------- | -------------- | -------- | ------- |
| no-bare-date-call | Forbid bare `Date()` string call | None | `format(new Date(), ...)` patterns | Prevent string coercion | [docs](./docs/rules/no-bare-date-call.md) |
| no-date-coercion-literals | Forbid `new Date(null)` and `new Date(true/false)` | All cases | None | Safe literal conversion | [docs](./docs/rules/no-date-coercion-literals.md) |
| no-date-constructor-string | Forbids `new Date(string)` and `Date.parse(string)` | ISO literals to `parseISO()` | Variables get suggestions | Prefer `parseISO` or `parse` | [docs](./docs/rules/no-date-constructor-string.md) |
| no-legacy-year-components | Forbid `new Date(y, ...)` with `0 ≤ y ≤ 99` (1900+ quirk) | None | 4-digit year via `parseISO()` | Avoid century ambiguity | [docs](./docs/rules/no-legacy-year-components.md) |
| prefer-date-fns-from-epoch | Prefer `fromUnixTime(sec)` over `new Date(number)` | Numeric literals | Variables get suggestions | Safe epoch conversion | [docs](./docs/rules/prefer-date-fns-from-epoch.md) |
| prefer-iso-literal-over-components | Replace `new Date(y, m, d, ...)` (all numeric literals) | All-literal calls | Mixed literal/variable calls | UTC ISO format | [docs](./docs/rules/prefer-iso-literal-over-components.md) |
| require-isvalid-after-parse | Require checking `isValid(x)` after `parse/parseISO` before use | None | Validation guard patterns | Prevent invalid date bugs | [docs](./docs/rules/require-isvalid-after-parse.md) |

### Diagnostic Preset

These rules help identify potential code quality issues but may have false positives in some contexts.

| Rule | What it guards | Autofix | Suggestions | Comments | Docs |
| -------------------------------------- | ------------------------------------------------------------------------- | ---------- | -------------- | -------- | ------- |
| no-magic-time | Detects numeric literals that appear to be time constants | None | Named constants, date-fns alternatives | Improve time constant clarity | [docs](./docs/rules/no-magic-time.md) |

