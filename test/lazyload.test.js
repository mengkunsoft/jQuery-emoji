/**
 * 表情面板懒加载 / 交互回归测试（jsdom）
 *
 * 运行：node test/lazyload.test.js
 * 依赖：jsdom。可 npm i -D jsdom、设置 JSDOM_PATH 指向 jsdom 模块目录，
 *       若用 npm exec 临时安装，脚本会自动在 npm 缓存的 _npx 目录中查找。
 *
 * jsdom 没有布局，这里用内联 display 模拟 :visible、用 data-index 模拟网格位置。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const log = msg => console.log('[lazyload] ' + msg);

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

function createEnv() {
    const dom = new JSDOM('', { url: 'http://localhost/', runScripts: 'outside-only' });
    const w = dom.window;
    const t = w.document.createElement('textarea');
    t.id = 'content';
    w.document.body.appendChild(t);
    const b = w.document.createElement('button');
    b.id = 'btn';
    w.document.body.appendChild(b);

    w.eval(read('lib/script/jquery.min.js'));
    w.eval(read('src/js/jquery.emoji.js'));
    w.eval(read('src/js/emoji.list.js'));
    const $ = w.jQuery;

    Object.defineProperty(w.document.documentElement, 'clientHeight', { value: 768 });
    Object.defineProperty(w.document.documentElement, 'clientWidth', { value: 1024 });

    const visible = function (el) {
        let n = el;
        while (n && n.nodeType === 1) {
            if (n.style && n.style.display === 'none') return false;
            n = n.parentNode;
        }
        return true;
    };
    $.expr.filters.visible = visible;
    if ($.expr.pseudos) $.expr.pseudos.visible = visible;

    let scrollRows = 0;
    const rect = (top, bottom, left, right) => ({
        top, bottom, left, right, width: right - left, height: bottom - top
    });
    w.Element.prototype.getBoundingClientRect = function () {
        if (this.classList.contains('emoji_content')) return rect(0, 277, 0, 520);
        const a = this.closest('a[data-index]');
        const idx = a ? Number(a.getAttribute('data-index')) : 1;
        const row = Math.floor((idx - 1) / 9) - scrollRows;
        return rect(row * 54, row * 54 + 54, 0, 54);
    };

    $('#content').emoji({
        button: '#btn',
        animation: 'fade',
        basePath: 'images/emoji',
        icons: w.emojiLists
    });

    return {
        dom, w, $,
        c: $('#emoji_container_1'),
        setScrollRows: n => { scrollRows = n; }
    };
}

const wait = (w, ms) => new Promise(resolve => w.setTimeout(resolve, ms));

async function main() {
    const { w, $, c, setScrollRows } = createEnv();
    const imgs = c.find('.emoji_icons img');
    const loaded = () => imgs.filter((i, el) => !el.hasAttribute('data-src')).length;
    const loadedIn = sel => c.find(sel + ' img').filter((i, el) => !el.hasAttribute('data-src')).length;

    // 1. 初始化：全部是占位图，且不发起任何图片请求
    assert(imgs.length > 100, '应生成多个表情');
    assert.strictEqual(loaded(), 0, '初始化时不应加载任何表情图片');
    assert(imgs.toArray().every(el =>
        el.getAttribute('src').indexOf('data:image/gif') === 0 &&
        el.getAttribute('data-src').indexOf('images/emoji/') === 0
    ), '应使用占位图 + data-src');
    const missing = Array.from(imgs.toArray())
        .map(el => el.getAttribute('data-src'))
        .filter(src => !fs.existsSync(path.join(ROOT, src)));
    assert.strictEqual(missing.length, 0,
        'data-src 应对应真实存在的文件，缺失示例：' + missing.slice(0, 3).join(', '));
    log('初始化：' + imgs.length + ' 张，加载 0 张，路径全部有效');

    // 2. 点击按钮打开面板，动画结束后应自动加载可视区
    c.css('display', 'none');
    $('#btn').trigger('click');
    await wait(w, 900);
    assert(c.css('display') !== 'none', '点击后面板应显示');
    const first = loaded();
    assert(first > 0 && first < imgs.length, '应只加载可视表情');
    log('点击后自动加载：' + first + ' 张');

    // 3. 滚动后增量加载
    setScrollRows(5);
    const inst = Object.create($.fn.emoji.Constructor.prototype);
    inst.index = 1;
    inst._loadVisibleEmoji();
    assert(loaded() > first, '滚动后应继续加载新进入可视区的表情');
    log('滚动后累计：' + loaded() + ' 张');

    // 4. 切换分组：滚回顶部、只加载新分组
    const content = c.find('.emoji_content');
    const before = {};
    c.find('.emoji_icons').each(function () {
        before['#' + this.id] = loadedIn('#' + this.id);
    });
    const target = c.find('.emoji_icons').last()[0].id;
    content.scrollTop(200);
    c.find('li[data-emoji_tab="' + target + '"]').trigger('click');
    assert.strictEqual(content.scrollTop(), 0, '切换分组应回到顶部');
    assert(loadedIn('#' + target) > before['#' + target], '新分组顶部应被加载');
    c.find('.emoji_icons').each(function () {
        const id = '#' + this.id;
        if (id !== '#' + target) {
            assert.strictEqual(loadedIn(id), before[id], id + ' 隐藏时不应加载');
        }
    });
    log('切换分组：回到顶部，隐藏分组保持未加载');

    // 5. 单个表情写入真实相对路径（供编辑区插入 / 预览使用）
    const rest = imgs.toArray().find(el => el.hasAttribute('data-src'));
    const src = $.fn.emoji.Constructor.prototype._loadEmoji(rest);
    assert(src.indexOf('images/emoji/') === 0 && !rest.hasAttribute('data-src'), '应返回相对路径');
    log('_loadEmoji：' + src);

    w.close();
    log('ALL PASS');
}

main().catch(err => {
    console.error('[lazyload] FAILED:', err);
    process.exitCode = 1;
});
