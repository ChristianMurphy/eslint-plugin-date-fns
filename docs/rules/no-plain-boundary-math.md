# no-plain-boundary-math

Disallow manual date boundary calculations in favor of date-fns boundary helpers.

🔧 This rule is automatically fixable with the `--fix` option for safe transformations.

💡 This rule provides suggestions for ambiguous patterns.

## Rule Details

Manual date boundary calculations (start/end of day, month, week, etc.) are error-prone, hard to maintain, and obscure intent. date-fns provides clear, well-tested helper functions that handle edge cases correctly.

This rule detects:
- Plain Date setter patterns (`date.setHours(0, 0, 0, 0)`)
- date-fns setter patterns (`set(d, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 })`)
- Month boundary tricks (`new Date(year, month + 1, 0)`)
- Millisecond arithmetic hacks (`new Date(+date + 86400000)`)
- Setter chains (`setHours(setMinutes(setSeconds(d, 0), 0), 0)`)

### Examples of Incorrect Code

```js
/*eslint date-fns/no-plain-boundary-math: "error"*/

// ❌ Manual start of day
const date = new Date();
date.setHours(0, 0, 0, 0);

// ❌ Manual end of day
date.setHours(23, 59, 59, 999);

// ❌ date-fns setters for boundaries
import { set } from "date-fns";
const start = set(d, { hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });

// ❌ "Next day minus 1ms" hack
import { addDays, startOfDay, setMilliseconds } from "date-fns";
const eod = setMilliseconds(addDays(startOfDay(d), 1), -1);

// ❌ End of month trick
const endOfMonth = new Date(year, month + 1, 0);

// ❌ date-fns setter chain
import { setHours, setMinutes, setSeconds } from "date-fns";
const end = setSeconds(setMinutes(setHours(d, 23), 59), 59);

// ❌ Millisecond arithmetic
const tomorrow = new Date(+date + 86400000);

// ❌ Start of year
import { set } from "date-fns";
const startYear = set(d, { month: 0, date: 1, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });

// ❌ End of year
const endYear = set(d, { month: 11, date: 31, hours: 23, minutes: 59, seconds: 59, milliseconds: 999 });

// ❌ Start of month
const startMonth = set(d, { date: 1, hours: 0, minutes: 0, seconds: 0, milliseconds: 0 });

// ❌ Hour boundary
date.setMinutes(0, 0, 0);

// ❌ Minute boundary
date.setSeconds(0, 0);

// ❌ Second boundary
date.setMilliseconds(0);

// ❌ Week start calculation with milliseconds
const weekStart = new Date(+date - date.getDay() * 86400000);
```

### Examples of Correct Code

```js
/*eslint date-fns/no-plain-boundary-math: "error"*/

import { 
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
  startOfHour, endOfHour,
  startOfMinute, endOfMinute,
  startOfSecond,
  addDays
} from "date-fns";

// ✅ Clear, self-documenting boundary helpers
const start = startOfDay(date);
const end = endOfDay(date);

// ✅ Week boundaries with explicit configuration
const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday

// ✅ Month boundaries
const monthStart = startOfMonth(date);
const monthEnd = endOfMonth(date);

// ✅ Year boundaries
const yearStart = startOfYear(date);
const yearEnd = endOfYear(date);

// ✅ Hour/minute/second boundaries
const hourStart = startOfHour(date);
const minuteStart = startOfMinute(date);
const secondStart = startOfSecond(date);

// ✅ Date arithmetic with proper functions
const tomorrow = addDays(date, 1);

// ✅ Composed operations
const nextWeekEnd = endOfWeek(addDays(date, 7));

// ✅ Non-boundary time setting (business logic)
date.setHours(9); // Start of business day (not a boundary)
date.setMinutes(30); // Specific appointment time
date.setHours(businessHourStart, 0); // Variable business hours
```

## Options

This rule accepts an options object with the following properties:

### `weekStartsOn`

- Type: `0 | 1 | 2 | 3 | 4 | 5 | 6`
- Default: `1` (Monday, ISO week)

Specifies the first day of the week. Used when detecting/fixing week boundary patterns.

- `0` = Sunday
- `1` = Monday (default, ISO standard)
- `2` = Tuesday
- `3` = Wednesday
- `4` = Thursday
- `5` = Friday
- `6` = Saturday

Example configuration:

```json
{
  "date-fns/no-plain-boundary-math": ["error", { "weekStartsOn": 0 }]
}
```

