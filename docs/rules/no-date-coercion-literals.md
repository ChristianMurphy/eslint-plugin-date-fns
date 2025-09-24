# no-date-coercion-literals

Disallow coercion via `new Date(null)`, `new Date(true)`, and `new Date(false)`.

🔧 Fixable

## Rule Details

This rule disallows using literal boolean and null values with the Date constructor. These patterns are cryptic and hard to understand: `null` becomes the epoch (1970-01-01), `true` becomes 1ms after epoch, and `false` becomes the epoch. Using explicit date-fns functions makes the intent clear.

### Incorrect

```js
/*eslint date-fns/no-date-coercion-literals: "error"*/

const a = new Date(null);     // Becomes 1970-01-01T00:00:00Z
const b = new Date(true);     // Becomes 1970-01-01T00:00:00.001Z  
const c = new Date(false);    // Becomes 1970-01-01T00:00:00Z

// Also applies to globalThis.Date
const d = new globalThis.Date(null);

// In complex expressions
const result = someFunc(new Date(true));
```

### Correct

```js
/*eslint date-fns/no-date-coercion-literals: "error"*/

import { parseISO } from 'date-fns';

const a = parseISO('1970-01-01T00:00:00Z');
const b = parseISO('1970-01-01T00:00:00.001Z');
const c = parseISO('1970-01-01T00:00:00Z');

// Regular Date constructor usage
const now = new Date();
const custom = new Date('2024-01-01');

// Non-Date constructors are ignored
const obj = new MyDate(null);
```

## Autofix and Suggestions

This rule automatically fixes all literal coercion patterns by replacing them with the corresponding `parseISO` calls and adding the necessary import statement.

## Options

This rule has no configuration options.

## When Not To Use It

There is no good reason to disable this rule. Literal coercion with Date constructor is always confusing and should be avoided.

## Related Rules

- [no-bare-date-call](./no-bare-date-call.md) - Disallows calling Date() without new
- [no-date-constructor-string](./no-date-constructor-string.md) - Disallows string-based Date construction

## Version

This rule was introduced in eslint-plugin-date-fns v1.0.0.
