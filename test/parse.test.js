/**
 * 文本转换（emojiParse）误伤回归测试（jsdom）
 *
 * 运行：node test/parse.test.js
 * 依赖：jsdom。加载方式与 lazyload.test.js 一致，可用 JSDOM_PATH 指定模块目录。
 * 同时跑 src 与 dist 两个版本，确保压缩产物与源码行为一致。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const log = msg => console.log('[parse] ' + msg);

function loadJsdom() {
    const candidates = [];
    if (process.env.JSDOM_PATH) candidates.push(process.env.JSDOM_PATH);
    candidates.push('jsdom');
    const cacheRoots = [
        path.join(os.homedir(), '.npm', '_npx'),
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx')
    ].filter(Boolean);
    cacheRoots.forEach(root => {
        if (!fs.existsSync(root)) return;
        fs.readdirSync(root).forEach(dir => {
            candidates.push(path.join(root, dir, 'node_modules', 'jsdom'));
        });
    });
    for (let i = 0; i < candidates.length; i++) {
        try {
            return require(candidates[i]);
        } catch (e) {
            // 继续尝试下一个
        }
    }
    throw new Error('找不到 jsdom：请 npm i -D jsdom 或设置 JSDOM_PATH');
}

const { JSDOM } = loadJsdom();
const SCRIPTS = ['src/js/jquery.emoji.js', 'dist/js/jquery.emoji.min.js'];

function createEnv(script) {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'http://localhost/',
        runScripts: 'outside-only'
    });
    const w = dom.window;
    w.eval(read('lib/script/jquery.min.js'));
    w.eval(read(script));
    w.eval(read('src/js/emoji.list.js'));
    return { dom, w, $: w.jQuery };
}

function parse(w, $, html, icons, basePath) {
    const box = w.document.createElement('div');
    box.innerHTML = html;
    w.document.body.appendChild(box);
    $(box).emojiParse({
        basePath: basePath === undefined ? 'images/emoji' : basePath,
        icons: icons || w.emojiLists
    });
    return box;
}

const srcOf = box => Array.prototype.map.call(
    box.querySelectorAll('img.wp-smiley'),
    img => img.getAttribute('src')
);

function runCases(script) {
    const { dom, w, $ } = createEnv(script);

    // 1. 常规转换：文档页示例里的命名表情、序号表情都要正确
    const basic = parse(w, $, '#(玫瑰)好用[aru_11]，还有[微笑]和[aru_140]');
    assert.deepStrictEqual(srcOf(basic), [
        'images/emoji/newtieba/meigui.png',
        'images/emoji/aru/11.png',
        'images/emoji/qq/weixiao.gif',
        'images/emoji/aru/140.png'
    ], '文档示例的表情代码应全部转换');
    assert(basic.textContent.includes('好用，还有'), '普通文字不应被吞掉');
    const basicImgs = basic.querySelectorAll('img');
    assert.strictEqual(basicImgs[0].getAttribute('title'), '玫瑰', '命名表情应带 title');
    assert.strictEqual(basicImgs[0].getAttribute('alt'), '玫瑰', '命名表情应带 alt');
    assert.strictEqual(basicImgs[1].hasAttribute('title'), false, '序号表情不应带 title');
    log('常规转换：4 张，路径与属性正确');

    // 2. HTML 属性里的表情代码不是正文，不能被替换
    const attr = parse(w, $, '<span id="s" title="[微笑]" data-code="[aru_11]">正文[微笑]</span>');
    const span = attr.querySelector('#s');
    assert.strictEqual(span.getAttribute('title'), '[微笑]', 'title 属性应保持原样');
    assert.strictEqual(span.getAttribute('data-code'), '[aru_11]', '自定义属性应保持原样');
    assert.strictEqual(srcOf(attr).length, 1, '只有正文里的表情代码应转换');
    assert.strictEqual(span.textContent, '正文', '正文应保留');
    log('属性保护：title / data-* 未被破坏');

    // 3. 脚本、样式、表单、代码块里的文本不是正文，不能被替换
    const skip = parse(w, $,
        '<script id="js">var a = "[微笑]";</script>' +
        '<style id="css">.x::after { content: "[aru_11]"; }</style>' +
        '<textarea id="ta">[微笑]</textarea>' +
        '<pre id="pre">[aru_11]</pre><code id="code">[微笑]</code>' +
        '<p id="ok">[微笑]</p>');
    assert(skip.querySelector('#js').textContent.includes('[微笑]'), 'script 内容不应被替换');
    assert(!skip.querySelector('#js').textContent.includes('<img'), 'script 内容不应插入标签');
    assert(skip.querySelector('#css').textContent.includes('[aru_11]'), 'style 内容不应被替换');
    assert.strictEqual(skip.querySelector('#ta').value, '[微笑]', 'textarea 初始值不应被替换');
    assert.strictEqual(skip.querySelector('#pre').textContent, '[aru_11]', 'pre 代码不应被替换');
    assert.strictEqual(skip.querySelector('#code').textContent, '[微笑]', 'code 代码不应被替换');
    assert.strictEqual(srcOf(skip).length, 1, '只有正文段落应转换');
    log('非正文元素：script / style / textarea / pre / code 均未被破坏');

    // 4. 未配置的别名、半截代码、Object 原型链上的键都不能当成表情
    const unknown = parse(w, $, '<p>[未知表情][aru_][aru_x][constructor][toString] [微笑]</p>');
    assert.strictEqual(srcOf(unknown).length, 1, '只有已配置的别名应转换');
    ['[未知表情]', '[aru_]', '[aru_x]', '[constructor]', '[toString]'].forEach(text => {
        assert(unknown.textContent.includes(text), text + ' 应原样保留');
    });
    log('未知别名 / 原型链键：未误伤');

    // 5. 自定义占位符中的正则元字符必须按字面量匹配，别名同理
    const customIcons = [{
        path: 'custom/',
        file: '.png',
        placeholder: '[a.b+({alias})]',
        emoji: { 'x': 'x', 'a.b': 'y' }
    }];
    const custom = parse(w, $,
        '<p>[a.b+(x)] 命中 / [aXb+(x)] 不命中 / [aXb+(aYb)] 不命中 / [a.b+(a.b)] 命中</p>',
        customIcons);
    assert.deepStrictEqual(srcOf(custom).sort(), [
        'images/emoji/custom/x.png',
        'images/emoji/custom/y.png'
    ].sort(), '占位符里的 . + ( ) 与别名里的 . 应按字面量匹配');
    assert(custom.textContent.includes('[aXb+(x)]') &&
           custom.textContent.includes('[aXb+(aYb)]'), '相似但不同的文本不应被误伤');

    // {alias} 大小写不敏感
    const upper = parse(w, $, '<p>#[玫瑰]</p>', [{
        path: 'old/', file: '.png', placeholder: '#[{ALIAS}]', emoji: { '玫瑰': 'meigui' }
    }]);
    assert.deepStrictEqual(srcOf(upper), ['images/emoji/old/meigui.png'], '{ALIAS} 大写也应生效');
    log('正则元字符占位符：按字面匹配，{ALIAS} 大小写不敏感');

    // 6. 别名里的引号不能破坏生成节点的属性
    const quote = parse(w, $, '<p>[a"b]</p>', [{
        path: 'x/', file: '.png', placeholder: '[{alias}]', emoji: { 'a"b': 'q' }
    }]);
    assert.strictEqual(srcOf(quote).length, 1, '含引号的别名应能转换');
    assert.strictEqual(quote.querySelector('img').getAttribute('title'), 'a"b',
        '别名里的引号不应破坏 title 属性');
    log('别名含引号：属性未破坏');

    // 7. 文本中的 < & 不能因为回写 HTML 而被当成标签
    const special = parse(w, $, '<p>1 &lt; 2 &amp; [微笑]</p>');
    assert.strictEqual(special.querySelector('p').textContent, '1 < 2 & ', '< 与 & 应原样保留');
    assert.strictEqual(special.querySelectorAll('p > *').length, 1, '不应凭空多出元素');
    log('特殊字符文本：未被解析成标签');

    // 8. 相邻表情、重复调用、路径拼接
    const adjacent = parse(w, $, '<p>[微笑][大哭][aru_1]</p>');
    assert.strictEqual(srcOf(adjacent).length, 3, '相邻的表情代码应各自转换');

    const again = parse(w, $, '<p>[微笑] 和 [aru_11]</p>');
    $(again).emojiParse({ basePath: 'images/emoji', icons: w.emojiLists });
    $(again).removeData('plugin_emojiParse');
    $(again).emojiParse({ basePath: 'images/emoji', icons: w.emojiLists });
    assert.strictEqual(srcOf(again).length, 2, '重复初始化不应二次替换已生成的图片');

    const slashed = parse(w, $, '<p>[aru_11]</p>', undefined, 'images/emoji/');
    assert.strictEqual(srcOf(slashed)[0], 'images/emoji/aru/11.png',
        'basePath 尾部斜杠不应拼出双斜杠');
    log('相邻表情 / 重复调用 / 路径拼接：正常');

    dom.window.close();
}

SCRIPTS.forEach(script => {
    log('---- ' + script + ' ----');
    runCases(script);
});
log('ALL PASS');
