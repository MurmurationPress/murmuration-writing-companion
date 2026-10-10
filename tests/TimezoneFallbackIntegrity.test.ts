import { equal } from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { IANA_TIMEZONE_FALLBACK } from '../src/story-world/IanaTimezoneFallback';

test('region grouping preserves every ordered tzdb 2026c fallback identifier', () => {
  // Digest of the pre-grouping canonical list, including nested America regions.
  equal(IANA_TIMEZONE_FALLBACK.length, 312);
  equal(createHash('sha256').update(IANA_TIMEZONE_FALLBACK.join('\n')).digest('hex'), 'a0bd557ba85637d3e2a52ad78161a141b72fc8d8188252d23895bfcf9cec6477');
});