### `detectHacks`

- Type: `boolean`
- Default: `true`

Whether to detect and flag complex boundary hacks like millisecond arithmetic.

Example configuration:

```json
{
  "date-fns/no-plain-boundary-math": ["error", { "detectHacks": false }]
}
```

When `false`, only direct setter patterns are detected. Millisecond math is ignored.

Examples of patterns detected when `true`:

```js
// Detected as hack when detectHacks: true
const tomorrow = new Date(+date + 86400000);
const weekStart = new Date(+date - date.getDay() * 86400000);
```

### `suggestOnlyForAmbiguity`

- Type: `boolean`
- Default: `true`

When `true`, ambiguous patterns (variables, complex expressions) only provide suggestions instead of autofixes.

Example configuration:

```json
{
  "date-fns/no-plain-boundary-math": ["error", { "suggestOnlyForAmbiguity": false }]
}
```

When `true` (default), these patterns provide suggestions:

```js
// Provides suggestion, not autofix
date.setHours(startHour, 0, 0, 0); // Variable value

// Provides suggestion with both alternatives
date.setHours(config.boundary ? 0 : 23, 0, 0, 0); // Conditional
```

### `endOfDayHeuristic`

- Type: `"strict" | "lenient" | "aggressive"`
- Default: `"lenient"`

Controls how aggressively end-of-day patterns are detected and autofixed:

#### `"strict"` Mode

Only exact end-of-day patterns trigger autofixes:
- `23:59:59.999` (all fields present)
- "next day minus 1ms" pattern

Near-EOD patterns like `23:59:59` (missing milliseconds) only trigger suggestions.

```json
{
  "date-fns/no-plain-boundary-math": ["error", { "endOfDayHeuristic": "strict" }]
}
```

#### `"lenient"` Mode (Default)

Includes near-EOD patterns in autofixes:
- `23:59:59.999` (autofix)
- `23:59:59` (autofix - missing milliseconds)
- `23:59:59.0` (autofix - explicit zero milliseconds)
- "next day minus 1sec" pattern (autofix)

Very close patterns like `23:58` still only trigger suggestions.

```json
{
  "date-fns/no-plain-boundary-math": ["error", { "endOfDayHeuristic": "lenient" }]
}
```

#### `"aggressive"` Mode

Treats any near-EOD time as EOD intent:
- `23:58+` (any time from 23:58 onwards)
- `23:59` (without seconds)
- Subtracting seconds/minutes from next day

```json
{
  "date-fns/no-plain-boundary-math": ["error", { "endOfDayHeuristic": "aggressive" }]
}
```

**Comparison:**

| Pattern | strict | lenient | aggressive |
|---------|--------|---------|------------|
| `setHours(23, 59, 59, 999)` | ✅ Autofix | ✅ Autofix | ✅ Autofix |
| `setHours(23, 59, 59, 0)` | 💡 Suggest | ✅ Autofix | ✅ Autofix |
| `setHours(23, 59, 59)` | 💡 Suggest | ✅ Autofix | ✅ Autofix |
| `setHours(23, 59)` | 💡 Suggest | 💡 Suggest | ✅ Autofix |
| `setHours(23, 58)` | 💡 Suggest | 💡 Suggest | ✅ Autofix |

### Complete Configuration Example

```json
{
  "rules": {
    "date-fns/no-plain-boundary-math": ["error", {
      "weekStartsOn": 1,
      "detectHacks": true,
      "suggestOnlyForAmbiguity": true,
      "endOfDayHeuristic": "lenient"
    }]
  }
}
```

## When Not To Use It

Disable this rule if:

- You're not using date-fns in your project
- You have custom Date wrappers with specific setter behavior
- You're working with date-like objects that aren't actual Dates
- You have performance-critical code where date-fns overhead is measured and significant
- You're gradually migrating and want to disable for specific files

## Related Rules

- [`no-date-mutation`](./no-date-mutation.md) - Prevents Date mutations entirely
- [`require-isvalid-after-parse`](./require-isvalid-after-parse.md) - Ensures parse result validation
- [`no-magic-time`](./no-magic-time.md) - Flags magic numbers in time calculations

## Version

This rule was introduced in eslint-plugin-date-fns v0.3.0.

## Resources

- [date-fns startOf/endOf helpers documentation](https://date-fns.org/docs/Getting-Started)
- [date-fns GitHub repository](https://github.com/date-fns/date-fns)
