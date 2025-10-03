import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  numberToWords,
  labelToConstantName,
} from "../../dist/rules/no-magic-time/number-to-words.js";

describe("numberToWords", () => {
  describe("basic numbers (0-19)", () => {
    it("converts single digits", () => {
      assert.equal(numberToWords(0), "ZERO");
      assert.equal(numberToWords(1), "ONE");
      assert.equal(numberToWords(2), "TWO");
      assert.equal(numberToWords(5), "FIVE");
      assert.equal(numberToWords(9), "NINE");
    });

    it("converts teens", () => {
      assert.equal(numberToWords(10), "TEN");
      assert.equal(numberToWords(11), "ELEVEN");
      assert.equal(numberToWords(12), "TWELVE");
      assert.equal(numberToWords(13), "THIRTEEN");
      assert.equal(numberToWords(15), "FIFTEEN");
      assert.equal(numberToWords(19), "NINETEEN");
    });
  });

  describe("tens (20-99)", () => {
    it("converts round tens", () => {
      assert.equal(numberToWords(20), "TWENTY");
      assert.equal(numberToWords(30), "THIRTY");
      assert.equal(numberToWords(40), "FORTY");
      assert.equal(numberToWords(50), "FIFTY");
      assert.equal(numberToWords(60), "SIXTY");
      assert.equal(numberToWords(90), "NINETY");
    });

    it("converts compound tens", () => {
      assert.equal(numberToWords(21), "TWENTY_ONE");
      assert.equal(numberToWords(35), "THIRTY_FIVE");
      assert.equal(numberToWords(45), "FORTY_FIVE");
      assert.equal(numberToWords(67), "SIXTY_SEVEN");
      assert.equal(numberToWords(99), "NINETY_NINE");
    });
  });

  describe("hundreds (100-999)", () => {
    it("converts round hundreds", () => {
      assert.equal(numberToWords(100), "ONE_HUNDRED");
      assert.equal(numberToWords(200), "TWO_HUNDRED");
      assert.equal(numberToWords(500), "FIVE_HUNDRED");
      assert.equal(numberToWords(900), "NINE_HUNDRED");
    });

    it("converts hundreds with tens", () => {
      assert.equal(numberToWords(120), "ONE_HUNDRED_TWENTY");
      assert.equal(numberToWords(145), "ONE_HUNDRED_FORTY_FIVE");
      assert.equal(numberToWords(250), "TWO_HUNDRED_FIFTY");
      assert.equal(numberToWords(399), "THREE_HUNDRED_NINETY_NINE");
    });

    it("converts hundreds with singles", () => {
      assert.equal(numberToWords(101), "ONE_HUNDRED_ONE");
      assert.equal(numberToWords(205), "TWO_HUNDRED_FIVE");
      assert.equal(numberToWords(509), "FIVE_HUNDRED_NINE");
    });

    it("converts hundreds with teens", () => {
      assert.equal(numberToWords(111), "ONE_HUNDRED_ELEVEN");
      assert.equal(numberToWords(215), "TWO_HUNDRED_FIFTEEN");
      assert.equal(numberToWords(319), "THREE_HUNDRED_NINETEEN");
    });
  });

  describe("thousands (1000-99999)", () => {
    it("converts round thousands", () => {
      assert.equal(numberToWords(1000), "ONE_THOUSAND");
      assert.equal(numberToWords(2000), "TWO_THOUSAND");
      assert.equal(numberToWords(5000), "FIVE_THOUSAND");
      assert.equal(numberToWords(10_000), "TEN_THOUSAND");
      assert.equal(numberToWords(15_000), "FIFTEEN_THOUSAND");
    });

    it("converts thousands with hundreds", () => {
      assert.equal(numberToWords(1100), "ONE_THOUSAND_ONE_HUNDRED");
      assert.equal(numberToWords(2500), "TWO_THOUSAND_FIVE_HUNDRED");
      assert.equal(numberToWords(5900), "FIVE_THOUSAND_NINE_HUNDRED");
    });

    it("converts thousands with tens and ones", () => {
      assert.equal(numberToWords(1001), "ONE_THOUSAND_ONE");
      assert.equal(numberToWords(1025), "ONE_THOUSAND_TWENTY_FIVE");
      assert.equal(numberToWords(5045), "FIVE_THOUSAND_FORTY_FIVE");
      assert.equal(numberToWords(10_500), "TEN_THOUSAND_FIVE_HUNDRED");
    });

    it("converts complex thousands", () => {
      assert.equal(numberToWords(1234), "ONE_THOUSAND_TWO_HUNDRED_THIRTY_FOUR");
      assert.equal(
        numberToWords(5678),
        "FIVE_THOUSAND_SIX_HUNDRED_SEVENTY_EIGHT",
      );
      assert.equal(numberToWords(45_000), "FORTY_FIVE_THOUSAND");
      assert.equal(
        numberToWords(99_999),
        "NINETY_NINE_THOUSAND_NINE_HUNDRED_NINETY_NINE",
      );
    });
  });

  describe("time-related values", () => {
    it("converts common millisecond values", () => {
      assert.equal(numberToWords(1000), "ONE_THOUSAND"); // 1 second
      assert.equal(numberToWords(5000), "FIVE_THOUSAND"); // 5 seconds
      assert.equal(numberToWords(10_000), "TEN_THOUSAND"); // 10 seconds
      assert.equal(numberToWords(30_000), "THIRTY_THOUSAND"); // 30 seconds
      assert.equal(numberToWords(60_000), "SIXTY_THOUSAND"); // 1 minute
    });
  });

  describe("edge cases", () => {
    it("handles numbers >= 100,000 by returning string", () => {
      assert.equal(numberToWords(100_000), "100000");
      assert.equal(numberToWords(1_000_000), "1000000");
    });
  });
});

