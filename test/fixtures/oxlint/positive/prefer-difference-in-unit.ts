export const days =
  // @ts-expect-error Date subtraction in source
  (new Date("2024-01-02") - new Date("2024-01-01")) / 86400000;
