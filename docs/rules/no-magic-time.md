# no-magic-time

Detects numeric literals that appear to be time constants and suggests using named constants or date-fns alternatives instead.

💡 Provides suggestions  
⚠️ Included in `diagnostic` preset

## Usage

This rule is included in the `diagnostic` preset and is set to "warn" by default. The diagnostic preset contains rules that help identify code quality issues but may have false positives in some contexts.

To enable this rule, use the diagnostic preset:

```js
// eslint.config.js
import dateFnsPlugin from "eslint-plugin-date-fns";

export default [
  dateFnsPlugin.configs.diagnostic,
  // ... other configs
];
```

Or configure it manually:

```js
export default [
  {
    plugins: { "date-fns": dateFnsPlugin },
    rules: {
      "date-fns/no-magic-time": "warn", // or "error"
    },
  },
];
```

## Rule Details

This rule identifies "magic" time constants in JavaScript/TypeScript code - numeric literals that likely represent time durations but are not self-documenting. It uses a scoring system to detect patterns like timer arguments, date arithmetic, and time unit multiplications.

Magic time constants create several problems:
- **Maintainability**: `setTimeout(callback, 300000)` is less clear than `setTimeout(callback, FIVE_MINUTES_MS)`
- **Errors**: Easy to confuse milliseconds vs seconds (`5000` vs `5`)
- **DST Issues**: Adding literal day values can break across daylight saving transitions

## Core Concepts

### Sinks

**Sinks** are functions or contexts where time values are commonly consumed. The rule identifies several types of sinks:

1. **Timer Sinks** (+40 points): Functions that accept time delays/intervals
   - `setTimeout(callback, delay)`
   - `setInterval(callback, interval)`
   - Custom timer functions (via `extraSinks` option)

2. **AbortSignal Sinks** (+40 points): Browser API for timeout management
   - `AbortSignal.timeout(milliseconds)`

3. **Date Arithmetic Context** (+30 points): Operations involving dates and time
   - `Date.now() + milliseconds`
   - `date.getTime() + milliseconds`
   - `new Date(timestamp + milliseconds)`

When a numeric literal appears in these sinks, it's highly likely to be a time constant, so the rule adds significant score weight.

### Sources

**Sources** are patterns that commonly produce or manipulate time values. The rule recognizes:

1. **Date.now()**: Returns current timestamp in milliseconds
2. **date.getTime()**: Returns timestamp of a Date object
3. **new Date(timestamp)**: Creates Date from millisecond timestamp
4. **Timestamp variables**: Identifiers named with time-related keywords

When arithmetic involves these sources combined with numeric literals, it's a strong signal that the literal represents a time duration.

### Score Calculation

The rule uses a **scoring system** to distinguish time constants from other numeric literals. Each detected pattern adds or subtracts points:

**Positive Signals (likely time):**
- Timer/AbortSignal sink context: **+40 points**
- Date arithmetic (with Date.now(), .getTime()): **+30 points**
- Multiplication chains (5 \* 60 \* 1000): **+30 points**
- Exact time unit match (60000 = 1 minute): **+25 points**
- Identifier hints ("timeout", "delay", "interval"): **+15 points each**
- Comment hints ("minutes", "seconds"): **+15 points**
- Bucketing patterns (timestamp % N): **+15 points**
- Seconds/milliseconds conversion (\* 1000 or / 1000): **+15 points**

**Negative Signals (likely not time):**
- File size patterns (1024, 1048576): **-35 points**

**Threshold:** Only literals scoring ≥ `minimumScore` (default: 30) are flagged.

### Pattern Recognition

The rule identifies several **time-related patterns**:

1. **Exact Time Units**: Recognizes ~40 common time values
   - Milliseconds: 100, 250, 500, 1000 (1 sec), 5000 (5 sec), etc.
   - Minutes: 60000 (1 min), 300000 (5 min), 1800000 (30 min), etc.
   - Hours: 3600000 (1 hr), 43200000 (12 hrs), etc.
   - Days/Weeks: 86400000 (1 day), 604800000 (1 week), etc.

2. **Multiplication Chains**: Time unit conversions
   - `5 * 60 * 1000` = 5 minutes in milliseconds
   - `24 * 60 * 60 * 1000` = 24 hours in milliseconds
   - Pattern: Multiple multiplications where factors resemble time units (60, 24, 7, 1000)

3. **Identifier Hints**: Variable/parameter names suggesting time
   - Contains: "timeout", "delay", "interval", "duration", "wait", "ttl", "expire"
   - Suffixes: "Ms", "Millis", "Seconds"
   - **Note**: All-caps constant names (e.g., `TIMEOUT`, `DELAY_MS`) are skipped for identifier hints, as they're assumed to be intentionally named constants

4. **Comment Hints**: Code comments mentioning time units
   - Words: "millisecond", "second", "minute", "hour", "day", "week"
   - Examples: `setTimeout(fn, 5000); // 5 seconds`

### Analysis Flow

Here's how the rule analyzes a numeric literal:

