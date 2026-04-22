import { parseISO } from "date-fns";

export function fromString(s: string) {
  const d = parseISO(s);
  return d.getTime();
}
