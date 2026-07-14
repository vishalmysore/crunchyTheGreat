/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Project site served at https://<user>.github.io/crunchyTheGreat/
export default defineConfig({
  base: '/crunchyTheGreat/',
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