```
┌─────────────────────────────────┐
│  Numeric Literal Encountered    │
│  (e.g., 5000)                   │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Check if in ignore list        │
│  (ignoreValues option)          │
└────┬────────────────────────┬───┘
     │ Not ignored            │ Ignored
     ▼                        ▼
┌─────────────────┐      ┌─────────┐
│  Start scoring  │      │  Skip   │
│  (base = 0)     │      └─────────┘
└────────┬────────┘
         │
         ▼
┌───────────────────────────────────┐
│  Detect Context & Patterns        │
├───────────────────────────────────┤
│  • Is in timer sink? (+40)        │
│  • Is in date arithmetic? (+30)   │
│  • Has multiplication chain? (+30)│
│  • Matches exact time unit? (+25) │
│  • Has identifier hints? (+15)    │
│  • Has comment hints? (+15)       │
│  • Is file size pattern? (-35)    │
│  • Is in bitwise op? (-25)        │
└────────┬──────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Calculate Final Score          │
│  (sum all applicable bonuses)   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Score >= minimumScore?         │
│  (default: 30)                  │
└────┬────────────────────┬───────┘
     │ Yes                │ No
     ▼                    ▼
┌─────────────┐      ┌─────────┐
│  Report     │      │  Allow  │
│  violation  │      └─────────┘
└─────────────┘
```

### Examples

#### ❌ Incorrect

```js
/*eslint date-fns/no-magic-time: "error"*/

// Timer contexts with magic numbers
setTimeout(doWork, 5000);              // 5 seconds
setInterval(poll, 60000);              // 1 minute  
setTimeout(cleanup, 5 * 60 * 1000);    // 5 minutes

// Date arithmetic with magic numbers
const later = Date.now() + 300000;     // 5 minutes from now
const tomorrow = new Date(date.getTime() + 86400000); // DST hazard!

// AbortSignal with magic timeouts
const signal = AbortSignal.timeout(30000); // 30 seconds
```

#### ✅ Correct

```js
/*eslint date-fns/no-magic-time: "error"*/

// Using named constants
const FIVE_SECONDS_MS = 5000;
setTimeout(doWork, FIVE_SECONDS_MS);

const ONE_MINUTE_MS = 60000;
setInterval(poll, ONE_MINUTE_MS);

// Using date-fns for date arithmetic
import { addMinutes, addDays } from 'date-fns';
const later = addMinutes(new Date(), 5);
const tomorrow = addDays(date, 1); // Handles DST correctly

// Non-time constants are ignored
const PORT = 3000;        // Port number
const BUFFER_SIZE = 1024; // File size
const HTTP_OK = 200;      // Status code
```

## How It Works

The rule uses a scoring system that examines numeric literals in context:

**High-scoring patterns (likely time constants):**
- **Timer contexts (+40)**: Arguments to `setTimeout`, `setInterval`, `AbortSignal.timeout`
- **Date arithmetic (+30)**: Used with `Date.now()`, `.getTime()`, `new Date()`
- **Multiplication chains (+30)**: Patterns like `5 * 60 * 1000` (time unit conversions)
- **Exact time units (+25)**: Known values like `1000` (1 second), `60000` (1 minute), `86400000` (1 day)
- **Identifier hints (+15)**: Variable names containing "timeout", "delay", "interval", etc.
- **Comment hints (+15)**: Comments mentioning time units

**Low-scoring patterns (likely not time):**
- **File sizes (-35)**: Powers of 2 like `1024`, `1048576`

Only literals scoring above the threshold (default: 30) are reported.

### Detection Examples

Understanding how scores accumulate helps predict what the rule will flag:

**Example 1: Timer with exact unit**
```js
setTimeout(callback, 5000);
// Score: 40 (timer sink) + 25 (exact: 5 seconds) = 65 ✅ Flagged
```

**Example 2: Exact unit alone**
```js
const timeout = 60000;
// Score: 25 (exact: 1 minute) + 15 (identifier: "timeout") = 40 ✅ Flagged (>= 30 default threshold)
```

**Example 3: Date arithmetic**
```js
const later = Date.now() + 300000;
// Score: 30 (date arithmetic) + 25 (exact: 5 minutes) = 55 ✅ Flagged
```

**Example 4: Multiplication chain with timer**
```js
setTimeout(fn, 5 * 60 * 1000);
// Score: 40 (timer) + 30 (multiplication chain) + 25 (exact: 5 min) = 95 ✅ Flagged
```

**Example 5: Port number (not flagged)**
```js
const PORT = 3000;
// Score: 25 (exact: 3 seconds) = 25 ❌ Not flagged (below 30 threshold)
// Note: All-caps constant names don't receive identifier hints
```

**Example 6: File size (false positive avoided)**
```js
const BUFFER = 1024;
// Score: 0 (not exact time unit) - 35 (file size pattern) = -35 ❌ Not flagged
```

## Options

```js
{
  "rules": {
    "date-fns/no-magic-time": ["error", {
      "minimumScore": 50,                    // Score threshold (default: 30)
      "ignoreValues": [5000],                // Specific numbers to ignore
      "ignoreIdentifiers": ["custom.*"],     // Regex patterns for variable names to ignore
      "extraSinks": ["myCustomWait"]         // Additional timer-like functions
    }]
  }
}
```

