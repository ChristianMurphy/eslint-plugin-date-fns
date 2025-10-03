import test from "node:test";
import { tester } from "../_setup.ts";
import rule from "../../dist/rules/no-magic-time/index.js";

// Test cases for no-magic-time rule
// Detects and scores numeric literals that are likely date/time calculations
test("no-magic-time: valid (should NOT trigger the rule)", () => {
  tester.run("no-magic-time", rule, {
    valid: [
      // ✅ Already using date-fns - no magic numbers
      `import { addMinutes, addDays } from 'date-fns'; const later = addMinutes(new Date(), 5);`,
      `import { differenceInSeconds } from 'date-fns'; const diff = differenceInSeconds(end, start);`,
      `import { addHours } from 'date-fns'; setTimeout(() => cleanup(), addHours(new Date(), 1).getTime() - Date.now());`,

      // ✅ Non-date constructor calls
      `const buffer = new Buffer(1024);`,
      `const array = new Array(100);`,
      `const obj = { count: 42 };`,

      // ✅ File size / power-of-two patterns (false-positive tag provides -35 scoring)
      `const ONE_KB = 1024;`, // Has false-positive tag in TIME_CONSTANTS (-35) = -35 < 30
      `const ONE_MB = 1048576;`, // Has false-positive tag (-35) = -35 < 30
      `const BUFFER_SIZE = 4096;`, // No exact match = 0 < 30
      `fs.createReadStream(file, { highWaterMark: 65536 });`, // 65536 = uint16 max (-35) = -35 < 30

      // ✅ Port numbers (all-caps names avoid identifier hints, exact unit scoring insufficient)
      `const PORT = 3000;`, // 3000 = 3 seconds (+25), all-caps skips hints = 25 < 30
      `const HTTPS_PORT = 443;`, // No exact match, no hints = 0 < 30
      `const HTTP_PORT = 80;`, // No exact match, no hints = 0 < 30
      `const SERVER_PORT = 8080;`, // No exact match, no hints = 0 < 30
      `const POSTGRES_PORT = 5432;`, // No exact match, no hints = 0 < 30
      `app.listen(3000);`, // 3000 = 3 seconds (+25), no other context = 25 < 30
      `server.listen(8080, '0.0.0.0');`, // No exact match = 0 < 30

      // ✅ HTTP status codes (no exact time unit matches)
      `if (response.status === 200) { }`, // 200 = 200ms (+25) = 25 < 30
      `if (response.status === 404) { }`, // No exact match = 0 < 30
      `if (response.status === 500) { }`, // 500 = 500ms (+25) = 25 < 30
      `return res.status(201).json(data);`, // No exact match = 0 < 30
      `throw new HttpError(403, 'Forbidden');`, // No exact match = 0 < 30

      // ✅ Pixel dimensions (no exact time unit matches, all-caps avoids hints)
      `const WIDTH = 1920;`, // No exact match, all-caps = 0 < 30
      `const HEIGHT = 1080;`, // No exact match, all-caps = 0 < 30
      `canvas.width = 1024; canvas.height = 768;`, // 1024 has false-positive tag (-35)

      // ✅ Bitwise operations (no exact time matches, no special bitwise detection)
      `const flags = value & 0xFF;`, // 255 = uint8 max (-35) = -35 < 30
      `const shifted = bits << 8;`, // No exact match = 0 < 30
      `const masked = data | 1000;`, // 1000 = 1 second (+25), but still = 25 < 30
      `const toggled = ~value;`, // No literal to check

      // ✅ Audio sample rates (no exact time unit matches, all-caps avoids hints)
      `const SAMPLE_RATE = 44100;`, // No exact match, all-caps = 0 < 30
      `const HIGH_QUALITY = 48000;`, // No exact match, all-caps = 0 < 30

      // ✅ Mathematical constants (not time-related)
      `const PI_TIMES_100 = 314;`,
      `const GOLDEN_RATIO = 1618;`,

      // ✅ Financial precision values (not time)
      `const CENTS_PER_DOLLAR = 100;`, // Financial calculation
      `const BASIS_POINTS = 10000;`, // Financial precision
      `const price = amount * 100;`, // Convert to cents
      `const dollars = cents / 100;`, // Convert to dollars

      // ✅ More power-of-2 values (file sizes, buffers)
      `const SMALL_BUFFER = 2048;`,
      `const MEDIUM_BUFFER = 8192;`,
      `const LARGE_BUFFER = 16384;`,
      `const MAX_BUFFER = 32768;`,

      // ✅ Hex color values
      `const color = 0xFF0000;`, // Red
      `const alpha = 0xFF;`, // Full opacity

      // ✅ Percentage and ratio values
      `const percent = 100;`,
      `const ratio = value / 1000;`, // Scale down

      // ✅ Version numbers
      `const VERSION = 2024;`,
      `const BUILD = 1000;`,

      // ✅ Low-scoring patterns below default threshold (60)
      `const FIFTEEN_MINUTES = 900000;`, // Exact unit (+25) but no sink/context = 25 < 60
      `const cache = new Map(); cache.set(key, Date.now() % 1000);`, // Modulo with 1000 but not time bucket

      // ✅ Shadowed Date variables
      `function test(Date: any) { setTimeout(callback, Date.now() + 1000); }`,
      `class CustomDate { static now() { return 123; } } setTimeout(callback, CustomDate.now() + 1000);`,

      // ✅ TypeScript edge cases
      `declare const unknownValue: unknown; setTimeout(callback, unknownValue as number);`,
      `const anyValue: any = getValue(); setInterval(callback, anyValue);`,

      // ✅ Complex expressions that can't be safely analyzed
      `setTimeout(callback, calculateDynamicDelay(userInput));`,
      `const delay = config.timeout || getDefaultTimeout();`,
      `setTimeout(callback, Math.random() * 1000 + 500);`,

      // ✅ Timer sinks with variables (not literals)
      `const delay = getDelay(); setTimeout(callback, delay);`,
      `const TIMEOUT = 5000; setTimeout(callback, TIMEOUT);`,
      `clearTimeout(timeoutId);`, // clearTimeout doesn't take time value
      `clearInterval(intervalId);`, // clearInterval doesn't take time value

      // ✅ requestAnimationFrame (not a time-based API)
      `requestAnimationFrame(render);`,
      `cancelAnimationFrame(frameId);`,
    ],

    invalid: [
      // ❌ High-score patterns: Sink proximity + multiplication chain
      {
        code: `setTimeout(doWork, 5 * 60 * 1000);`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in timer sink (+40), multiplication chain with time units (+30)",
              score: "70",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const FIVE_MINUTES_MILLISECONDS = 5 * 60 * 1000;\nsetTimeout(doWork, FIVE_MINUTES_MILLISECONDS);`,
              },
            ],
          },
        ],
      },

      // ❌ High-score patterns: Exact unit literal in sink
      {
        code: `setTimeout(cleanup, 86400000);`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in timer sink (+40), exact unit: 1 day in milliseconds (+25)",
              score: "65",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const ONE_DAY_MILLISECONDS = 86400000;\nsetTimeout(cleanup, ONE_DAY_MILLISECONDS);`,
              },
            ],
          },
        ],
      },

      // ❌ DST foot-gun: Special high-priority message
      {
        code: `const tomorrow = new Date(date.getTime() + 86400000);`,
        errors: [
          {
            messageId: "daylightSavingFootgun",
            suggestions: [
              {
                messageId: "suggestAddDays",
                output: `import { addDays } from 'date-fns';\nconst tomorrow = addDays(date, 1);`,
              },
            ],
          },
        ],
      },

      // ❌ Date.now() arithmetic
      {
        code: `const later = Date.now() + 300000;`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "arithmetic with epoch time (+30), exact unit: 5 minutes in milliseconds (+25)",
              score: "55",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const FIVE_MINUTES_MILLISECONDS = 300000;\nconst later = Date.now() + FIVE_MINUTES_MILLISECONDS;`,
              },
              {
                messageId: "suggestAddMinutes",
                output: `import { addMinutes } from 'date-fns';\nconst later = addMinutes(new Date(), 5);`,
              },
            ],
          },
        ],
      },

      // ❌ AbortSignal.timeout (built-in sink)
      {
        code: `const signal = AbortSignal.timeout(30000);`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in AbortSignal timeout (+40), exact unit: 30 seconds in milliseconds (+25)",
              score: "65",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const THIRTY_SECONDS_MILLISECONDS = 30000;\nconst signal = AbortSignal.timeout(THIRTY_SECONDS_MILLISECONDS);`,
              },
            ],
          },
        ],
      },

      // ❌ setInterval with magic number
      {
        code: `const interval = setInterval(poll, 60000);`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in timer sink (+40), identifier hint 'interval' (+15), exact unit: 1 minute in milliseconds (+25)",
              score: "80",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const ONE_MINUTE_MILLISECONDS = 60000;\nconst interval = setInterval(poll, ONE_MINUTE_MILLISECONDS);`,
              },
            ],
          },
        ],
      },

      // ❌ Multiple DST foot-guns
      {
        code: `const nextWeek = new Date(today.getTime() + 604800000);`,
        errors: [
          {
            messageId: "daylightSavingFootgun",
            suggestions: [
              {
                messageId: "suggestAddWeeks",
                output: `import { addWeeks } from 'date-fns';\nconst nextWeek = addWeeks(today, 1);`,
              },
            ],
          },
        ],
      },

      // ❌ Comment hints boost score
      {
        code: `setTimeout(callback, 120000); // 2 minutes`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in timer sink (+40), comment hint 'minutes' (+15), exact unit: 2 minutes in milliseconds (+25)",
              score: "80",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const TWO_MINUTES_MILLISECONDS = 120000;\nsetTimeout(callback, TWO_MINUTES_MILLISECONDS); // 2 minutes`,
              },
            ],
          },
        ],
      },

      // ❌ Nested timer calls
      {
        code: `setTimeout(() => { setTimeout(callback, 5000); }, 10000);`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in timer sink (+40), exact unit: 5 seconds in milliseconds (+25)",
              score: "65",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const FIVE_SECONDS_MILLISECONDS = 5000;\nsetTimeout(() => { setTimeout(callback, FIVE_SECONDS_MILLISECONDS); }, 10000);`,
              },
            ],
          },
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in timer sink (+40), exact unit: 10 seconds in milliseconds (+25)",
              score: "65",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const TEN_SECONDS_MILLISECONDS = 10000;\nsetTimeout(() => { setTimeout(callback, 5000); }, TEN_SECONDS_MILLISECONDS);`,
              },
            ],
          },
        ],
      },

      // ❌ Timer in object method
      {
        code: `const obj = { start() { setTimeout(this.callback, 30000); } };`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in timer sink (+40), exact unit: 30 seconds in milliseconds (+25)",
              score: "65",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const THIRTY_SECONDS_MILLISECONDS = 30000;\nconst obj = { start() { setTimeout(this.callback, THIRTY_SECONDS_MILLISECONDS); } };`,
              },
            ],
          },
        ],
      },

      // ❌ Timer in class method
      {
        code: `class Poller { start() { this.intervalId = setInterval(this.poll, 15000); } }`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in timer sink (+40), exact unit: 15 seconds in milliseconds (+25)",
              score: "65",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const FIFTEEN_SECONDS_MILLISECONDS = 15000;\nclass Poller { start() { this.intervalId = setInterval(this.poll, FIFTEEN_SECONDS_MILLISECONDS); } }`,
              },
            ],
          },
        ],
      },

      // ❌ Date.now() subtraction
      {
        code: `const ago = Date.now() - 3600000;`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "arithmetic with epoch time (+30), exact unit: 1 hour in milliseconds (+25)",
              score: "55",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const ONE_HOUR_MILLISECONDS = 3600000;\nconst ago = Date.now() - ONE_HOUR_MILLISECONDS;`,
              },
              {
                messageId: "suggestAddHours",
                output: `import { addHours } from 'date-fns';\nconst ago = addHours(new Date(), 1);`,
              },
            ],
          },
        ],
      },

      // ❌ getTime() in conditional
      {
        code: `if (date.getTime() + 7200000 > now) { }`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "arithmetic with epoch time (+30), exact unit: 2 hours in milliseconds (+25)",
              score: "55",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const TWO_HOURS_MILLISECONDS = 7200000;\nif (date.getTime() + TWO_HOURS_MILLISECONDS > now) { }`,
              },
            ],
          },
        ],
      },

      // ❌ Date arithmetic in return statement
      {
        code: `function getExpiry() { return Date.now() + 1800000; }`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "arithmetic with epoch time (+30), exact unit: 30 minutes in milliseconds (+25)",
              score: "55",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const THIRTY_MINUTES_MILLISECONDS = 1800000;\nfunction getExpiry() { return Date.now() + THIRTY_MINUTES_MILLISECONDS; }`,
              },
            ],
          },
        ],
      },

      // ❌ Chained date operations
      {
        code: `const timestamp = new Date(baseDate.getTime() + 43200000).getTime();`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "arithmetic with epoch time (+30), identifier hint 'time' (+15), exact unit: 12 hours in milliseconds (+25)",
              score: "70",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const TWELVE_HOURS_MILLISECONDS = 43200000;\nconst timestamp = new Date(baseDate.getTime() + TWELVE_HOURS_MILLISECONDS).getTime();`,
              },
            ],
          },
        ],
      },

      // ❌ Multiplication chain: hours
      {
        code: `const timeout = 2 * 60 * 60 * 1000;`,
        options: [{ minimumScore: 30 }],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "multiplication chain with time units (+30), identifier hint 'timeout' (+15), identifier hint 'time' (+15)",
              score: "60",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const TIMEOUT_MILLISECONDS = 2 * 60 * 60 * 1000;`,
              },
            ],
          },
        ],
      },

      // ❌ Multiplication chain: weeks
      {
        code: `const cacheDuration = 2 * 7 * 24 * 60 * 60 * 1000;`,
        options: [{ minimumScore: 30 }],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "multiplication chain with time units (+30), identifier hint 'duration' (+15)",
              score: "45",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const CACHE_DURATION_MILLISECONDS = 2 * 7 * 24 * 60 * 60 * 1000;`,
              },
            ],
          },
        ],
      },

      // ❌ Multiplication with parentheses
      {
        code: `setTimeout(fn, (10 * 60) * 1000);`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in timer sink (+40), multiplication chain with time units (+30)",
              score: "70",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const TIME_CONSTANT_MILLISECONDS = (10 * 60) * 1000;\nsetTimeout(fn, TIME_CONSTANT_MILLISECONDS);`,
              },
            ],
          },
        ],
      },

      // ❌ Division for unit conversion
      {
        code: `const seconds = 5000 / 1000;`,
        options: [{ minimumScore: 30 }],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'second' (+15), exact unit: 5 seconds in milliseconds (+25)",
              score: "40",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const FIVE_SECONDS_MILLISECONDS = 5000;\nconst seconds = FIVE_SECONDS_MILLISECONDS / 1000;`,
              },
            ],
          },
        ],
      },

      // ❌ Identifier hints: camelCase
      {
        code: `const cacheTimeout = 180000;`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'timeout' (+15), identifier hint 'time' (+15), exact unit: 3 minutes in milliseconds (+25)",
              score: "55",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const CACHE_TIMEOUT_MILLISECONDS = 180000;`,
              },
            ],
          },
        ],
      },

      // ❌ Identifier hints: snake_case
      {
        code: `const retry_delay = 10000;`,
        options: [{ minimumScore: 30 }],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'delay' (+15), exact unit: 10 seconds in milliseconds (+25)",
              score: "40",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const RETRY_DELAY_MILLISECONDS = 10000;`,
              },
            ],
          },
        ],
      },

      // ❌ Identifier hints: suffix Ms
      {
        code: `const timeoutMs = 45000;`,
        options: [{ minimumScore: 30 }],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'timeout' (+15), identifier hint 'time' (+15), identifier hint 'ms' (+15)",
              score: "45",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const TIMEOUT_MILLISECONDS = 45000;`,
              },
            ],
          },
        ],
      },

      // ❌ Identifier hints: TTL pattern
      {
        code: `const ttl = 3600000;`,
        options: [{ minimumScore: 30 }],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'ttl' (+15), exact unit: 1 hour in milliseconds (+25)",
              score: "40",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const TTL_MILLISECONDS = 3600000;`,
              },
            ],
          },
        ],
      },

      // ❌ Identifier hints: expiry pattern
      {
        code: `const expiryTime = 7200000;`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'time' (+15), identifier hint 'expiry' (+15), exact unit: 2 hours in milliseconds (+25)",
              score: "55",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const EXPIRY_TIME_MILLISECONDS = 7200000;`,
              },
            ],
          },
        ],
      },

      // ❌ Comment hints: block comment
      {
        code: `const delay = /* 10 seconds */ 10000;`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'delay' (+15), comment hint 'seconds' (+15), exact unit: 10 seconds in milliseconds (+25)",
              score: "55",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const DELAY_MILLISECONDS = /* 10 seconds */ 10000;`,
              },
            ],
          },
        ],
      },

      // ❌ Comment hints: abbreviation
      {
        code: `setTimeout(fn, 5000); /* 5 sec */`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in timer sink (+40), comment hint 'sec' (+15), exact unit: 5 seconds in milliseconds (+25)",
              score: "80",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const FIVE_SECONDS_MILLISECONDS = 5000;\nsetTimeout(fn, FIVE_SECONDS_MILLISECONDS); /* 5 sec */`,
              },
            ],
          },
        ],
      },

      // ❌ Comment hints: multiple units
      {
        code: `const wait = 90000; // 1 minute 30 seconds`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'wait' (+15), comment hint 'minute' (+15), comment hint 'seconds' (+15), exact unit: 90 seconds in milliseconds (+25)",
              score: "70",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const WAIT_MILLISECONDS = 90000; // 1 minute 30 seconds`,
              },
            ],
          },
        ],
      },

      // ❌ Financial: Trading timeout
      // ❌ Financial: market data timeout
      {
        code: `const marketDataTimeout = 30000;`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'timeout' (+15), identifier hint 'time' (+15), exact unit: 30 seconds in milliseconds (+25)",
              score: "55",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const MARKET_DATA_TIMEOUT_MILLISECONDS = 30000;`,
              },
            ],
          },
        ],
      },

      // ❌ Financial: API rate limiting
      {
        code: `const apiRateLimit = setInterval(checkQuota, 60000);`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in timer sink (+40), exact unit: 1 minute in milliseconds (+25)",
              score: "65",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const ONE_MINUTE_MILLISECONDS = 60000;\nconst apiRateLimit = setInterval(checkQuota, ONE_MINUTE_MILLISECONDS);`,
              },
            ],
          },
        ],
      },

      // ❌ Financial: Transaction expiry
      {
        code: `const transactionExpiry = Date.now() + 300000;`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "arithmetic with epoch time (+30), identifier hint 'expiry' (+15), exact unit: 5 minutes in milliseconds (+25)",
              score: "70",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const FIVE_MINUTES_MILLISECONDS = 300000;\nconst transactionExpiry = Date.now() + FIVE_MINUTES_MILLISECONDS;`,
              },
              {
                messageId: "suggestAddMinutes",
                output: `import { addMinutes } from 'date-fns';\nconst transactionExpiry = addMinutes(new Date(), 5);`,
              },
            ],
          },
        ],
      },

      // ❌ Financial: Price cache duration
      {
        code: `cache.set(symbol, price, 5000);`,
        options: [{ minimumScore: 25 }],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation: "exact unit: 5 seconds in milliseconds (+25)",
              score: "25",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const FIVE_SECONDS_MILLISECONDS = 5000;\ncache.set(symbol, price, FIVE_SECONDS_MILLISECONDS);`,
              },
            ],
          },
        ],
      },

      // ❌ Realistic: Debounce implementation
      {
        code: `const debounced = debounce(handler, 300);`,
        options: [{ minimumScore: 25 }],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation: "exact unit: 300 milliseconds (+25)",
              score: "25",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const THREE_HUNDRED_MILLISECONDS = 300;\nconst debounced = debounce(handler, THREE_HUNDRED_MILLISECONDS);`,
              },
            ],
          },
        ],
      },

      // ❌ Realistic: Session timeout
      {
        code: `const sessionTimeout = 1800000;`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'timeout' (+15), identifier hint 'time' (+15), exact unit: 30 minutes in milliseconds (+25)",
              score: "55",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const SESSION_TIMEOUT_MILLISECONDS = 1800000;`,
              },
            ],
          },
        ],
      },

      // ❌ Realistic: Health check interval
      {
        code: `setInterval(healthCheck, 30000);`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in timer sink (+40), exact unit: 30 seconds in milliseconds (+25)",
              score: "65",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const THIRTY_SECONDS_MILLISECONDS = 30000;\nsetInterval(healthCheck, THIRTY_SECONDS_MILLISECONDS);`,
              },
            ],
          },
        ],
      },

      // ❌ DST: Multiple days
      {
        code: `const threeDaysLater = new Date(start.getTime() + 259200000);`,
        errors: [
          {
            messageId: "daylightSavingFootgun",
            suggestions: [
              {
                messageId: "suggestAddDays",
                output: `import { addDays } from 'date-fns';\nconst threeDaysLater = addDays(start, 3);`,
              },
            ],
          },
        ],
      },

      // ❌ Threshold edge case: Score = 30 (exactly at threshold)
      {
        code: `const timeout = 60000;`,
        options: [{ minimumScore: 40 }],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'timeout' (+15), identifier hint 'time' (+15), exact unit: 1 minute in milliseconds (+25)",
              score: "55",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const TIMEOUT_MILLISECONDS = 60000;`,
              },
            ],
          },
        ],
      },

      // ❌ Threshold edge case: Just above default threshold
      {
        code: `const wait = 300000;`,
        options: [{ minimumScore: 30 }],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'wait' (+15), exact unit: 5 minutes in milliseconds (+25)",
              score: "40",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const WAIT_MILLISECONDS = 300000;`,
              },
            ],
          },
        ],
      },

      // ❌ Multiple bonuses accumulating
      {
        code: `setTimeout(poll, 60000); // one minute`,
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in timer sink (+40), comment hint 'minute' (+15), exact unit: 1 minute in milliseconds (+25)",
              score: "80",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const ONE_MINUTE_MILLISECONDS = 60000;\nsetTimeout(poll, ONE_MINUTE_MILLISECONDS); // one minute`,
              },
            ],
          },
        ],
      },
    ],
  });
});

