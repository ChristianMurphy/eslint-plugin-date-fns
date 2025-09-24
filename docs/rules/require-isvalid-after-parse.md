# require-isvalid-after-parse

Require calling isValid after parse functions before using the result.

💡 Provides suggestions

## Rule Details

This rule requires calling `isValid()` after using `parse()`, `parseISO()`, or similar parsing functions that can return Invalid Date objects. Parsing functions can fail silently and produce invalid dates that cause runtime errors when used in calculations or formatting. Adding validation guards prevents subtle bugs.

### Examples

#### Incorrect

```js
/*eslint date-fns/require-isvalid-after-parse: "error"*/

import { parseISO, format, addDays } from 'date-fns';

// Direct usage without validation
function formatDate(dateString) {
  const date = parseISO(dateString);
  return format(date, 'yyyy-MM-dd');  // Could throw if date is invalid
}

// Using in calculations without checking
function addWeek(isoString) {
  const date = parseISO(isoString);  
  return addDays(date, 7);  // Could produce invalid results
}

// Multiple uses without validation
function processDate(input) {
  const parsed = parseISO(input);
  console.log(parsed.getTime());  // Could be NaN
  return format(parsed, 'MMM d, yyyy');  // Could throw
}

// Assignment and immediate use
function getYear(dateStr) {
  const d = parseISO(dateStr);
  return d.getFullYear();  // Could be NaN
}

// Return without validation (when not immediately returned)
function parseUserDate(input) {
  const result = parseISO(input);
  // Some other logic here
  someOtherFunction();
  return result;  // Should validate before return
}

// Property access without validation
function getTimestamp(iso) {
  const date = parseISO(iso);
  return {
    timestamp: date.getTime(),  // Could be NaN
    formatted: format(date, 'yyyy-MM-dd')  // Could throw
  };
}
```

#### Correct

```js
/*eslint date-fns/require-isvalid-after-parse: "error"*/

import { parseISO, format, addDays, isValid } from 'date-fns';

// Proper validation before use
function formatDate(dateString) {
  const date = parseISO(dateString);
  if (!isValid(date)) {
    return null;  // or throw error
  }
  return format(date, 'yyyy-MM-dd');
}

// Validation before calculations
function addWeek(isoString) {
  const date = parseISO(isoString);
  if (!isValid(date)) {
    throw new Error('Invalid date string');
  }
  return addDays(date, 7);
}

// Early validation covers all uses in scope
function processDate(input) {
  const parsed = parseISO(input);
  if (!isValid(parsed)) {
    return null;
  }
  console.log(parsed.getTime());
  return format(parsed, 'MMM d, yyyy');
}

// Immediate return after validation
function parseAndReturn(input) {
  const date = parseISO(input);
  if (!isValid(date)) return null;
  return date;
}

// Validation with early return
function getYear(dateStr) {
  const d = parseISO(dateStr);
  if (!isValid(d)) return null;
  return d.getFullYear();
}

// Different validation patterns
function handleDates(iso1, iso2) {
  const date1 = parseISO(iso1);
  const date2 = parseISO(iso2);
  
  // Both must be valid
  if (!isValid(date1) || !isValid(date2)) {
    throw new Error('Invalid dates provided');
  }
  
  return { date1, date2 };
}

// Using ternary for inline validation
function quickFormat(dateStr) {
  const date = parseISO(dateStr);
  return isValid(date) ? format(date, 'yyyy-MM-dd') : 'Invalid date';
}

// When not assigning to variable, no validation needed
function directUse(input) {
  return isValid(parseISO(input)) ? parseISO(input) : null;
}
```

## Suggestion Behavior

This rule provides suggestions (not automatic fixes) because validation logic is context-dependent. The suggestions include:

- Adding `if (!isValid(variable)) return null;` before usage
- Adding `if (!isValid(variable)) throw new Error('Invalid date');` for strict validation
- Wrapping usage in conditional: `isValid(date) ? useDate(date) : fallback`

The rule analyzes control flow to determine where validation is needed and suggests appropriate guard patterns.

## Targeted Parse Functions

This rule monitors these date-fns parsing functions:

- `parseISO()` - Parses ISO date strings
- `parse()` - Parses with custom format
- `parseJSON()` - Parses JSON date strings  
- `fromUnixTime()` - Converts Unix timestamps (can overflow)

## When Not To Use It

Disable this rule if:

- You have external validation that ensures parse input is always valid
- Your error handling strategy intentionally allows Invalid Date objects to propagate
- You're using parsing functions in contexts where Invalid Date is acceptable
- Performance is critical and you can guarantee valid inputs

## Related Rules

- [`no-date-constructor-string`](./no-date-constructor-string.md) - Prevents unreliable Date string parsing
- [`prefer-iso-literal-over-components`](./prefer-iso-literal-over-components.md) - Prefers safer ISO literals

## Version

This rule was introduced in eslint-plugin-date-fns v1.0.0.
