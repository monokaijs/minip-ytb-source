import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import babel from '@rollup/plugin-babel';

const input = 'src/index.ts';
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

const externalDeps = [
  'react-native',
  'expo-file-system',
  'expo-file-system/legacy',
  'expo-modules-core',
  'react-native-mmkv',
];

const isExternal = (id) => {
  if (id.startsWith('.') || path.isAbsolute(id)) return false;
  return externalDeps.some(dep => id === dep || id.startsWith(dep + '/'));
};

const plugins = [
  resolve({ extensions, browser: false, preferBuiltins: true }),
  commonjs(),
  json(),
  typescript({
    tsconfig: 'tsconfig.json',
    useTsconfigDeclarationDir: false,
    clean: true,
    tslib: require.resolve('tslib'),
  }),
  babel({
    babelHelpers: 'bundled',
    extensions,
    include: ['src/**', 'node_modules/**'],
    presets: [
      ['@babel/preset-env', {
        targets: { ios: '12', android: '21' },
        modules: false,
      }],
    ],
    plugins: [
      ['@babel/plugin-syntax-import-attributes', { deprecatedAssertSyntax: true }],
    ],
  }),
  terser({ format: { comments: false } }),
];

export default {
  input,
  external: isExternal,
  plugins,
  output: {
    file: 'dist/youtube.bundle.js',
    format: 'cjs',
    exports: 'auto',
    sourcemap: false,
  },
};