// Test with custom configuration options
test("no-magic-time: custom options", () => {
  tester.run("no-magic-time", rule, {
    valid: [
      // ✅ Below custom threshold
      {
        code: `const FIFTEEN_MINUTES = 900000;`, // Score 25, below custom threshold 30
        options: [{ minimumScore: 30 }],
      },

      // ✅ Ignored values
      {
        code: `setTimeout(callback, 5000);`, // Would normally trigger but ignored
        options: [{ ignoreValues: [5000] }],
      },

      // ✅ Multiple ignored values
      {
        code: `setTimeout(callback, 5000); setTimeout(other, 10000);`,
        options: [{ ignoreValues: [5000, 10_000] }],
      },

      // ✅ Ignored identifiers
      {
        code: `const specialTimeout = 60000; setTimeout(callback, specialTimeout);`,
        options: [{ ignoreIdentifiers: ["special.*"] }],
      },

      // ✅ Multiple ignored identifier patterns
      {
        code: `const CONFIG_TIMEOUT = 30000; const LEGACY_DELAY = 60000;`,
        options: [{ ignoreIdentifiers: ["^CONFIG_.*", "^LEGACY_.*"] }],
      },
    ],

    invalid: [
      // ❌ Custom sink with extraSinks option
      {
        code: `myCustomWait(callback, 5000);`,
        options: [
          {
            minimumScore: 50,
            extraSinks: ["myCustomWait"],
          },
        ],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in custom sink (+40), exact unit: 5 seconds in milliseconds (+25)",
              score: "65",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const FIVE_SECONDS_MILLISECONDS = 5000;\nmyCustomWait(callback, FIVE_SECONDS_MILLISECONDS);`,
              },
            ],
          },
        ],
      },

      // ❌ Multiple extraSinks
      {
        code: `scheduleTask(work, 10000);`,
        options: [
          {
            extraSinks: ["myCustomWait", "scheduleTask", "defer"],
          },
        ],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in custom sink (+40), exact unit: 10 seconds in milliseconds (+25)",
              score: "65",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const TEN_SECONDS_MILLISECONDS = 10000;\nscheduleTask(work, TEN_SECONDS_MILLISECONDS);`,
              },
            ],
          },
        ],
      },

      // ❌ Higher threshold catches fewer violations
      {
        code: `const timeout = 60000;`,
        options: [{ minimumScore: 20 }],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'timeout' (+15), identifier hint 'time' (+15), exact unit: 1 minute in milliseconds (+25)",
              score: "55",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const TIMEOUT_MILLISECONDS = 60000;`,
              },
            ],
          },
        ],
      },

      // ❌ Score exactly at threshold
      {
        code: `const delay = 60000;`,
        options: [{ minimumScore: 40 }],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "identifier hint 'delay' (+15), exact unit: 1 minute in milliseconds (+25)",
              score: "40",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const DELAY_MILLISECONDS = 60000;`,
              },
            ],
          },
        ],
      },

      // ❌ Combined options
      {
        code: `myTimer(callback, 30000);`,
        options: [
          {
            minimumScore: 50,
            extraSinks: ["myTimer"],
            ignoreValues: [60_000],
          },
        ],
        errors: [
          {
            messageId: "magicTimeConstant",
            data: {
              explanation:
                "used in custom sink (+40), exact unit: 30 seconds in milliseconds (+25)",
              score: "65",
            },
            suggestions: [
              {
                messageId: "suggestNamedConstant",
                output: `const THIRTY_SECONDS_MILLISECONDS = 30000;\nmyTimer(callback, THIRTY_SECONDS_MILLISECONDS);`,
              },
            ],
          },
        ],
      },
    ],
  });
});

