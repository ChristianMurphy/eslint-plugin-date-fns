# no-date-in-string-interpolation

Disallow implicit Date-to-string coercion in template literals and string
concatenations. Prefer an explicit formatter from date-fns.

💡 Provides suggestions

## Rule Details

A `Date` embedded in a template literal or string concatenation is
stringified via `Date.prototype.toString`, which is locale-dependent. The
rule flags the following:

- Template literal interpolation: `` `t: ${date}` `` where `date` is
  Date-typed or an obvious Date expression (`new Date(...)`, a call to a
  known date-fns Date-returning function).
- Explicit `.toString()` on a Date inside a template literal.
- String concatenation with `+` when at least one operand is a Date, in
  any position: `"text " + date`, `date + " suffix"`, `date + ""`, and
  even `dateA + dateB`.

Not flagged:

- Explicit formatter calls: `format(date, pattern)`, `formatISO(date)`,
  `formatInTimeZone(...)` etc. The return value is already a string.
- Explicit method calls that produce a deterministic string:
  `date.toISOString()`, `date.toLocaleString('en-US')`.
- Numeric conversions: `date.getTime()`, `date.valueOf()`.
- Tagged template literals: the tag function receives the Date raw, so
  coercion depends on the tag. Skipped to avoid false positives.

## Examples

### ❌ Incorrect

```ts
/*eslint date-fns/no-date-in-string-interpolation: "warn"*/

declare const d: Date;

const a = `today: ${d}`;
const b = `at ${new Date()}`;
const c = "today: " + new Date();
const d2 = new Date() + " suffix";
const e = d + "";
const f = `today: ${d.toString()}`;
```

### ✅ Correct

```ts
/*eslint date-fns/no-date-in-string-interpolation: "warn"*/

import { format, formatISO } from 'date-fns';

declare const d: Date;

const a = `today: ${format(d, 'yyyy-MM-dd')}`;
const b = `at ${formatISO(new Date())}`;
const c = `today: ${d.toISOString()}`;
const d2 = `at ${d.toLocaleString('en-US')}`;
const e = `time: ${d.getTime()}`;

// Tagged templates are skipped
declare function sql(parts: TemplateStringsArray, ...args: unknown[]): string;
const query = sql`insert ... ${d}`;
```

## Autofix and Suggestions

The rule provides a suggestion (not an autofix) to wrap the Date with
`format(expr, 'yyyy-MM-dd')`. Choose the pattern for your project; the
rule uses `'yyyy-MM-dd'` as a conservative default.

For `.toString()` coercion, the suggestion wraps the receiver (not the
call), so `` `today: ${d.toString()}` `` becomes
`` `today: ${format(d, 'yyyy-MM-dd')}` ``.

## Options

This rule has no configuration options.

## When Not To Use It

If your project intentionally embeds Dates in strings for debug logs or
quick-and-dirty output and you don't mind the default
`Date.prototype.toString` format, disable this rule.

## Related Rules

- [`no-bare-date-call`](./no-bare-date-call.md): catches the related
  footgun of calling `Date()` as a function.

## Version

This rule was introduced in eslint-plugin-date-fns v0.7.0.
