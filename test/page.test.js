/**
 * 文档页 index.html 冒烟测试（无头 Chrome / Edge）
 *
 * 运行：node test/page.test.js
 * 可用 BROWSER_PATH 指定浏览器可执行文件。
 * 通过 --dump-dom 拿 JS 执行后的 DOM，验证结构、依赖清理与示例自动初始化。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const log = msg => console.log('[page] ' + msg);

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

function dumpDom(browser, rel, extra) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'emoji-page-'));
    try {
        const url = 'file:///' + path.join(ROOT, rel).replace(/\\/g, '/');
        return execFileSync(browser, [
            '--headless=new',
            '--disable-gpu',
            '--no-first-run',
            '--user-data-dir=' + profile,
            '--window-size=1200,900'
        ].concat(extra || [], ['--dump-dom', url]), {
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore']
        });
    } finally {
        fs.rmSync(profile, { recursive: true, force: true });
    }
}

const count = (html, re) => (html.match(re) || []).length;

function main() {
    const browser = findBrowser();
    const dom = dumpDom(browser, 'index.html');
    log('browser: ' + browser);

    // 语义化与无障碍
    assert(/<html[^>]*lang="zh-CN"/.test(dom), '应声明中文语言');
    assert(/<html[^>]*data-theme="(?:light|dark)"/.test(dom), '主题脚本应在渲染前设置 data-theme');
    assert(dom.includes('class="skip-link"'), '应提供跳转主内容链接');
    assert(dom.includes('<nav class="site-nav"'), '应有导航');
    assert(dom.includes('<main id="main">'), '应有 main 语义标签');
    assert(dom.includes('<thead>') && dom.includes('<tbody>'), '参数表应使用 thead/tbody');
    assert(dom.includes('scope="col"') && dom.includes('scope="row"'), '表头应带 scope');
    assert(/aria-label="切换到/.test(dom), '主题切换脚本应已执行');

    // 老依赖已移除
    ['fonts.googleapis.com', 'bootstrap.css', 'railscasts.css', 'cdn.bootcss.com'].forEach(dep => {
        assert(!dom.includes(dep), '不应再依赖 ' + dep);
    });

    // 示例与代码块
    assert.strictEqual(count(dom, /class="card demo-card(?: mt)?"/g), 3, '应有 3 个示例卡片');
    const blocks = count(dom, /<figure class="code-block">/g);
    const copies = count(dom, /class="copy-btn"/g);
    assert(blocks >= 8, '代码块数量不足：' + blocks);
    assert.strictEqual(copies, blocks, '每个代码块都应有复制按钮');
    ['id="btnOpen1"', 'id="btn"', 'id="btnParse"', 'id="sourceText"'].forEach(id => {
        assert(dom.includes(id), '缺少示例元素 ' + id);
    });
    assert(dom.includes('[aru_11]'), '转换示例的源码应保留');

    // 底部脚本应成功初始化两个表情实例
    assert.strictEqual(count(dom, /id="emoji_container_\d+"/g), 2, '应自动初始化 2 个表情面板');
    assert(/class="[^"]*hljs/.test(dom), '代码高亮应生效');
    log('结构、依赖、代码块、示例初始化全部正常（' + blocks + ' 个代码块）');

    // 420px 视口下不应出现页面级横向滚动
    const probe = dumpDom(browser, 'test/overflow.html', ['--allow-file-access-from-files']);
    const m = probe.match(/<title>RESULT:([^<]*)<\/title>/);
    assert(m, '小屏溢出探针未返回结果');
    const o = JSON.parse(m[1]);
    assert(o.scrollWidth <= o.clientWidth + 1,
        '小屏不应出现页面级横向溢出：scrollWidth=' + o.scrollWidth +
        ' clientWidth=' + o.clientWidth + ' 越界元素=' + JSON.stringify(o.overflows));
    log('420px 视口：scrollWidth=' + o.scrollWidth + ' clientWidth=' + o.clientWidth);

    log('ALL PASS');
}

try {
    main();
} catch (err) {
    console.error('[page] FAILED:', err);
    process.exitCode = 1;
}
