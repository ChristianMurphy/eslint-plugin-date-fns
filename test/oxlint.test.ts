import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

/**
 * Maps each positive fixture basename to the rule its content must trigger.
 * A single file may trigger other rules too, but the listed one is the
 * contract being tested.
 */
const expectedByFixture: Record<string, string> = {
  "no-bare-date-call.ts": "date-fns(no-bare-date-call)",
  "no-date-constructor-string.ts": "date-fns(no-date-constructor-string)",
  "no-date-coercion-literals.ts": "date-fns(no-date-coercion-literals)",
  "no-legacy-year-components.ts": "date-fns(no-legacy-year-components)",
  "no-date-mutation.ts": "date-fns(no-date-mutation)",
  "no-plain-boundary-math.ts": "date-fns(no-plain-boundary-math)",
  "prefer-date-fns-from-epoch.ts": "date-fns(prefer-date-fns-from-epoch)",
  "prefer-iso-literal-over-components.ts":
    "date-fns(prefer-iso-literal-over-components)",
  "require-isvalid-after-parse.ts": "date-fns(require-isvalid-after-parse)",
  "no-magic-time.ts": "date-fns(no-magic-time)",
  "prefer-date-fns-comparison.ts": "date-fns(prefer-date-fns-comparison)",
  "prefer-difference-in-unit.ts": "date-fns(prefer-difference-in-unit)",
  "no-date-in-string-interpolation.ts":
    "date-fns(no-date-in-string-interpolation)",
  "no-namespace-date-fns-import.ts": "date-fns(no-namespace-date-fns-import)",
};

interface OxlintDiagnostic {
  readonly code: string;
  readonly filename: string;
  readonly severity: string;
  readonly message: string;
}

interface OxlintReport {
  readonly diagnostics: readonly OxlintDiagnostic[];
}

function runOxlint(): OxlintReport {
  const distributionEntry = path.join(repoRoot, "dist/index.js");
  assert.ok(
    existsSync(distributionEntry),
    `oxlint tests require the built plugin at ${distributionEntry}. Run \`npm run build\` first.`,
  );

  // Resolve the oxlint binary directly from node_modules — avoids relying on
  // the ambient PATH and satisfies sonarjs/no-os-command-from-path.
  const oxlintBin = path.join(repoRoot, "node_modules/.bin/oxlint");

  const result = spawnSync(
    oxlintBin,
    [
      "--config",
      ".oxlintrc.json",
      "-f",
      "json",
      "test/fixtures/oxlint/positive",
      "test/fixtures/oxlint/negative",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );

  assert.equal(
    result.error,
    undefined,
    `Failed to spawn oxlint: ${String(result.error)}`,
  );

  const stdout = result.stdout ?? "";
  assert.ok(stdout.length > 0, `oxlint produced no stdout: ${result.stderr}`);

  return JSON.parse(stdout) as OxlintReport;
}

const report = runOxlint();

const diagsByFixture = new Map<string, OxlintDiagnostic[]>();
for (const d of report.diagnostics) {
  const basename = path.basename(d.filename);
  const bucket = diagsByFixture.get(basename) ?? [];
  bucket.push(d);
  diagsByFixture.set(basename, bucket);
}

for (const [fixture, expectedCode] of Object.entries(expectedByFixture)) {
  test(`oxlint: ${fixture} triggers ${expectedCode}`, () => {
    const diags = diagsByFixture.get(fixture) ?? [];
    const codes = diags.map((d) => d.code);
    assert.ok(
      codes.includes(expectedCode),
      `expected ${expectedCode} in ${fixture}, got: ${JSON.stringify(codes)}`,
    );
  });
}

test("oxlint: negative corpus produces no diagnostics", () => {
  const negativeFiles = report.diagnostics.filter((d) =>
    d.filename.replaceAll("\\", "/").includes("/fixtures/oxlint/negative/"),
  );
  assert.deepEqual(
    negativeFiles,
    [],
    `negative corpus should be clean, got: ${JSON.stringify(negativeFiles, undefined, 2)}`,
  );
});
