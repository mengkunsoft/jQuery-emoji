/** 文档页 index.html 冒烟测试（无头 Chrome / Edge）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dumpDom, findBrowser, probe } from './helpers/browser.mjs';

const browser = findBrowser();
const skip = browser ? false : '未找到 Chrome/Edge';
const count = (html, re) => (html.match(re) || []).length;

test('文档页结构、依赖清理与示例自动初始化', { skip }, () => {
    const dom = dumpDom(browser, 'index.html');

    assert(/<html[^>]*lang="zh-CN"/.test(dom), '应声明中文语言');
    assert(/<html[^>]*data-theme="(?:light|dark)"/.test(dom), '主题脚本应在渲染前设置 data-theme');
    assert(dom.includes('class="skip-link"'), '应提供跳转主内容链接');
    assert(dom.includes('<nav class="site-nav"'), '应有导航');
    assert(dom.includes('<main id="main">'), '应有 main 语义标签');
    assert(dom.includes('<thead>') && dom.includes('<tbody>'), '参数表应使用 thead/tbody');
    assert(dom.includes('scope="col"') && dom.includes('scope="row"'), '表头应带 scope');

    // 运行时依赖：只保留本地零依赖产物
    assert(!/<script[^>]+jquery/i.test(dom), '不应再引入 jQuery');
    for (const dep of ['fonts.googleapis.com', 'bootstrap.css', 'railscasts.css',
        'cdn.bootcss.com', 'highlight.pack.js']) {
        assert(!dom.includes(dep), '不应再依赖 ' + dep);
    }
    assert(dom.includes('dist/mk-emoji-picker.js'), '应引用新 IIFE 产物');
    assert(dom.includes('dist/emoji-list.js'), '应引用内置表情数据');
    assert(/mk-emoji-picker/i.test(dom), '应使用新名称');

    const blocks = count(dom, /<figure class="code-block">/g);
    const copies = count(dom, /class="copy-btn"/g);
    assert(blocks >= 8, '代码块数量不足: ' + blocks);
    assert.equal(copies, blocks, '每个代码块都应有复制按钮');
    for (const id of ['id="btnOpen1"', 'id="btn"', 'id="btnParse"', 'id="sourceText"']) {
        assert(dom.includes(id), '缺少示例元素 ' + id);
    }
    assert(dom.includes('[aru_11]'), '转换示例的源码应保留');

    // 页面加载后应自动初始化两个表情实例
    assert.equal(count(dom, /id="mkep-panel-\d+"/g), 2, '应自动初始化 2 个表情面板');
});

test('420px 视口下文档页无页面级横向溢出', { skip }, () => {
    const o = probe(browser, 'test/overflow.html', 1200, ['--allow-file-access-from-files']);
    assert(o.scrollWidth <= o.clientWidth + 1,
        '小屏不应出现页面级横向溢出: scrollWidth=' + o.scrollWidth +
        ' clientWidth=' + o.clientWidth + ' 越界元素=' + JSON.stringify(o.overflows));
});
