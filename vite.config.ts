import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Strict Content-Security-Policy for production builds: no remote scripts,
 * no network calls. 'wasm-unsafe-eval' is needed for the Argon2 WebAssembly.
 * (Dev server is excluded because Vite's HMR uses inline scripts.)
 */
const csp: Plugin = {
  name: 'csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<head>',
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'" />`,
    ),
}

export default defineConfig({
  plugins: [react(), csp],
  test: { environment: 'node' },
})
