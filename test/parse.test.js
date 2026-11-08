/**
 * 文本解析误伤回归测试。
 * 同时跑 IIFE（浏览器全局）、ESM、CJS 三份产物，确保行为一致。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createEnv } from './helpers/env.mjs';

const require = createRequire(import.meta.url);
const esm = await import('../dist/mk-emoji-picker.esm.js');
const cjs = require('../dist/mk-emoji-picker.cjs');

function parseBox(v, html, icons, basePath) {
    const box = v.doc.createElement('div');
    box.innerHTML = html;
    v.doc.body.appendChild(box);
    v.parse(box, {
        basePath: basePath === undefined ? 'images/emoji' : basePath,
        icons: icons || v.lists
    });
    return box;
}

const srcOf = box => Array.from(box.querySelectorAll('img.mkep-smiley'))
    .map(img => img.getAttribute('src'));

function runCases(v) {
    // 1. 常规转换：命名表情、序号表情都要正确
    const basic = parseBox(v, '#(玫瑰)好用[aru_11]，还有[微笑]和[aru_140]');
    assert.deepEqual(srcOf(basic), [
        'images/emoji/newtieba/meigui.png',
        'images/emoji/aru/11.png',
        'images/emoji/qq/weixiao.gif',
        'images/emoji/aru/140.png'
    ], '文档示例的表情代码应全部转换');
    assert(basic.textContent.includes('好用，还有'), '普通文字不应被吞掉');
    const basicImgs = basic.querySelectorAll('img');
    assert.equal(basicImgs[0].getAttribute('title'), '玫瑰');
    assert.equal(basicImgs[0].getAttribute('alt'), '玫瑰');
    assert.equal(basicImgs[1].hasAttribute('title'), false, '序号表情不应带 title');

    // 2. HTML 属性里的代码不是正文
    const attr = parseBox(v, '<span id="s" title="[微笑]" data-code="[aru_11]">正文[微笑]</span>');
    const span = attr.querySelector('#s');
    assert.equal(span.getAttribute('title'), '[微笑]');
    assert.equal(span.getAttribute('data-code'), '[aru_11]');
    assert.equal(srcOf(attr).length, 1, '只有正文里的代码应转换');

    // 3. 脚本、样式、表单、代码块里的文本不处理
    const skip = parseBox(v,
        '<script id="js">var a = "[微笑]";</script>' +
        '<style id="css">.x::after { content: "[aru_11]"; }</style>' +
        '<textarea id="ta">[微笑]</textarea>' +
        '<pre id="pre">[aru_11]</pre><code id="code">[微笑]</code>' +
        '<p id="ok">[微笑]</p>');
    assert(skip.querySelector('#js').textContent.includes('[微笑]'));
    assert(!skip.querySelector('#js').textContent.includes('<img'));
    assert(skip.querySelector('#css').textContent.includes('[aru_11]'));
    assert.equal(skip.querySelector('#ta').value, '[微笑]');
    assert.equal(skip.querySelector('#pre').textContent, '[aru_11]');
    assert.equal(skip.querySelector('#code').textContent, '[微笑]');
    assert.equal(srcOf(skip).length, 1, '只有正文段落应转换');

    // 4. 未配置的别名、半截代码、原型链上的键都不能命中
    const unknown = parseBox(v, '<p>[未知表情][aru_][aru_x][constructor][toString] [微笑]</p>');
    assert.equal(srcOf(unknown).length, 1);
    for (const text of ['[未知表情]', '[aru_]', '[aru_x]', '[constructor]', '[toString]']) {
        assert(unknown.textContent.includes(text), text + ' 应原样保留');
    }

    // 5. 占位符里的正则元字符按字面量匹配，{ALIAS} 大小写不敏感
    const customIcons = [{
        path: 'custom/',
        file: '.png',
        placeholder: '[a.b+({alias})]',
        emoji: { x: 'x', 'a.b': 'y' }
    }];
    const custom = parseBox(v,
        '<p>[a.b+(x)] 命中 / [aXb+(x)] 不命中 / [aXb+(aYb)] 不命中 / [a.b+(a.b)] 命中</p>',
        customIcons);
    assert.deepEqual(srcOf(custom).sort(), [
        'images/emoji/custom/x.png', 'images/emoji/custom/y.png'
    ].sort());
    assert(custom.textContent.includes('[aXb+(x)]') && custom.textContent.includes('[aXb+(aYb)]'));

    const upper = parseBox(v, '<p>#[玫瑰]</p>', [{
        path: 'old/', file: '.png', placeholder: '#[{ALIAS}]', emoji: { '玫瑰': 'meigui' }
    }]);
    assert.deepEqual(srcOf(upper), ['images/emoji/old/meigui.png']);

    // 6. 别名里的引号不能破坏属性
    const quote = parseBox(v, '<p>[a"b]</p>', [{
        path: 'x/', file: '.png', placeholder: '[{alias}]', emoji: { 'a"b': 'q' }
    }]);
    assert.equal(srcOf(quote).length, 1);
    assert.equal(quote.querySelector('img').getAttribute('title'), 'a"b');

    // 7. 文本中的 < & 不被当成标签
    const special = parseBox(v, '<p>1 &lt; 2 &amp; [微笑]</p>');
    assert.equal(special.querySelector('p').textContent, '1 < 2 & ');
    assert.equal(special.querySelectorAll('p > *').length, 1);

    // 8. 相邻表情、重复调用幂等、路径拼接
    const adjacent = parseBox(v, '<p>[微笑][大哭][aru_1]</p>');
    assert.equal(srcOf(adjacent).length, 3);

    const again = parseBox(v, '<p>[微笑] 和 [aru_11]</p>');
    v.parse(again, { basePath: 'images/emoji', icons: v.lists });
    v.parse(again, { basePath: 'images/emoji', icons: v.lists });
    assert.equal(srcOf(again).length, 2, '重复调用不应二次替换');

    const slashed = parseBox(v, '<p>[aru_11]</p>', undefined, 'images/emoji/');
    assert.equal(srcOf(slashed)[0], 'images/emoji/aru/11.png', '不应拼出双斜杠');

    // 9. 幂等标记可用 force 覆盖
    assert.equal(again.getAttribute('data-mkep-parsed'), '1');
    v.parse(again, { basePath: 'images/emoji', icons: v.lists, force: true });
    assert.equal(srcOf(again).length, 2, 'force 重新解析不应产生重复图片');
}

function makeVariants() {
    const iife = createEnv();
    const esmEnv = createEnv({ scripts: [] });
    const cjsEnv = createEnv({ scripts: [] });
    return [
        { name: 'IIFE', doc: iife.w.document, lists: iife.lists, parse: iife.api.parse },
        { name: 'ESM', doc: esmEnv.w.document, lists: esmEnv.lists, parse: esm.parse },
        { name: 'CJS', doc: cjsEnv.w.document, lists: cjsEnv.lists, parse: cjs.parse }
    ];
}

test('三份构建产物的解析行为一致且无误伤', () => {
    for (const variant of makeVariants()) {
        assert.doesNotThrow(() => runCases(variant), variant.name + ' 产物应通过全部用例');
    }
});
