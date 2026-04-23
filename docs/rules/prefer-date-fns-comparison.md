# prefer-date-fns-comparison

Disallow equality operators on Date timestamps. Prefer `isEqual` from date-fns.

🔧 Autofix for timestamp patterns; 💡 suggestion for Date-on-Date comparisons

## Rule Details

This rule flags uses of `===`, `!==`, `==`, and `!=` where both operands
are known to refer to a Date. Three detection paths:

1. Syntactic timestamp pattern: both sides are `.getTime()` or `.valueOf()`
   calls. Autofix rewrites to `isEqual(a, b)` (or `!isEqual(a, b)` for
   inequality).
2. Type-aware: when TypeScript type information is available, both
   operands resolve to exactly `Date`. Suggestion only, because the
   author may have intended reference equality or a day-bucket
   comparison.
3. AST-only fallback: both operands are `new Date(...)` or a call to a
   known date-fns Date-returning function (e.g. `parseISO(...)`,
   `startOfDay(...)`). Suggestion only.

Relational operators (`<`, `>`, `<=`, `>=`) are intentionally out of scope.
They coerce through `valueOf()` and reading the comparison is unambiguous.

## Why?

- `===` on two `Date` objects compares references, not timestamps. The
  `.getTime()` pattern works around that, but the fix is syntactic; a
  reader still has to recognize the pattern.
- `isEqual` is self-documenting, handles invalid dates predictably, and
  is consistent with the rest of date-fns.

## Examples

### ❌ Incorrect

```ts
/*eslint date-fns/prefer-date-fns-comparison: "error"*/

declare const a: Date;
declare const b: Date;

a.getTime() === b.getTime();
a.getTime() !== b.getTime();
a.getTime() == b.getTime();
a.getTime() != b.getTime();
```

### ✅ Correct

```js
/*eslint date-fns/prefer-date-fns-comparison: "error"*/

import { isEqual } from 'date-fns';

declare const a: Date;
declare const b: Date;

isEqual(a, b);
!isEqual(a, b);

// Relational comparisons are fine
a.getTime() < b.getTime();
a < b;

// Comparing a Date timestamp against a literal is fine
a.getTime() === 0;
```

## Autofix and Suggestions

Autofix applies to the syntactic timestamp pattern only: equality operators
between two `.getTime()` or `.valueOf()` calls are rewritten to
`isEqual(left, right)` (or `!isEqual(left, right)` for `!==` / `!=`), and
the `isEqual` import is injected into an existing `date-fns` import or
added at the top of the file. If the local `isEqual` name is already
bound (for example, by a `lodash` import), the rule injects
`import { isEqual as isEqualDate } from 'date-fns'` and uses the alias.

For bare Date-on-Date comparisons (`a === b` where both are Date), the
rule reports with a suggestion rather than an autofix, since the author
may have intended reference equality or a different granularity such as
`isSameDay`.

## Options

This rule has no configuration options.

## When Not To Use It

If your codebase intentionally compares timestamps numerically and you
prefer the operator style, disable this rule. Most codebases are better
served by preferring `isEqual` for date comparisons.

## Related Rules

- [`no-date-mutation`](./no-date-mutation.md): prefer immutable date-fns
  helpers over Date mutators.

## Version

This rule was introduced in eslint-plugin-date-fns v0.7.0.
