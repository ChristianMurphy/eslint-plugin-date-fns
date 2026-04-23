# no-namespace-date-fns-import

Disallow namespace-style imports of date-fns packages, which defeat
tree-shaking.

## Rule Details

`import * as dateFns from 'date-fns'` binds the entire package under one
identifier. Bundlers cannot tree-shake what the consumer actually uses,
so every member of the package is pulled into the output (hundreds of
functions, tens of KB). Named imports reach each export individually and
tree-shake cleanly.

The rule flags:

- `import * as X from '<pkg>'` where `<pkg>` is in the configured package
  list (default `date-fns`, `date-fns/fp`, `@date-fns/tz`).
- `const X = require('<pkg>')` with a string-literal source. The
  destructuring form `const { format } = require('<pkg>')` is fine; each
  export is reached directly.

The rule does not flag:

- Named imports: `import { format } from 'date-fns'`.
- Default-style subpath imports: `import format from 'date-fns/format'`.
- Type-only namespace imports: `import type * as Types from 'date-fns'`.
  Types are erased at runtime and have no bundle cost.
- Namespace imports from packages not on the list.

## Examples

### ❌ Incorrect

```ts
/*eslint date-fns/no-namespace-date-fns-import: "warn"*/

import * as dateFns from 'date-fns';
import * as df from 'date-fns/fp';
import * as tz from '@date-fns/tz';
const dateFnsCjs = require('date-fns');
```

### ✅ Correct

```ts
/*eslint date-fns/no-namespace-date-fns-import: "warn"*/

import { format, parseISO } from 'date-fns';
import format from 'date-fns/format';
import { tz } from '@date-fns/tz';
const { format, parseISO } = require('date-fns');
import type * as DateFnsTypes from 'date-fns';
```

## Autofix and Suggestions

This rule reports but does not autofix. Safely rewriting `dateFns.format(d)`
back to a named import requires scanning every usage site in the file to
determine which members are actually used, which is more work than a
linter autofix should take on. Apply the fix by hand.

## Options

```json
{
  "date-fns/no-namespace-date-fns-import": [
    "warn",
    { "packages": ["date-fns", "date-fns/fp", "@date-fns/tz"] }
  ]
}
```

- `packages` (string[], default:
  `["date-fns", "date-fns/fp", "@date-fns/tz"]`): list of package
  specifiers whose namespace imports should be flagged. Extend if you
  publish an internal date-fns wrapper.

## When Not To Use It

In scripts where bundle size does not matter (CLI tools, build scripts,
tests) the rule can be disabled per-file.

## Related Rules

None.

## Version

This rule was introduced in eslint-plugin-date-fns v0.7.0.
