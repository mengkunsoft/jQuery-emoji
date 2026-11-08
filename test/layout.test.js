/** 面板布局回归测试（无头 Chrome / Edge）；找不到浏览器时自动跳过。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { findBrowser, probe } from './helpers/browser.mjs';

const browser = findBrowser();
const skip = browser ? false : '未找到 Chrome/Edge';

test('三种视口下 Grid 列宽与格子尺寸', { skip }, () => {
    for (const width of [1200, 800, 375]) {
        const r = probe(browser, 'test/layout.html', width);
        assert.equal(r.display, 'grid', 'Grid 布局应生效');
        assert(Math.abs(r.firstRowGap) < 0.6, '每行右侧不应留白: ' + r.firstRowGap + 'px');
        if (r.viewport <= 576) {
            assert.equal(r.cellH, 46, '小屏格子高度应为 46px');
            assert(r.cellW <= 50, '小屏格子应缩小');
            assert(r.cols >= 9, '小屏应能排更多列');
        } else {
            assert.equal(r.cellH, 54, '大屏格子高度应为 54px');
            assert(r.cellW >= 54, '大屏格子应不低于 54px');
            assert.equal(r.cols, 9, '大屏应保持 9 列');
        }
    }
});

test('真实插件面板：Grid、定位与懒加载', { skip }, () => {
    const p = probe(browser, 'test/plugin.html', 1200);
    assert.equal(p.grid, 'grid', '插件面板应使用 Grid');
    assert(p.loaded > 0 && p.total > 0, '应只加载可视区表情');
    assert(p.container > 400 && p.container <= 522, '容器宽度应正常: ' + p.container);
    assert.notEqual(p.inlineLeft, '', '点击后 JS 应写入 inline left');
});
