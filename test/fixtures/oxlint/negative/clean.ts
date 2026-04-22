import { parseISO, isValid, addDays, startOfDay, toDate } from "date-fns";

export function safeParse(s: string) {
  const d = parseISO(s);
  if (!isValid(d)) {
    throw new Error("invalid date");
  }
  return d;
}

export function tomorrow() {
  const d = new Date();
  return addDays(startOfDay(d), 1);
}

export function fromTimestamp(ms: number) {
  return toDate(ms);
}
