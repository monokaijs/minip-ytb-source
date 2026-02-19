/**
 * Build script for the YouTube source bundle.
 *
 * Usage:
 *   npm run build          # Single build
 *   npm run build:watch    # Watch mode
 *
 * Output: dist/youtube.bundle.js
 *
 * The bundle includes youtubei.js inlined and produces a single
 * standalone JS file that can be hosted at any URL and loaded
 * by the app via SourceLoader.installSource().
 */

import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';

const isWatch = process.argv.includes('--watch');
const outdir = path.resolve(__dirname, '../dist');
fs.mkdirSync(outdir, { recursive: true });

const buildOptions: esbuild.BuildOptions = {
  entryPoints: [path.resolve(__dirname, '../src/index.ts')],
  bundle: true,
  platform: 'neutral',
  format: 'cjs',
  target: 'es2022',
  supported: {
    // Hermes doesn't support async generators — transpile them
    'async-generator': false,
    'for-await': false,
  },
  outfile: path.join(outdir, 'youtube.bundle.js'),
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  // Don't bundle React Native / Expo / native modules —
  // these are provided by the host app via SourceHost
  external: [
    'react-native',
    'expo-file-system',
    'expo-file-system/legacy',
    'expo-modules-core',
    'react-native-mmkv',
  ],
  mainFields: ['module', 'main'],
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
};

async function build(): Promise<void> {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('👀 Watching for changes...');
  } else {
    const result = await esbuild.build(buildOptions);
    const stat = fs.statSync(path.join(outdir, 'youtube.bundle.js'));
    const sizeKB = (stat.size / 1024).toFixed(1);
    console.log(`✅ Built youtube.bundle.js (${sizeKB} KB)`);
    if (result.errors.length > 0) {
      console.error('Build errors:', result.errors);
    }
  }
}

build().catch((e) => {
  console.error('Build failed:', e);
  process.exit(1);
});
