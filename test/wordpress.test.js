/**
 * WordPress 插件回归测试：PHP 函数桩 + 构建产物 / ZIP 结构校验。
 * 本机没有 PHP 时相关用例跳过；CI 设置 MKEP_REQUIRE_PHP=1 强制验证。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers/env.mjs';
import { findPhp } from './helpers/runtime.mjs';

const php = findPhp();
const requirePhp = process.env.MKEP_REQUIRE_PHP === '1';
const skipPhp = !php && !requirePhp ? '未找到 PHP' : false;
const fixture = path.join(ROOT, 'test/wordpress/wp_fixture.php');
const pluginSrc = path.join(ROOT, 'wordpress/src');
const pluginOut = path.join(ROOT, 'wordpress/mk-emoji-picker');
const BASE = 'https://example.com/wp-content/plugins/mk-emoji-picker/';
const img = (src, alias) =>
    `<img class="mkep-smiley" src="${src}" alt="${alias}" loading="lazy" decoding="async"` +
    (alias ? ` title="${alias}"` : '') + '>';

function run(input = {}) {
    assert.ok(php, '要求验证 WordPress 插件，但未找到 PHP');
    const out = execFileSync(php, [fixture], {
        input: JSON.stringify(input),
        encoding: 'utf8'
    });
    return JSON.parse(out);
}

function hookTags(result) {
    return result.filters.map(item => item.tag);
}

function phpFiles(dir) {
    const files = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...phpFiles(file));
        } else if (entry.name.endsWith('.php')) {
            files.push(file);
        }
    }
    return files;
}

/** 只读 ZIP 中央目录，验证文件名清单，避免引入解压依赖。 */
function zipEntries(buffer) {
    let eocd = -1;
    const min = Math.max(0, buffer.length - 65557);
    for (let i = buffer.length - 22; i >= min; i--) {
        if (buffer.readUInt32LE(i) === 0x06054b50) {
            eocd = i;
            break;
        }
    }
    assert.notEqual(eocd, -1, 'ZIP 缺少 EOCD');
    const count = buffer.readUInt16LE(eocd + 10);
    let offset = buffer.readUInt32LE(eocd + 16);
    const names = [];
    for (let i = 0; i < count; i++) {
        assert.equal(buffer.readUInt32LE(offset), 0x02014b50, 'ZIP 中央目录损坏');
        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        names.push(buffer.toString('utf8', offset + 46, offset + 46 + nameLength));
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return names;
}

test('插件头、文件结构与 PHP 语法', { skip: skipPhp }, () => {
    const header = readFileSync(path.join(pluginSrc, 'mk-emoji-picker.php'), 'utf8');
    for (const field of [
        'Plugin Name:', 'Description:', 'Version:',
        'Requires at least:', 'Requires PHP:', 'Text Domain:'
    ]) {
        assert.ok(header.includes(field), '插件头缺少 ' + field);
    }
    assert.match(header, /Requires PHP:\s*7\.4/);
    assert.match(header, /if \(!defined\('ABSPATH'\)\)/);

    const files = [
        ...phpFiles(pluginSrc),
        fixture,
        path.join(ROOT, 'server/php/EmojiParser.php')
    ];
    assert.equal(files.length, 6);
    for (const file of files) {
        execFileSync(php, ['-l', file], { stdio: 'pipe' });
    }
});

test('默认配置：评论解析、按钮注入与前端资源', { skip: skipPhp }, () => {
    const r = run();
    const list = hookTags(r);
    assert.ok(list.includes('comment_text'));
    assert.ok(!list.includes('the_content'));
    assert.ok(!list.includes('the_excerpt'));
    assert.ok(list.includes('comment_form_field_comment'));
    assert.ok(list.includes('wp_enqueue_scripts'));

    assert.deepEqual(r.removed.map(item => item[0]), ['the_content', 'the_excerpt', 'comment_text']);
    assert.ok(r.removed.every(item => item[1] === 'convert_smilies' && item[2] === 20));

    assert.equal(r.comment_text,
        '<p>你好' + img(BASE + 'images/emoji/qq/weixiao.gif', '微笑') +
        ' 和 ' + img(BASE + 'images/emoji/aru/11.png', '') + '</p>');
    assert.equal(r.the_content, '<p>你好[微笑] 和 [aru_11]</p>');

    assert.match(r.field, /id="mkep-comment-button"/);
    assert.match(r.field, /aria-haspopup="dialog"/);
    assert.match(r.field, /<textarea id="comment"><\/textarea>/);

    assert.equal(r.enqueue_result, true);
    assert.deepEqual(r.enqueued.map(item => item[1]), [
        'mk-emoji-picker', 'mk-emoji-picker-wp', 'mk-emoji-picker', 'mk-emoji-list'
    ]);
    assert.ok(r.enqueued.every(item => item[2].startsWith(BASE + 'assets/')));
    assert.equal(r.inline.length, 1);
    assert.equal(r.inline[0][0], 'mk-emoji-list');
    assert.match(r.inline[0][1], /MkEmojiPicker\.create\(field, config\)/);
    assert.ok(r.inline[0][1].includes('"basePath":"' + BASE + 'images/emoji/"'));
    assert.match(r.inline[0][1], /aria-expanded/);
});

test('设置项控制解析位置与表情面板开关', { skip: skipPhp }, () => {
    const r = run({
        options: {
            parse_comments: 0,
            parse_content: 1,
            parse_excerpt: 1,
            disable_core_smilies: 0,
            enable_picker: 0
        }
    });
    const list = hookTags(r);
    assert.ok(!list.includes('comment_text'));
    assert.ok(list.includes('the_content'));
    assert.ok(list.includes('the_excerpt'));
    assert.ok(!list.includes('comment_form_field_comment'));
    assert.ok(!list.includes('wp_enqueue_scripts'));
    assert.deepEqual(r.removed, []);
    assert.equal(r.enqueue_result, false);
    assert.equal(r.field, '<p class="comment-form-comment"><textarea id="comment"></textarea></p>');
    assert.equal(r.comment_text, '<p>你好[微笑] 和 [aru_11]</p>');
    assert.ok(r.the_content.includes('mkep-smiley'));
});

test('自定义图片目录与附加 CSS 类', { skip: skipPhp }, () => {
    const r = run({
        options: {
            class_name: 'wp-smiley comment-emoji',
            image_base_url: 'https://cdn.example.com/emoji/'
        }
    });
    assert.equal(r.base_path, 'https://cdn.example.com/emoji/');
    assert.match(r.comment_text, /class="mkep-smiley wp-smiley comment-emoji"/);
    assert.ok(r.comment_text.includes('src="https://cdn.example.com/emoji/qq/weixiao.gif"'));
    assert.ok(!r.comment_text.includes(BASE + 'images/emoji/'));
});

test('纯文本模式转义非表情内容', { skip: skipPhp }, () => {
    const r = run({ options: { escape_html: 1 }, text: '1 < 2 & [微笑]' });
    assert.equal(r.comment_text,
        '1 &lt; 2 &amp; ' + img(BASE + 'images/emoji/qq/weixiao.gif', '微笑'));
});

test('HTML 模式跳过标签属性与代码块', { skip: skipPhp }, () => {
    const r = run({ text: '<span title="[微笑]">正文[微笑]</span><pre>[aru_11]</pre>' });
    assert.equal(r.comment_text,
        '<span title="[微笑]">正文' + img(BASE + 'images/emoji/qq/weixiao.gif', '微笑') +
        '</span><pre>[aru_11]</pre>');
});

test('设置项净化：拒绝危险 URL、清理类名、归一开关', { skip: skipPhp }, () => {
    const r = run({
        sanitize: {
            parse_comments: '1',
            parse_content: '',
            parse_excerpt: 1,
            disable_core_smilies: 'yes',
            enable_picker: 1,
            escape_html: 0,
            image_base_url: 'javascript:alert(1)',
            class_name: 'bad"class  ok-class ok-class <script>'
        }
    });
    const s = r.sanitized;
    assert.equal(s.image_base_url, '');
    assert.equal(s.class_name, 'badclass ok-class script');
    assert.deepEqual([
        s.parse_comments, s.parse_content, s.parse_excerpt,
        s.disable_core_smilies, s.enable_picker, s.escape_html
    ], [1, 0, 1, 1, 1, 0]);
    assert.equal(Object.keys(s).sort().join(','), Object.keys(r.defaults).sort().join(','));

    const ok = run({
        sanitize: { image_base_url: 'https://cdn.example.com/emoji/', class_name: 'wp-smiley' }
    });
    assert.equal(ok.sanitized.image_base_url, 'https://cdn.example.com/emoji/');
    assert.equal(ok.sanitized.class_name, 'wp-smiley');
});

test('非文章页不加载前端资源', { skip: skipPhp }, () => {
    const r = run({ flags: { is_singular: false } });
    assert.equal(r.enqueue_result, false);
    assert.deepEqual(r.enqueued, []);
});

test('后台设置页、权限与插件快捷链接', { skip: skipPhp }, () => {
    const r = run({ flags: { is_admin: true } });
    assert.equal(r.admin_pages.length, 1);
    assert.equal(r.admin_pages[0][3], 'mk-emoji-picker');
    assert.equal(r.settings[0][1], 'mkep_options');
    assert.match(r.admin_page, /name="mkep_options\[parse_comments\]"/);
    assert.match(r.admin_page, /name="mkep_options\[image_base_url\]"/);
    assert.match(r.action_links[1], /options-general\.php\?page=mk-emoji-picker/);

    const denied = run({ flags: { is_admin: true, can_manage: false } });
    assert.equal(denied.admin_page, '');
});

test('mkep_parse_text 可覆盖 basePath', { skip: skipPhp }, () => {
    const r = run();
    assert.equal(r.parse_direct, img('https://cdn.example.com/emoji/qq/weixiao.gif', '微笑'));
});

test('插件构建产物与 ZIP 结构完整', () => {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/build-wordpress.mjs')], {
        cwd: ROOT,
        stdio: 'pipe'
    });
    for (const file of [
        'mk-emoji-picker.php', 'readme.txt', 'uninstall.php',
        'includes/EmojiParser.php', 'includes/class-mk-emoji-picker.php', 'includes/admin-page.php',
        'assets/mk-emoji-picker.js', 'assets/mk-emoji-picker.css',
        'assets/emoji-list.js', 'assets/emoji-list.json', 'assets/frontend.css'
    ]) {
        assert.ok(existsSync(path.join(pluginOut, file)), '缺少 ' + file);
    }
    assert.ok(readdirSync(path.join(pluginOut, 'images/emoji/qq')).length > 10);

    const zip = readFileSync(path.join(ROOT, 'wordpress/mk-emoji-picker-2.0.0.zip'));
    const names = zipEntries(zip);
    for (const file of [
        'mk-emoji-picker/mk-emoji-picker.php',
        'mk-emoji-picker/readme.txt',
        'mk-emoji-picker/includes/EmojiParser.php',
        'mk-emoji-picker/assets/emoji-list.json',
        'mk-emoji-picker/assets/mk-emoji-picker.js'
    ]) {
        assert.ok(names.includes(file), 'ZIP 缺少 ' + file);
    }
    assert.ok(names.filter(name => name.startsWith('mk-emoji-picker/images/emoji/')).length >= 500);
});