describe("labelToConstantName", () => {
  describe("basic time units", () => {
    it("converts seconds", () => {
      assert.equal(
        labelToConstantName("5 seconds in milliseconds"),
        "FIVE_SECONDS_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("10 seconds in milliseconds"),
        "TEN_SECONDS_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("30 seconds in milliseconds"),
        "THIRTY_SECONDS_MILLISECONDS",
      );
    });

    it("converts minutes", () => {
      assert.equal(
        labelToConstantName("1 minute in milliseconds"),
        "ONE_MINUTE_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("5 minutes in milliseconds"),
        "FIVE_MINUTES_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("15 minutes in milliseconds"),
        "FIFTEEN_MINUTES_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("30 minutes in milliseconds"),
        "THIRTY_MINUTES_MILLISECONDS",
      );
    });

    it("converts hours", () => {
      assert.equal(
        labelToConstantName("1 hour in milliseconds"),
        "ONE_HOUR_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("2 hours in milliseconds"),
        "TWO_HOURS_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("12 hours in milliseconds"),
        "TWELVE_HOURS_MILLISECONDS",
      );
    });

    it("converts days", () => {
      assert.equal(
        labelToConstantName("1 day in milliseconds"),
        "ONE_DAY_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("2 days in milliseconds"),
        "TWO_DAYS_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("30 days in milliseconds"),
        "THIRTY_DAYS_MILLISECONDS",
      );
    });

    it("converts weeks", () => {
      assert.equal(
        labelToConstantName("1 week in milliseconds"),
        "ONE_WEEK_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("2 weeks in milliseconds"),
        "TWO_WEEKS_MILLISECONDS",
      );
    });
  });

  describe("decimal numbers", () => {
    it("converts decimal seconds", () => {
      assert.equal(
        labelToConstantName("1.5 seconds in milliseconds"),
        "1_5_SECONDS_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("2.5 hours in milliseconds"),
        "2_5_HOURS_MILLISECONDS",
      );
    });
  });

  describe("milliseconds", () => {
    it("converts milliseconds without redundant suffix", () => {
      assert.equal(
        labelToConstantName("100 milliseconds"),
        "ONE_HUNDRED_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("250 milliseconds"),
        "TWO_HUNDRED_FIFTY_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("300 milliseconds"),
        "THREE_HUNDRED_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("500 milliseconds"),
        "FIVE_HUNDRED_MILLISECONDS",
      );
    });

    it("handles singular millisecond", () => {
      assert.equal(labelToConstantName("1 millisecond"), "ONE_MILLISECOND");
    });
  });

  describe("compound numbers", () => {
    it("converts two-digit numbers", () => {
      assert.equal(
        labelToConstantName("45 seconds in milliseconds"),
        "FORTY_FIVE_SECONDS_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("90 seconds in milliseconds"),
        "NINETY_SECONDS_MILLISECONDS",
      );
    });
  });

  describe("edge cases", () => {
    it("handles labels without numbers", () => {
      // When there's no number, words are just uppercased
      assert.equal(labelToConstantName("invalid"), "INVALID_MILLISECONDS");
      assert.equal(
        labelToConstantName("something else"),
        "SOMETHING_ELSE_MILLISECONDS",
      );
    });

    it("returns default for empty labels", () => {
      assert.equal(labelToConstantName(""), "TIME_CONSTANT_MILLISECONDS");
    });
  });

  describe("real-world TIME_CONSTANTS values", () => {
    it("handles common time constant labels", () => {
      // From the actual TIME_CONSTANTS dictionary
      assert.equal(
        labelToConstantName("1 second in milliseconds"),
        "ONE_SECOND_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("2 seconds in milliseconds"),
        "TWO_SECONDS_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("3 seconds in milliseconds"),
        "THREE_SECONDS_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("5 seconds in milliseconds"),
        "FIVE_SECONDS_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("1 minute in milliseconds"),
        "ONE_MINUTE_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("2 minutes in milliseconds"),
        "TWO_MINUTES_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("1 hour in milliseconds"),
        "ONE_HOUR_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("1 day in milliseconds"),
        "ONE_DAY_MILLISECONDS",
      );
      assert.equal(
        labelToConstantName("1 week in milliseconds"),
        "ONE_WEEK_MILLISECONDS",
      );
    });
  });
});
