/**
 * 表情面板布局回归测试（无头 Chrome / Edge）
 *
 * 运行：node test/layout.test.js
 * 可用 BROWSER_PATH 指定浏览器可执行文件；
 * 浏览器 profile 放在系统临时目录，跑完自动清理。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execFileSync } = require('child_process');

const log = msg => console.log('[layout] ' + msg);

function findBrowser() {
    const candidates = [
        process.env.BROWSER_PATH,
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
    ].filter(Boolean);
    for (let i = 0; i < candidates.length; i++) {
        if (fs.existsSync(candidates[i])) return candidates[i];
    }
    throw new Error('找不到 Chrome/Edge：请设置 BROWSER_PATH');
}

function runPage(browser, page, width) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'emoji-css-'));
    try {
        const url = 'file:///' + path.join(__dirname, page).replace(/\\/g, '/');
        const out = execFileSync(browser, [
            '--headless=new',
            '--disable-gpu',
            '--no-first-run',
            '--user-data-dir=' + profile,
            '--window-size=' + width + ',900',
            '--dump-dom',
            url
        ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
        const m = out.match(/<title>RESULT:([^<]*)<\/title>/);
        assert(m, '未取到 ' + page + ' 的探针结果');
        return JSON.parse(m[1]);
    } finally {
        fs.rmSync(profile, { recursive: true, force: true });
    }
}

function main() {
    const browser = findBrowser();
    log('browser: ' + browser);

    [1200, 800, 375].forEach(width => {
        const r = runPage(browser, 'layout.html', width);
        assert.strictEqual(r.display, 'grid', 'Grid 布局应生效');
        assert(Math.abs(r.firstRowGap) < 0.6, '每行右侧不应留白，实际 ' + r.firstRowGap + 'px');
        if (r.viewport <= 576) {
            assert.strictEqual(r.cellH, 46, '小屏格子高度应为 46px');
            assert(r.cellW <= 50, '小屏格子应缩小');
            assert(r.cols >= 9, '小屏应能排更多列');
        } else {
            assert.strictEqual(r.cellH, 54, '大屏格子高度应保持 54px');
            assert(r.cellW >= 54, '大屏格子应 >= 54px');
            assert.strictEqual(r.cols, 9, '大屏应保持 9 列');
        }
        log('viewport=' + r.viewport + ' 容器=' + r.container + ' 列=' + r.cols +
            ' 格子=' + r.cellW + 'x' + r.cellH + ' 右侧空白=' + r.firstRowGap);
    });

    const p = runPage(browser, 'plugin.html', 1200);
    assert.strictEqual(p.grid, 'grid', '插件面板应使用 Grid');
    assert(p.loaded > 0 && p.total > 0, '应只加载可视区表情');
    assert(p.container > 400 && p.container <= 522, '容器宽度应正常');
    assert(p.inlineLeft !== '', '点击后 JS 应写入 inline left 覆盖 CSS 兜底');
    log('插件面板：容器=' + p.container + ' 格子=' + p.cellW + 'x' + p.cellH +
        ' 已加载=' + p.loaded + ' 未加载=' + p.total + ' left=' + p.inlineLeft);

    log('ALL PASS');
}

try {
    main();
} catch (err) {
    console.error('[layout] FAILED:', err);
    process.exitCode = 1;
}
