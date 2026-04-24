// Vite's `?module` suffix on a .wasm import returns a compiled
// WebAssembly.Module at build time. Vitest/Node's ESM loader has no
// handler for that, so `routeTree.gen.ts → routes/og/$.tsx → resvg` fails
// to import in tests. Nothing in the test suite actually renders an OG
// card, so stub the export as an opaque placeholder.

const placeholder = {} as unknown as WebAssembly.Module;
export default placeholder;
