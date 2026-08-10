import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/tests/**/*.test.ts'],
    // Datetime tests compare against literal strings, so a timezone has to be
    // pinned - otherwise they pass only on a machine that happens to run in it.
    // Keep it in sync with HASS_TIME_ZONE in formatTime.test.ts.
    env: { TZ: 'Europe/Moscow' },
  },
});
