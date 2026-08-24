import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  dts: true,
  clean: true,
  platform: 'node',
  target: 'es2022',
  fixedExtension: false,
  external: [/^@opencode-ai\//, /^node:/],
})