### `minimumScore`

Controls how strict the rule is. Lower values catch more potential time constants but may increase false positives.

- `20`: Very Aggressive - catches most time-like patterns
- `30`: Balanced (default) - catches exact units with identifier hints
- `50`: Moderate - requires strong context (timer sinks or date arithmetic)
- `70`: Conservative - only flags high-confidence patterns with multiple signals

**Example:**
```js
// With minimumScore: 20
const TIMEOUT = 60000; // ❌ Flagged (exact unit = 25 points + identifier hint = 15 points = 40 total)

// With minimumScore: 30 (default)
const TIMEOUT = 60000; // ❌ Flagged (score = 40 >= 30)
setTimeout(fn, 60000); // ❌ Flagged (timer sink = 40 + exact unit = 25 = 65 total)

// With minimumScore: 50
const TIMEOUT = 60000; // ✅ Allowed (score 40 < 50)
setTimeout(fn, 60000); // ❌ Flagged (score = 65 >= 50)
```

### `ignoreValues`

Array of specific numeric values to never report:

```js
{
  "date-fns/no-magic-time": ["error", {
    "ignoreValues": [5000, 10000] // Never flag these specific values
  }]
}
```

**Use case:** When specific timeout values are organizational standards:
```js
// With ignoreValues: [5000]
setTimeout(callback, 5000);  // ✅ Allowed (explicitly ignored)
setTimeout(callback, 10000); // ❌ Flagged (not in ignore list)
```

### `ignoreIdentifiers` 

Array of regex patterns. Variables matching these patterns won't be reported:

```js
{
  "date-fns/no-magic-time": ["error", {
    "ignoreIdentifiers": ["^CONFIG_.*", "LEGACY_.*"] // Ignore config constants
  }]
}
```

**Use case:** Legacy code or configuration constants:
```js
// With ignoreIdentifiers: ["^CONFIG_.*"]
const CONFIG_TIMEOUT = 30000;  // ✅ Allowed (matches pattern)
const userTimeout = 30000;     // ❌ Flagged (doesn't match pattern)
```

### `extraSinks`

Array of additional function names to treat as timer sinks (like `setTimeout`). These functions receive **+40 points** when numeric literals appear as arguments, treating them as custom timer functions.

```js
{
  "date-fns/no-magic-time": ["error", {
    "extraSinks": ["myCustomWait", "scheduleTask", "debounce"]
  }]
}
```

**Use case:** Custom timer utilities in your codebase:
```js
// With extraSinks: ["myCustomWait"]
myCustomWait(callback, 5000);  // ❌ Flagged (treated like setTimeout)
regularFunction(callback, 5000); // ✅ Allowed (not a recognized sink)
```

## When Not To Use It

This rule may not be suitable if:

- Your codebase has many legitimate non-time numeric constants that trigger false positives
- You're working with legacy code where large-scale refactoring isn't practical
- Your team prefers inline magic numbers for brevity in certain contexts
- You're writing performance-critical code where named constants might be undesirable

## Common Patterns

### Glossary

- **Magic Number**: A numeric literal whose meaning isn't immediately clear from context
- **Sink**: A function or context that consumes time values (e.g., `setTimeout`, date arithmetic)
- **Source**: A function or pattern that produces time values (e.g., `Date.now()`, `.getTime()`)
- **Score**: Accumulated points based on detected patterns; higher scores = more likely to be a time constant
- **Threshold**: Minimum score required to report a violation (default: 30)
- **Exact Time Unit**: A numeric literal that exactly matches a known time duration (e.g., 60000 = 1 minute)
- **Multiplication Chain**: Expression like `5 * 60 * 1000` representing time unit conversion
- **Identifier Hint**: Variable/parameter name suggesting time-related purpose (e.g., "timeout", "delay")

### Timer Functions
```js
// ❌ Magic numbers
setTimeout(callback, 5000);
setInterval(poller, 30000);

// ✅ Named constants  
const RETRY_DELAY_MS = 5000;
const POLL_INTERVAL_MS = 30000;
setTimeout(callback, RETRY_DELAY_MS);
setInterval(poller, POLL_INTERVAL_MS);
```

### Date Arithmetic
```js
// ❌ Magic arithmetic
const expiry = Date.now() + 86400000;
const lastWeek = new Date(date.getTime() - 604800000);

// ✅ date-fns alternatives
import { addDays, subWeeks } from 'date-fns';
const expiry = addDays(new Date(), 1);
const lastWeek = subWeeks(date, 1);
```

### Multiplication Chains
```js
// ❌ Cryptic calculations
const cacheTime = 5 * 60 * 1000;        // 5 minutes
const sessionLength = 24 * 60 * 60 * 1000; // 24 hours

// ✅ Clear constants
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
```

## Related Rules

- [`prefer-date-fns-from-epoch`] - Suggests date-fns alternatives to `Date.now()` arithmetic
- [`no-date-constructor-string`] - Prevents error-prone date string parsing

## Version

This rule was introduced in eslint-plugin-date-fns v0.1.0.