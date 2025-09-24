# no-bare-date-call

Disallow calling `Date()` without `new`. It returns a localized string, not a `Date` object.

💡 Provides suggestions

## Rule Details

This rule disallows calling `Date()` as a function (without the `new` operator). Unlike `new Date()` which creates a Date object, `Date()` returns a localized string representation of the current date and time, which is often not the intended behavior and can lead to confusion.fns/no-bare-date-call

**Disallow** calling `Date()` (without `new`). It returns a localized string, not a `Date`.

## Why?

- It looks like `new Date()` but isn’t. Avoid the foot‑gun.

## Examples

### ❌ Incorrect

```js
/*eslint date-fns/no-bare-date-call: "error"*/

// Returns a string, not a Date object
const timestamp = Date();

// In expressions 
const result = 'Today is ' + Date();

// As function arguments
console.log(Date());

// In object properties
const obj = { timestamp: Date() };

// In conditional expressions
const result = condition ? Date() : 'unknown';
```

### ✅ Correct

```js
/*eslint date-fns/no-bare-date-call: "error"*/

// Using date-fns for formatting
import { format } from 'date-fns';
const timestamp = format(new Date(), 'yyyy-MM-dd');

// Using constructor for Date objects
const d = new Date();

// Using Date static methods
const now = Date.now();
const parsed = Date.parse('2024-01-01');

// Custom Date class (shadowed)
class Date { 
  toString() { return 'custom'; } 
} 
const s = Date();
```

## Autofix and Suggestions

This rule does not provide automatic fixes because the appropriate date format is project-specific. Instead, it provides suggestions to replace `Date()` with `format(new Date(), 'yyyy-MM-dd')` using date-fns.

## Options

This rule has no configuration options.

## When Not To Use It

There is no good reason to disable this rule. Bare `Date()` calls are almost always unintentional and lead to bugs.

## Related Rules

- [`no-date-constructor-string`](./no-date-constructor-string.md) - Disallows string-based Date construction
- [`prefer-date-fns-from-epoch`](./prefer-date-fns-from-epoch.md) - Prefers date-fns for epoch timestamps

## Version

This rule was introduced in eslint-plugin-date-fns v1.0.0.
