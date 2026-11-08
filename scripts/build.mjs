/**
 * 构建 dist/：esbuild 生成 IIFE（浏览器全局）、ESM、CJS 与 CSS 产物。
 * 运行：npm run build
 */
import { build } from 'esbuild';
import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const banner = `/*! ${pkg.name} v${pkg.version} | MIT License | (c) Sky, Mengkun */`;

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const common = {
    bundle: true,
    target: ['es2018'],
    logLevel: 'info',
    legalComments: 'none',
    define: { __MK_EMOJI_PICKER_VERSION__: JSON.stringify(pkg.version) },
    banner: { js: banner }
};

const entry = name => path.join(root, 'src/js', name);
const output = name => path.join(dist, name);

await Promise.all([
    build({
        ...common,
        entryPoints: [entry('index.js')],
        outfile: output('mk-emoji-picker.js'),
        format: 'iife',
        globalName: 'MkEmojiPicker',
        minify: true,
        sourcemap: true
    }),
    build({
        ...common,
        entryPoints: [entry('index.js')],
        outfile: output('mk-emoji-picker.esm.js'),
        format: 'esm'
    }),
    build({
        ...common,
        entryPoints: [entry('index.js')],
        outfile: output('mk-emoji-picker.cjs'),
        format: 'cjs'
    }),
    build({
        ...common,
        entryPoints: [entry('emoji-list.global.js')],
        outfile: output('emoji-list.js'),
        format: 'iife',
        minify: true
    }),
    build({
        ...common,
        entryPoints: [entry('emoji-list.js')],
        outfile: output('emoji-list.esm.js'),
        format: 'esm'
    }),
    build({
        ...common,
        entryPoints: [entry('emoji-list.js')],
        outfile: output('emoji-list.cjs'),
        format: 'cjs'
    })
]);

const cssEntry = path.join(root, 'src/css/mk-emoji-picker.css');
await copyFile(cssEntry, output('mk-emoji-picker.css'));
await build({
    entryPoints: [cssEntry],
    outfile: output('mk-emoji-picker.min.css'),
    minify: true,
    logLevel: 'info',
    legalComments: 'none',
    banner: { css: banner }
});

const files = (await readdir(dist)).sort();
console.log(`\n[build] ${pkg.name}@${pkg.version} -> dist/ (${files.length} files)`);
for (const file of files) console.log('  ' + file);
