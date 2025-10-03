# no-date-mutation

Disallow in-place mutation of `Date` instances. Prefer immutable date-fns alternatives.

🔧 Automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/use/command-line-interface#--fix)

💡 Provides suggestions for ambiguous cases

## Rule Details

This rule enforces immutable date operations by disallowing direct mutation of Date objects through setter methods. Instead, it requires using date-fns v4 functions which return new Date instances.

JavaScript's `Date` object is mutable by default, which can lead to:
- Unintended side effects when dates are shared across code
- Difficult-to-debug mutation-at-a-distance issues
- Testing challenges requiring extensive mocking
- Inconsistency with modern functional programming practices

This rule automatically converts most mutation patterns to immutable date-fns equivalents, and provides suggestions for ambiguous cases.

## Examples

### ❌ Incorrect

```js
/*eslint date-fns/no-date-mutation: "error"*/

// Simple field mutation
const d = new Date();
d.setHours(14);

// Arithmetic mutation
const d2 = new Date();
d2.setMonth(d2.getMonth() + 1);

// Function parameter mutation
function updateDate(date) {
  date.setFullYear(2024);
}

// Midnight zeroing
d.setHours(0, 0, 0, 0);

// Timestamp mutation
d.setTime(1609459200000);

// UTC mutation
d.setUTCDate(15);

// Consecutive mutations
d.setFullYear(2024);
d.setMonth(5);
d.setDate(15);
```

### ✅ Correct

```js
/*eslint date-fns/no-date-mutation: "error"*/

import { set, addMonths, startOfDay, toDate } from 'date-fns';
import { tz } from '@date-fns/tz';

// Simple field update
let d = new Date();
d = set(d, { hours: 14 });

// Arithmetic
let d2 = new Date();
d2 = addMonths(d2, 1);

// Function parameter (shadow to allow reassignment)
function updateDate(date) {
  let date = date;
  date = set(date, { year: 2024 });
  return date;
}

// Midnight zeroing
d = startOfDay(d);

// Timestamp
d = toDate(1609459200000);

// UTC operations
d = set(d, { date: 15 }, { in: tz('UTC') });

// Consecutive mutations merged
d = set(d, { year: 2024, month: 5, date: 15 });
```

## Automatic Fixes

The rule provides automatic fixes for most common patterns:

### 1. Simple Field Updates → `set()`

```js
// Before
d.setHours(14);
d.setMinutes(30);

// After (auto-fixed)
d = set(d, { hours: 14 });
d = set(d, { minutes: 30 });
```

### 2. Midnight Zeroing → `startOfDay()`

```js
// Before
d.setHours(0, 0, 0, 0);

// After (auto-fixed)
d = startOfDay(d);
```

### 3. Timestamp → `toDate()`

```js
// Before
d.setTime(1609459200000);

// After (auto-fixed)
d = toDate(1609459200000);
```

### 4. Arithmetic → `add*` / `sub*` Functions

The rule normalizes arithmetic to the largest fitting unit:

```js
// Before
d.setHours(d.getHours() + 48);

// After (auto-fixed, normalized to days)
d = addDays(d, 2);

// Before
d.setMonth(d.getMonth() + 6);

// After (auto-fixed, normalized to quarters)
d = addQuarters(d, 2);
```

Supported units (with normalization):
- Milliseconds → Seconds → Minutes → Hours → Days → Weeks
- Months → Quarters → Years

### 5. UTC Operations

```js
// Before
d.setUTCHours(14);

// After (auto-fixed)
d = set(d, { hours: 14 }, { in: tz('UTC') });
```

### 6. Consecutive Setters → Merged `set()`

```js
// Before
d.setFullYear(2024);
d.setMonth(5);
d.setDate(15);

// After (auto-fixed)
d = set(d, { year: 2024, month: 5, date: 15 });
```

### 7. Side Effects → Temporary Variables

```js
// Before
d.setHours(sideEffect());
d.setMinutes(anotherEffect());

// After (auto-fixed)
const __dateFix1 = sideEffect();
const __dateFix2 = anotherEffect();
d = set(d, { hours: __dateFix1, minutes: __dateFix2 });
```

## Suggestions for Ambiguous Cases

Some patterns are ambiguous and cannot be auto-fixed. The rule provides suggestions instead:

### UTC/Local Mismatch

When mixing UTC and local getters/setters, the intent is unclear:

```js
// Ambiguous: UTC setter with local getter
d.setUTCHours(d.getHours() + 1);

// Suggestions provided:
// 1. Use UTC arithmetic (recommended)
d = addHours(d, 1, { in: tz('UTC') });

// 2. Use local arithmetic
d = addHours(d, 1);
```

## Report-Only Cases

### Aliasing

When a date variable has aliases that are read after mutation, converting to immutable would change behavior:

```js
// Unsafe to auto-fix
const d = new Date();
const alias = d;
d.setHours(5);
console.log(alias);  // Would see mutated date

// Error reported: alias "alias" is read after mutation
```

Safe cases (auto-fixed normally):

```js
// Alias not read after mutation
const d = new Date();
const alias = d;
d.setHours(5);  // ✅ Auto-fixed
return;

// Alias read before mutation
let d = new Date();
const alias = d;
console.log(alias);  // Read before
d.setHours(5);  // ✅ Auto-fixed
```

## Options

This rule has no configuration options.

## When Not To Use It

- If your codebase heavily relies on Date mutation and a full migration is not feasible
- If you're working with legacy code that requires mutable dates for compatibility
- If you're not using date-fns in your project (though we highly recommend it!)

## Related Rules

- [`no-bare-date-call`](./no-bare-date-call.md) - Disallows calling `Date()` without `new`
- [`no-date-constructor-string`](./no-date-constructor-string.md) - Disallows string-based Date construction
- [`prefer-date-fns-from-epoch`](./prefer-date-fns-from-epoch.md) - Prefers date-fns for epoch timestamps

## Version

This rule was introduced in eslint-plugin-date-fns v0.2.0.
