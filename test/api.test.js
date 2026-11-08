/** 新公共 API 契约：create / parse / 实例方法 / 多实例 / 销毁。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnv, options, wait } from './helpers/env.mjs';

test('IIFE 产物暴露完整公共 API', () => {
    const env = createEnv();
    assert.equal(typeof env.api.create, 'function');
    assert.equal(typeof env.api.parse, 'function');
    assert.equal(typeof env.api.EmojiPicker, 'function');
    assert.equal(env.api.version, '2.0.0');
    env.close();
});

test('create 生成面板结构与无障碍属性', () => {
    const env = createEnv();
    const picker = env.api.create('#content', options(env));
    const panel = env.w.document.querySelector('.mkep-panel');

    assert.ok(panel, '应生成面板');
    assert.equal(panel.hasAttribute('hidden'), true, '面板初始隐藏');
    assert.equal(panel.getAttribute('role'), 'dialog');
    assert.ok(panel.querySelector('.mkep-grid'), '应使用 Grid 列表');
    assert.equal(panel.querySelectorAll('[role="tab"]').length, env.lists.length);
    assert.equal(panel.querySelectorAll('.mkep-group').length, env.lists.length);
    assert.equal(env.w.document.querySelectorAll('.mkep-panel').length, 1);

    picker.destroy();
    env.close();
});

test('同一目标重复 create 复用实例', () => {
    const env = createEnv();
    const first = env.api.create('#content', options(env));
    const second = env.api.create('#content', options(env));
    assert.equal(first, second);
    assert.equal(env.w.document.querySelectorAll('.mkep-panel').length, 1);
    second.destroy();
    env.close();
});

test('show / hide / toggle 切换可见状态', async () => {
    const env = createEnv();
    const picker = env.api.create('#content', options(env));
    const panel = env.w.document.querySelector('.mkep-panel');

    await picker.show();
    assert.equal(picker.isOpen, true);
    assert.equal(panel.hasAttribute('hidden'), false);
    assert.equal(panel.classList.contains('is-open'), true);

    await picker.hide();
    assert.equal(picker.isOpen, false);
    assert.equal(panel.hasAttribute('hidden'), true);

    await picker.toggle();
    assert.equal(picker.isOpen, true);
    await picker.toggle();
    assert.equal(picker.isOpen, false);

    picker.destroy();
    env.close();
});

test('点击按钮写入定位并切换面板', () => {
    const env = createEnv();
    const picker = env.api.create('#content', options(env));
    const panel = env.w.document.querySelector('.mkep-panel');
    const button = env.w.document.querySelector('#btn');

    button.click();
    assert.notEqual(panel.style.left, '', 'JS 应写入 inline left');
    assert.equal(picker.isOpen, true);
    button.click();
    assert.equal(picker.isOpen, false);

    picker.destroy();
    env.close();
});

test('点击表情向 textarea 插入代码并触发 onSelect', async () => {
    const env = createEnv();
    let selected = null;
    const picker = env.api.create('#content', options(env, {
        onSelect: (code, src) => { selected = { code, src }; }
    }));
    await picker.show();

    const item = env.w.document.querySelector('.mkep-group:not([hidden]) .mkep-item');
    const code = item.getAttribute('data-mkep-code');
    item.click();

    assert.equal(env.w.document.querySelector('#content').value, code);
    assert.equal(selected.code, code);
    assert.ok(selected.src.startsWith('images/emoji/'));

    picker.destroy();
    env.close();
});

test('Escape 关闭面板', async () => {
    const env = createEnv();
    const picker = env.api.create('#content', options(env));
    await picker.show();
    env.w.document.dispatchEvent(new env.w.KeyboardEvent('keydown', {
        key: 'Escape', bubbles: true
    }));
    await wait(0);
    assert.equal(picker.isOpen, false);
    assert.equal(env.w.document.querySelector('.mkep-panel').hasAttribute('hidden'), true);
    picker.destroy();
    env.close();
});

test('destroy 移除 DOM 并解绑事件', () => {
    const env = createEnv();
    env.api.create('#content', options(env)).destroy();
    assert.equal(env.w.document.querySelector('.mkep-panel'), null);
    env.w.document.querySelector('#btn').click();
    assert.equal(env.w.document.querySelector('.mkep-panel'), null);
    env.close();
});

test('未指定 button 时自动创建并销毁按钮', () => {
    const env = createEnv();
    const picker = env.api.create('#content', options(env, { button: null }));
    assert.ok(env.w.document.querySelector('.mkep-btn'));
    picker.destroy();
    assert.equal(env.w.document.querySelector('.mkep-btn'), null);
    env.close();
});

test('多实例互不干扰', () => {
    const html = '<!doctype html><html><body>' +
        '<textarea id="a"></textarea><button id="ba"></button>' +
        '<textarea id="b"></textarea><button id="bb"></button>' +
        '</body></html>';
    const env = createEnv({ html });
    const p1 = env.api.create('#a', options(env, { button: '#ba' }));
    const p2 = env.api.create('#b', options(env, { button: '#bb' }));
    assert.equal(env.w.document.querySelectorAll('.mkep-panel').length, 2);
    p1.destroy();
    assert.equal(env.w.document.querySelectorAll('.mkep-panel').length, 1);
    assert.equal(p2.destroyed, false);
    p2.destroy();
    env.close();
});

test('无效参数给出明确错误', () => {
    const env = createEnv();
    // jsdom eval 出来的错误来自另一个 realm，按 name/message 校验而非构造器
    assert.throws(
        () => env.api.create('#content', options(env, { icons: [] })),
        err => err.name === 'TypeError' && /icons/.test(err.message)
    );
    assert.throws(
        () => env.api.create('#missing', options(env)),
        err => err.name === 'TypeError' && /找不到目标元素/.test(err.message)
    );
    env.close();
});
