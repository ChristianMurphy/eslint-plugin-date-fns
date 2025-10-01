/**
 * Converts numbers to words for use in constant names.
 * Handles numbers from 0 to 99,999 (sufficient for millisecond time constants).
 *
 * @example
 * numberToWords(5) // "FIVE"
 * numberToWords(45) // "FORTY_FIVE"
 * numberToWords(100) // "ONE_HUNDRED"
 * numberToWords(1000) // "ONE_THOUSAND"
 * numberToWords(5000) // "FIVE_THOUSAND"
 * numberToWords(45000) // "FORTY_FIVE_THOUSAND"
 */
export function numberToWords(n: number): string {
  const ones = [
    "ZERO",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];

  const tens = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
  ];

  // Handle 0-19
  if (n < 20) {
    return ones[n] ?? String(n);
  }

  // Handle 20-99
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const one = n % 10;
    return one === 0 ? (tens[ten] ?? String(n)) : `${tens[ten]}_${ones[one]}`;
  }

  // Handle 100-999
  if (n < 1000) {
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;

    const hundredPart = `${ones[hundred]}_HUNDRED`;

    if (remainder === 0) {
      return hundredPart;
    }

    return `${hundredPart}_${numberToWords(remainder)}`;
  }

  // Handle 1000-99999
  if (n < 100_000) {
    const thousand = Math.floor(n / 1000);
    const remainder = n % 1000;

    const thousandPart =
      thousand < 20
        ? `${ones[thousand]}_THOUSAND`
        : `${numberToWords(thousand)}_THOUSAND`;

    if (remainder === 0) {
      return thousandPart;
    }

    return `${thousandPart}_${numberToWords(remainder)}`;
  }

  // For numbers >= 100,000, just return the numeric string
  return String(n);
}

/**
 * Converts a time constant label to a valid constant name.
 * Extracts the descriptive part before "in milliseconds" and converts
 * numbers to words while keeping text uppercase.
 *
 * @example
 * labelToConstantName("5 minutes in milliseconds") // "FIVE_MINUTES_MILLISECONDS"
 * labelToConstantName("1 hour in milliseconds") // "ONE_HOUR_MILLISECONDS"
 * labelToConstantName("30 days in milliseconds") // "THIRTY_DAYS_MILLISECONDS"
 * labelToConstantName("1.5 seconds in milliseconds") // "1_5_SECONDS_MILLISECONDS"
 * labelToConstantName("300 milliseconds") // "THREE_HUNDRED_MILLISECONDS"
 * labelToConstantName("1 millisecond") // "ONE_MILLISECOND"
 */
export function labelToConstantName(label: string): string {
  // Extract the readable part (everything before " in milliseconds" if present)
  // Otherwise, use the whole label (for "100 milliseconds" format)
  const match = label.match(/^(.+?)(?: in milliseconds)?$/);
  if (!match || !match[1]) {
    return "TIME_CONSTANT_MILLISECONDS";
  }

  const readablePart = match[1];

  // Parse patterns like "5 minutes", "1.5 seconds", "30 days", "300 milliseconds"
  const words = readablePart.split(/\s+/);
  const result: string[] = [];
  let hasMillisecondsWord = false;

  for (const word of words) {
    // Check if this word is "milliseconds" or "millisecond"
    if (
      word.toLowerCase() === "milliseconds" ||
      word.toLowerCase() === "millisecond"
    ) {
      hasMillisecondsWord = true;
      // Keep the word as-is (will be handled at the end)
      result.push(word.toUpperCase());
      continue;
    }

    // Try to parse as number
    const numericValue = Number.parseFloat(word);
    if (Number.isNaN(numericValue)) {
      // Keep non-numeric words as-is (uppercased)
      result.push(word.toUpperCase());
    } else if (numericValue % 1 === 0) {
      // Convert whole numbers to words
      result.push(numberToWords(numericValue));
    } else {
      // For decimals, use the string representation with underscore
      result.push(word.replace(".", "_"));
    }
  }

  const joined = result.join("_");

  // If the label already contains "milliseconds", don't add suffix
  if (hasMillisecondsWord) {
    // Handle singular case: "ONE_MILLISECOND" not "ONE_MILLISECONDS"
    if (joined === "ONE_MILLISECONDS") {
      return "ONE_MILLISECOND";
    }
    return joined;
  }

  // Otherwise append _MILLISECONDS
  return joined + "_MILLISECONDS";
}
