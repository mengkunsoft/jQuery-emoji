/** 无头 Chrome / Edge 探针工具；浏览器 profile 放系统临时目录并自动清理。 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function findBrowser() {
    const candidates = [
        process.env.BROWSER_PATH,
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
    ].filter(Boolean);
    return candidates.find(file => existsSync(file)) || null;
}

export function dumpDom(browser, rel, { width = 1200, args = [] } = {}) {
    const profile = mkdtempSync(path.join(os.tmpdir(), 'mkep-'));
    try {
        const url = 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');
        return execFileSync(browser, [
            '--headless=new',
            '--disable-gpu',
            '--no-first-run',
            '--no-sandbox',
            '--user-data-dir=' + profile,
            '--window-size=' + width + ',900',
            ...args,
            '--dump-dom',
            url
        ], {
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore']
        });
    } finally {
        rmSync(profile, { recursive: true, force: true });
    }
}

/** 探针页通过 document.title 输出 JSON 结果。 */
export function probe(browser, rel, width = 1200, args = []) {
    const html = dumpDom(browser, rel, { width, args });
    const match = html.match(/<title>RESULT:([^<]*)<\/title>/);
    if (!match) throw new Error('未取到 ' + rel + ' 的探针结果');
    return JSON.parse(match[1]);
}
