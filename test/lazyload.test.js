/** 表情面板懒加载 / 交互回归测试（jsdom，零 jQuery）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createEnv, options, ROOT } from './helpers/env.mjs';

test('懒加载、滚动增量、分组切换与预览', async () => {
    const env = createEnv({ rects: true });
    const picker = env.api.create('#content', options(env));
    const doc = env.w.document;
    const imgs = Array.from(doc.querySelectorAll('.mkep-grid img'));
    const loaded = () => imgs.filter(img => !img.hasAttribute('data-src')).length;
    const loadedIn = group => group.querySelectorAll('img:not([data-src])').length;

    // 1. 初始化：全部是占位图，路径都指向真实资源
    assert(imgs.length > 100, '应生成多个表情');
    assert.equal(loaded(), 0, '初始化时不应加载任何表情图片');
    assert(imgs.every(img => img.getAttribute('src').startsWith('data:image/gif')));
    const missing = imgs
        .map(img => img.getAttribute('data-src'))
        .filter(src => !existsSync(path.join(ROOT, src)));
    assert.equal(missing.length, 0, 'data-src 应对应真实文件: ' + missing.slice(0, 3).join(', '));

    // 2. 打开面板后只加载可视区域
    await picker.show();
    const first = loaded();
    assert(first > 0 && first < imgs.length, '应只加载可视表情，实际 ' + first);

    // 3. 滚动后增量加载
    env.setScrollRows(5);
    assert(picker.loadVisible() > 0);
    assert(loaded() > first, '滚动后应继续加载新进入可视区的表情');

    // 4. 切换分组：滚回顶部、只加载新分组
    const content = doc.querySelector('.mkep-content');
    const groups = Array.from(doc.querySelectorAll('.mkep-group'));
    const before = groups.map(loadedIn);
    const last = groups.length - 1;
    content.scrollTop = 200;
    doc.querySelectorAll('.mkep-tab')[last].click();
    assert.equal(content.scrollTop, 0, '切换分组应回到顶部');
    assert(loadedIn(groups[last]) > before[last], '新分组顶部应被加载');
    groups.forEach((group, i) => {
        if (i !== last) assert.equal(loadedIn(group), before[i], '隐藏分组不应加载');
    });

    // 5. 悬停预览写入真实地址，移出后复位
    const item = doc.querySelector('.mkep-group:not([hidden]) .mkep-item');
    const preview = doc.querySelector('.mkep-preview');
    item.dispatchEvent(new env.w.Event('pointerover', { bubbles: true }));
    assert.equal(preview.hasAttribute('hidden'), false);
    assert.ok(preview.querySelector('img').getAttribute('src'));
    item.dispatchEvent(new env.w.Event('pointerout', { bubbles: true }));
    assert.equal(preview.hasAttribute('hidden'), true);

    picker.destroy();
    env.close();
});
