import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/imbot-bundle.mjs',
  sourcemap: false,
  minify: false,
  // 将所有依赖打入 bundle
  external: [],
  // 保持 banner 以支持 ESM 中的 __dirname/__filename
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`.trim(),
  },
});

console.log('✅ IM Bot bundle 构建完成: dist/imbot-bundle.mjs');
