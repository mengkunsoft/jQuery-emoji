/**
 * 生成可直接上传安装的 WordPress 插件目录与 ZIP。
 *
 * 来源：wordpress/src/、dist/、server/php/EmojiParser.php、images/emoji/
 * 产物：wordpress/mk-emoji-picker/、wordpress/mk-emoji-picker-<version>.zip
 * 运行：npm run build:wp
 */
import { cp, copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const src = path.join(root, 'wordpress/src');
const out = path.join(root, 'wordpress/mk-emoji-picker');
const zipPath = path.join(root, `wordpress/mk-emoji-picker-${pkg.version}.zip`);

// 测试或单独调用时 dist/ 可能尚未生成
try {
    await stat(path.join(root, 'dist/emoji-list.json'));
} catch {
    await import('./build.mjs');
}

// 覆盖式生成：同名文件直接覆盖，不做整目录递归删除（产物含 500+ 图片）。
// ZIP 按本次清单生成，因此输出目录里若有历史残留也不会被打进安装包。
await mkdir(out, { recursive: true });
await cp(src, out, { recursive: true });

async function listFiles(dir, prefix = '') {
    const files = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const rel = prefix ? prefix + '/' + entry.name : entry.name;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listFiles(abs, rel));
        } else {
            files.push({ abs, rel });
        }
    }
    return files;
}

const assets = path.join(out, 'assets');
const assetNames = ['mk-emoji-picker.css', 'mk-emoji-picker.js', 'emoji-list.js', 'emoji-list.json'];
await mkdir(assets, { recursive: true });
for (const name of assetNames) {
    await copyFile(path.join(root, 'dist', name), path.join(assets, name));
}
await copyFile(
    path.join(root, 'server/php/EmojiParser.php'),
    path.join(out, 'includes/EmojiParser.php')
);

const imageRoot = path.join(root, 'images/emoji');
const images = (await listFiles(imageRoot)).filter(file => /\.(png|gif|jpe?g|webp|svg)$/i.test(file.rel));
for (const file of images) {
    const target = path.join(out, 'images/emoji', file.rel);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(file.abs, target);
}

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let value = i;
        for (let bit = 0; bit < 8; bit++) {
            value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        }
        table[i] = value >>> 0;
    }
    return table;
})();

function crc32(buffer) {
    let value = 0xffffffff;
    for (let i = 0; i < buffer.length; i++) {
        value = CRC_TABLE[(value ^ buffer[i]) & 0xff] ^ (value >>> 8);
    }
    return (value ^ 0xffffffff) >>> 0;
}

// 固定时间戳，保证同一份源码每次打出的 ZIP 完全一致
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function buildZip(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8');
        const data = entry.data;
        const compressed = deflateRawSync(data);
        const crc = crc32(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(8, 8);
        local.writeUInt16LE(DOS_TIME, 10);
        local.writeUInt16LE(DOS_DATE, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        localParts.push(local, name, compressed);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt16LE(DOS_TIME, 12);
        central.writeUInt16LE(DOS_DATE, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        centralParts.push(central, name);

        offset += local.length + name.length + compressed.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralDirectory.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDirectory, eocd]);
}

const manifest = [
    ...(await listFiles(src)).map(file => ({ name: 'mk-emoji-picker/' + file.rel, abs: file.abs })),
    ...assetNames.map(name => ({ name: 'mk-emoji-picker/assets/' + name, abs: path.join(assets, name) })),
    {
        name: 'mk-emoji-picker/includes/EmojiParser.php',
        abs: path.join(out, 'includes/EmojiParser.php')
    },
    ...images.map(file => ({
        name: 'mk-emoji-picker/images/emoji/' + file.rel,
        abs: path.join(out, 'images/emoji', file.rel)
    }))
].sort((a, b) => a.name.localeCompare(b.name, 'en'));

const entries = await Promise.all(manifest.map(async file => ({
    name: file.name,
    data: await readFile(file.abs)
})));
const zip = buildZip(entries);
await writeFile(zipPath, zip);

console.log(`\n[build:wp] mk-emoji-picker@${pkg.version} -> wordpress/mk-emoji-picker/ (${manifest.length} files, ${images.length} images)`);
console.log(`[build:wp] ${path.basename(zipPath)} (${(zip.length / 1024 / 1024).toFixed(2)} MiB, ${entries.length} entries)`);
