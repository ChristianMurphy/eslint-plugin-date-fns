/**
 * Pads number to 2 digits with leading zeros.
 */
export function pad2(number: number): string {
  return String(number).padStart(2, "0");
}

/**
 * Pads number to 3 digits with leading zeros.
 */
export function pad3(number: number): string {
  return String(number).padStart(3, "0");
}

/**
 * Creates UTC ISO 8601 string from date component numbers.
 */
export function synthesizeUtcIso(
  year: number,
  monthIndex: number,
  day?: number,
  hour?: number,
  minute?: number,
  second?: number,
  millisecond?: number,
): string {
  const yearString = String(year).padStart(4, "0");
  const monthString = pad2(monthIndex + 1);
  const dayString = pad2(day ?? 1);
  const hourString = pad2(hour ?? 0);
  const minuteString = pad2(minute ?? 0);
  const secondString = pad2(second ?? 0);
  const millisecondString = pad3(millisecond ?? 0);
  return `${yearString}-${monthString}-${dayString}T${hourString}:${minuteString}:${secondString}.${millisecondString}Z`;
}
