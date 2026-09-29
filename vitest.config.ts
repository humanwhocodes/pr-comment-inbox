/**
 * @fileoverview Configures Vitest test discovery for unit and integration suites.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
  },
});
