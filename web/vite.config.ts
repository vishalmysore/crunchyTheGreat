/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// WebGPU / SharedArrayBuffer need cross-origin isolation. On GitHub Pages we
// cannot set headers, so public/coi-serviceworker.js does it there; locally we
// set them directly.
const securityHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

// Project site served at https://<user>.github.io/crunchyTheGreat/
export default defineConfig({
  base: '/crunchyTheGreat/',
  build: {
    target: 'esnext',
  },
  worker: {
    format: 'es',
  },
  server: { headers: securityHeaders },
  preview: { headers: securityHeaders },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
