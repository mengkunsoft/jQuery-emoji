/** jsdom 测试环境：加载构建产物，提供无布局环境下的矩形桩。 */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function read(rel) {
    return readFileSync(path.join(ROOT, rel), 'utf8');
}

export const BASE_HTML = '<!doctype html><html><body>' +
    '<textarea id="content"></textarea><button id="btn" type="button"></button>' +
    '</body></html>';

function rect(top, bottom, left, right) {
    return {
        top, bottom, left, right,
        width: right - left,
        height: bottom - top,
        x: left,
        y: top
    };
}

/** 按 data-mkep-index 模拟 9 列网格，让懒加载逻辑可在 jsdom 中验证。 */
function installRects(w) {
    let scrollRows = 0;
    w.Element.prototype.getBoundingClientRect = function () {
        if (this.classList.contains('mkep-content')) return rect(0, 277, 0, 520);
        if (this.classList.contains('mkep-panel')) return rect(0, 310, 0, 520);
        if (this.tagName === 'TEXTAREA' || this.classList.contains('mkep-btn')) {
            return rect(0, 30, 0, 100);
        }
        const item = this.closest('[data-mkep-index]');
        const index = item ? Number(item.getAttribute('data-mkep-index')) : 1;
        const row = Math.floor((index - 1) / 9) - scrollRows;
        const col = (index - 1) % 9;
        return rect(row * 54, row * 54 + 54, col * 54, col * 54 + 54);
    };
    return { setScrollRows: n => { scrollRows = n; } };
}

export function createEnv({
    html = BASE_HTML,
    scripts = ['dist/mk-emoji-picker.js'],
    list = true,
    rects = false
} = {}) {
    const dom = new JSDOM(html, {
        url: 'http://localhost/',
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });
    const w = dom.window;
    for (const script of scripts) w.eval(read(script));
    if (list) w.eval(read('dist/emoji-list.js'));

    Object.defineProperty(w.document.documentElement, 'clientHeight', { value: 768 });
    Object.defineProperty(w.document.documentElement, 'clientWidth', { value: 1024 });

    const rectHelpers = rects ? installRects(w) : { setScrollRows: () => {} };
    return {
        dom,
        w,
        api: w.MkEmojiPicker,
        lists: w.mkEmojiLists,
        ...rectHelpers,
        close: () => w.close()
    };
}

export function options(env, extra = {}) {
    return {
        button: '#btn',
        animation: 'none',
        basePath: 'images/emoji',
        icons: env.lists,
        ...extra
    };
}

export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