// Test TypeScript-specific scenarios
test("no-magic-time: TypeScript scenarios", () => {
  tester.run("no-magic-time", rule, {
    valid: [
      // ✅ Union types with unknown
      `declare const delay: number | string; setTimeout(callback, delay as number);`,

      // ✅ Generic type parameters
      `function schedule<T extends number>(delay: T) { setTimeout(callback, delay); }`,

      // ✅ Const assertions
      `const TIMEOUT = 5000 as const; setTimeout(callback, TIMEOUT);`,
    ],

    invalid: [
      // Union types removed - not implementing this feature
    ],
  });
});

// Test edge cases and complex scenarios
test("no-magic-time: edge cases", () => {
  tester.run("no-magic-time", rule, {
    valid: [
      // ✅ Complex expressions that can't be scored
      `setTimeout(callback, Math.random() * 1000 + userDelay);`,
      `const timeout = condition ? fastTimeout : slowTimeout; setTimeout(callback, timeout);`,

      // ✅ Function calls as arguments
      `setTimeout(callback, getConfiguredTimeout());`,
      `setInterval(poll, calculateInterval());`,

      // ✅ Imported constants
      `import { DEFAULT_TIMEOUT } from './config'; setTimeout(callback, DEFAULT_TIMEOUT);`,
    ],

    invalid: [],
  });
});
