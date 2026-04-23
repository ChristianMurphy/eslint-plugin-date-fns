import test from "node:test";
import { runOnBoth } from "../_setup.ts";
import rule from "../../dist/rules/no-namespace-date-fns-import/index.js";

test("no-namespace-date-fns-import: valid cases", () => {
  runOnBoth("no-namespace-date-fns-import", rule, {
    valid: [
      // Named imports
      `import { format } from 'date-fns';`,
      `import { format, parseISO } from 'date-fns';`,
      `import { format as dfFormat } from 'date-fns';`,
      `import format from 'date-fns/format';`,
      `import { tz } from '@date-fns/tz';`,

      // Destructured require — each export reached directly
      `const { format } = require('date-fns');`,
      `const { format, parseISO } = require('date-fns');`,

      // Type-only namespace import — types are erased at runtime
      `import type * as DateFnsTypes from 'date-fns';`,

      // Namespace imports from other packages — out of scope
      `import * as React from 'react';`,
      `import * as path from 'node:path';`,
      `const path = require('node:path');`,

      // Dynamic require — source isn't a string literal
      `const pkg = 'date-fns'; const df = require(pkg);`,

      // Unlisted subpath — exact-match semantics
      `import * as fn from 'date-fns/format';`,
    ],
    invalid: [],
  });
});

test("no-namespace-date-fns-import: namespace imports", () => {
  runOnBoth("no-namespace-date-fns-import", rule, {
    valid: [],
    invalid: [
      // import * as dateFns from 'date-fns'
      {
        code: `import * as dateFns from 'date-fns';`,
        errors: [{ messageId: "noNamespaceImport" }],
      },

      // Short alias
      {
        code: `import * as df from 'date-fns';`,
        errors: [{ messageId: "noNamespaceImport" }],
      },

      // date-fns/fp entrypoint
      {
        code: `import * as dateFns from 'date-fns/fp';`,
        errors: [{ messageId: "noNamespaceImport" }],
      },

      // @date-fns/tz
      {
        code: `import * as tz from '@date-fns/tz';`,
        errors: [{ messageId: "noNamespaceImport" }],
      },

      // CommonJS bag
      {
        code: `const dateFns = require('date-fns');`,
        errors: [{ messageId: "noNamespaceImport" }],
      },

      // CommonJS bag with date-fns/fp
      {
        code: `const df = require('date-fns/fp');`,
        errors: [{ messageId: "noNamespaceImport" }],
      },
    ],
  });
});

test("no-namespace-date-fns-import: configurable packages", () => {
  runOnBoth("no-namespace-date-fns-import", rule, {
    valid: [
      // Default list would flag this, but the option excludes @date-fns/tz
      {
        code: `import * as tz from '@date-fns/tz';`,
        options: [{ packages: ["date-fns"] }],
      },
    ],
    invalid: [
      // User added a custom package to the list
      {
        code: `import * as helpers from 'my-date-fns-wrapper';`,
        options: [{ packages: ["date-fns", "my-date-fns-wrapper"] }],
        errors: [{ messageId: "noNamespaceImport" }],
      },
    ],
  });
});
