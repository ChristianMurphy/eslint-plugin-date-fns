import { TSESTree, TSESLint } from "@typescript-eslint/utils";

/**
 * Minimal interface for comment context - only what getCommentHints needs
 */
export interface CommentContext {
  sourceCode: { getAllComments: () => TSESLint.AST.Token[] };
}

/**
 * Time-related keywords for identifier matching (case-insensitive).
 * Used to detect time-related variable names like "timeout", "delay", etc.
 */
export const IDENTIFIER_TIME_KEYWORDS = [
  "timeout",
  "delay",
  "interval",
  "duration",
  "time",
  "timer",
  "ms",
  "millisecond",
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "ttl",
  "expiry",
  "expire",
  "expires",
  "wait",
] as const;

/**
 * Time-related keywords for comment matching (case-insensitive).
 * Ordered by length (longest first) to avoid partial matches.
 * For example, "milliseconds" should match before "ms".
 */
export const COMMENT_TIME_KEYWORDS = [
  "milliseconds",
  "seconds",
  "minutes",
  "hours",
  "days",
  "weeks",
  "millisecond",
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "ms",
  "sec",
  "min",
  "hr",
] as const;

/**
 * Regular expression pattern to identify properly named constants.
 * Matches uppercase identifiers with underscores (e.g., MY_CONSTANT, TIME_MS).
 */
export const CONSTANT_NAME_PATTERN = /^[A-Z][A-Z_0-9]*$/;

/**
 * Extract time-related hints from identifier names in the AST.
 *
 * Traverses up the AST from the given node to find variable declarations
 * and extracts time-related keywords from the identifier name.
 *
 * Features:
 * - Skips properly named constants (ALL_CAPS_WITH_UNDERSCORES)
 * - Supports snake_case identifiers by splitting on underscores
 * - Case-insensitive matching
 * - Deduplicates hints
 *
 * @param node - The AST node to start searching from
 * @returns Array of time-related keyword hints found in identifiers
 *
 * @example
 * // For: const timeout = 5000;
 * getIdentifierHints(node) // ["timeout"]
 *
 * @example
 * // For: const retry_delay = 10000;
 * getIdentifierHints(node) // ["delay"]
 *
 * @example
 * // For: const REQUEST_TIMEOUT = 30000; (already a constant)
 * getIdentifierHints(node) // [] (stops at properly named constant)
 */
export function getIdentifierHints(node: TSESTree.Node): string[] {
  const hints: string[] = [];
  let current = node.parent;

  // Look for variable declarations and assignments
  while (current) {
    if (
      current.type === "VariableDeclarator" &&
      current.id.type === "Identifier"
    ) {
      const name = current.id.name;

      // Skip if this looks like a properly named constant (all caps with underscores)
      if (CONSTANT_NAME_PATTERN.test(name)) {
        break;
      }

      const foundHints = new Set<string>();

      // Split snake_case identifiers to check each part
      const nameParts = name.includes("_") ? name.split("_") : [name];

      for (const part of nameParts) {
        for (const keyword of IDENTIFIER_TIME_KEYWORDS) {
          if (part.toLowerCase().includes(keyword.toLowerCase())) {
            foundHints.add(keyword);
          }
        }
      }

      hints.push(...foundHints);
      break;
    }
    current = current.parent;
  }

  return hints;
}

/**
 * Extract time-related hints from comments on the same line as the node.
 *
 * Searches for inline comments (both // and /* *\/) on the same line as
 * the given node and extracts time-related keywords.
 *
 * Features:
 * - Only matches comments on the same line as the node
 * - Case-insensitive matching
 * - Priority-ordered keywords (longer matches first)
 * - Stops at first match to avoid partial matches
 * - Deduplicates hints
 *
 * @param node - The AST node to find comments for
 * @param context - The ESLint rule context (provides source code access)
 * @returns Array of time-related keyword hints found in comments
 *
 * @example
 * // For: const delay = 5000; // 5 seconds
 * getCommentHints(node, context) // ["seconds"]
 *
 * @example
 * // For: setTimeout(fn, 10000); /* 10 sec *\/
 * getCommentHints(node, context) // ["sec"]
 *
 * @example
 * // For: const wait = 60000; // 1 minute timeout
 * getCommentHints(node, context) // ["minute"] (stops at first match)
 */
export function getCommentHints(
  node: TSESTree.Node,
  context: CommentContext,
): string[] {
  const hints: string[] = [];
  const sourceCode = context.sourceCode;

  // Get all comments and filter for ones on the same line
  const allComments = sourceCode.getAllComments();

  for (const comment of allComments) {
    if (
      comment.loc &&
      node.loc &&
      comment.loc.start.line === node.loc.end.line
    ) {
      const commentText = comment.value.toLowerCase();

      // Find all keyword matches with their positions
      const matches: Array<{ keyword: string; start: number; end: number }> =
        [];

      // COMMENT_TIME_KEYWORDS is ordered longest-first to prefer longer matches
      for (const keyword of COMMENT_TIME_KEYWORDS) {
        let searchStart = 0;
        while (true) {
          const index = commentText.indexOf(keyword, searchStart);
          if (index === -1) break;

          matches.push({
            keyword,
            start: index,
            end: index + keyword.length,
          });
          searchStart = index + 1; // Continue searching for more occurrences
        }
      }

      // Sort by position, then by length (longer first) to prefer longer keywords at same position
      matches.sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        return b.keyword.length - a.keyword.length;
      });

      // Filter out overlapping matches, keeping longer ones
      const foundHints = new Set<string>();
      const usedRanges: Array<{ start: number; end: number }> = [];

      for (const match of matches) {
        // Check if this match overlaps with any already-used range
        const overlaps = usedRanges.some(
          (range) => match.start < range.end && match.end > range.start,
        );

        if (!overlaps) {
          foundHints.add(match.keyword);
          usedRanges.push({ start: match.start, end: match.end });
        }
      }

      hints.push(...foundHints);
    }
  }

  return hints;
}
