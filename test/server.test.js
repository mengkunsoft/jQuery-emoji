/**
 * 跨语言一致性测试：同一组输入在前端 JS、PHP、Java 三端应生成相同的表情图片。
 * 找不到对应运行时（本机可能没有 JDK）时，该语言的用例自动跳过。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEnv, ROOT } from './helpers/env.mjs';
import { findPhp } from './helpers/runtime.mjs';

const B = 'images/emoji/';
const opts = (extra = {}) => ({ basePath: B, escape: false, ...extra });
const img = (src, alias, extraClass = '') =>
    `<img class="mkep-smiley${extraClass ? ' ' + extraClass : ''}" src="${src}"` +
    ` alt="${alias}" loading="lazy" decoding="async"${alias ? ` title="${alias}"` : ''}>`;

const QQ = img(B + 'qq/weixiao.gif', '微笑');
const ARU11 = img(B + 'aru/11.png', '');
const ARU140 = img(B + 'aru/140.png', '');
const ROSE = img(B + 'newtieba/meigui.png', '玫瑰');

const cases = [
    {
        name: '常规转换：命名表情 / 序号表情 / 正文保留',
        text: '#(玫瑰)好用[aru_11]，还有[微笑]和[aru_140]',
        options: opts(),
        expected: ROSE + '好用' + ARU11 + '，还有' + QQ + '和' + ARU140,
        js: true
    },
    {
        name: 'HTML 属性不被替换',
        text: '<span title="[微笑]" data-code="[aru_11]">正文[微笑]</span>',
        options: opts(),
        expected: '<span title="[微笑]" data-code="[aru_11]">正文' + QQ + '</span>',
        js: true
    },
    {
        name: 'script 等敏感标签整块跳过',
        text: '<script>var a = "[微笑]";</script><p>[aru_11]</p>',
        options: opts(),
        expected: '<script>var a = "[微笑]";</script><p>' + ARU11 + '</p>',
        js: true
    },
    {
        name: '未知别名 / 半截代码 / 原型链键不误伤',
        text: '[未知表情][aru_][aru_x][constructor] [微笑]',
        options: opts(),
        expected: '[未知表情][aru_][aru_x][constructor] ' + QQ,
        js: true
    },
    {
        name: 'className 自定义类',
        text: '[微笑]',
        options: opts({ className: 'comment-emoji rounded' }),
        expected: img(B + 'qq/weixiao.gif', '微笑', 'comment-emoji rounded'),
        js: true
    },
    {
        name: '纯文本模式转义 HTML 特殊字符',
        text: '1 < 2 & [微笑] "x"',
        options: { basePath: B },
        expected: '1 &lt; 2 &amp; ' + QQ + ' &quot;x&quot;'
    },
    {
        name: '纯文本模式转义注入片段',
        text: '<img src=x onerror="[微笑]">',
        options: { basePath: B },
        expected: '&lt;img src=x onerror=&quot;' + QQ + '&quot;&gt;'
    },
    {
        name: 'basePath 尾部斜杠不拼出双斜杠',
        text: '[aru_11]',
        options: { basePath: 'images/emoji/', escape: false },
        expected: ARU11,
        js: true
    },
    {
        name: '自定义分组与长别名优先',
        text: '[ab] [a]',
        options: {
            basePath: '',
            escape: false,
            icons: [{
                path: 'custom/',
                file: '.png',
                placeholder: '[{alias}]',
                emoji: { a: 'a', ab: 'ab' }
            }]
        },
        expected: img('custom/ab.png', 'ab') + ' ' + img('custom/a.png', 'a'),
        js: true
    },
    {
        name: '中文长别名优先',
        text: '[笑哭] [笑]',
        options: {
            basePath: '',
            escape: false,
            icons: [{
                path: 'custom/',
                file: '.png',
                placeholder: '[{alias}]',
                emoji: { '笑': 'x', '笑哭': 'y' }
            }]
        },
        expected: img('custom/y.png', '笑哭') + ' ' + img('custom/x.png', '笑'),
        js: true
    },
    {
        name: '重叠位置取更长的匹配',
        text: '[[x]]',
        options: {
            basePath: '',
            escape: false,
            icons: [
                { path: 'a/', file: '.png', placeholder: '[{alias}]', emoji: { x: 'a' } },
                { path: 'b/', file: '.png', placeholder: '[[{alias}]]', emoji: { x: 'b' } }
            ]
        },
        expected: img('b/b.png', 'x'),
        js: true
    }
];

const payload = c => JSON.stringify({ text: c.text, options: c.options });
const extractSrcs = html => Array.from(html.matchAll(/<img[^>]*\ssrc="([^"]*)"/g), m => m[1]);

function findJava() {
    const ext = process.env.JAVA_HOME
        ? path.join(process.env.JAVA_HOME, 'bin')
        : null;
    const suffix = process.platform === 'win32' ? '.exe' : '';
    const javac = ext ? path.join(ext, 'javac' + suffix) : 'javac';
    const java = ext ? path.join(ext, 'java' + suffix) : 'java';
    try {
        execFileSync(javac, ['-version'], { stdio: 'ignore' });
        execFileSync(java, ['-version'], { stdio: 'ignore' });
        return { javac, java };
    } catch {
        return null;
    }
}

const php = findPhp();
const javaTools = findJava();
const requirePhp = process.env.MKEP_REQUIRE_PHP === '1';
const requireJava = process.env.MKEP_REQUIRE_JAVA === '1';

test('PHP 解析输出符合跨语言契约', { skip: !php && !requirePhp ? '未找到 PHP' : false }, () => {
    assert.ok(php, '要求验证 PHP 解析器，但未找到 PHP');
    const fixture = path.join(ROOT, 'test/server/php_fixture.php');
    for (const c of cases) {
        const out = execFileSync(php, [fixture], {
            input: payload(c),
            encoding: 'utf8'
        });
        assert.equal(out, c.expected, 'PHP: ' + c.name);
    }
});

test('Java 解析输出符合跨语言契约', { skip: !javaTools && !requireJava ? '未找到 JDK' : false }, () => {
    assert.ok(javaTools, '要求验证 Java 解析器，但未找到 JDK');
    const work = mkdtempSync(path.join(os.tmpdir(), 'mkep-java-'));
    try {
        execFileSync(javaTools.javac, [
            '-encoding', 'UTF-8', '-d', work,
            path.join(ROOT, 'server/java/EmojiParser.java'),
            path.join(ROOT, 'test/server/JavaFixture.java')
        ], { stdio: 'pipe' });
        const config = path.join(ROOT, 'dist/emoji-list.json');
        for (const c of cases) {
            const out = execFileSync(javaTools.java, [
                '-cp', work, 'JavaFixture', config
            ], { input: payload(c), encoding: 'utf8' });
            assert.equal(out, c.expected, 'Java: ' + c.name);
        }
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
});

test('前端 parse 与后端用例生成相同的图片地址', async () => {
    const { parse } = await import('../dist/mk-emoji-picker.esm.js');
    const env = createEnv({ scripts: [] });
    for (const c of cases.filter(item => item.js)) {
        const box = env.w.document.createElement('div');
        box.innerHTML = c.text;
        parse(box, {
            basePath: c.options.basePath,
            icons: c.options.icons || env.lists,
            className: c.options.className
        });
        const srcs = Array.from(box.querySelectorAll('img.mkep-smiley'))
            .map(node => node.getAttribute('src'));
        assert.deepEqual(srcs, extractSrcs(c.expected), 'JS: ' + c.name);
    }
    env.close();
});
