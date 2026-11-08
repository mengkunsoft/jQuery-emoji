/**
 * 把正文里的表情代码转换成图片。
 * 只处理文本节点，用 DOM API 生成节点，别名与路径里的特殊字符不会破坏结构。
 */
import { el, escapeRegExp, joinPath, ownerDoc, resolveElement } from './dom.js';

const ALIAS_RE = /\{alias\}/i;
const PARSED_ATTR = 'data-mkep-parsed';
const SKIP_TAGS = new Set([
    'script', 'style', 'noscript', 'iframe', 'textarea',
    'select', 'title', 'pre', 'code'
]);

/** 把一组表情配置编译成一条匹配规则。{alias} 只匹配已配置的别名或纯数字。 */
function buildRule(group, basePath, index) {
    const groupPath = group.path;
    if (typeof groupPath !== 'string' || !groupPath) {
        console.error('[mk-emoji-picker] 第 ' + index + ' 组表情未配置 path');
        return null;
    }

    const placeholder = group.placeholder;
    if (typeof placeholder !== 'string' || !ALIAS_RE.test(placeholder)) {
        console.error('[mk-emoji-picker] 第 ' + index + ' 组表情未配置含 {alias} 的 placeholder');
        return null;
    }

    const emoji = group.emoji || null;
    if (emoji && typeof emoji !== 'object') {
        console.error('[mk-emoji-picker] 第 ' + index + ' 组 emoji 参数不正确');
        return null;
    }

    let aliasSource;
    let resolve;
    let named = false;
    if (emoji) {
        const names = Object.keys(emoji).filter(key =>
            Object.prototype.hasOwnProperty.call(emoji, key) &&
            typeof emoji[key] === 'string' && emoji[key]
        );
        // 长别名优先，避免「笑」抢先匹配掉「笑哭」
        names.sort((a, b) => b.length - a.length);
        if (!names.length) return null;
        aliasSource = '(?:' + names.map(escapeRegExp).join('|') + ')';
        resolve = alias => emoji[alias];
        named = true;
    } else {
        aliasSource = '\\d+';
        resolve = alias => alias;
    }

    const literals = placeholder.split(ALIAS_RE);
    let source = '';
    for (let p = 0; p < literals.length; p++) {
        source += escapeRegExp(literals[p]);
        if (p < literals.length - 1) source += '(' + aliasSource + ')';
    }

    return {
        order: index,
        regexp: new RegExp(source, 'g'),
        aliasCount: literals.length - 1,
        named,
        resolve,
        path: joinPath(basePath, groupPath),
        file: group.file || '.jpg'
    };
}

/** options.className 支持空格分隔的字符串或字符串数组，过滤空值与非字符串。 */
function normalizeClasses(value) {
    const list = Array.isArray(value) ? value : [value];
    const classes = [];
    for (const item of list) {
        if (typeof item !== 'string') continue;
        for (const name of item.trim().split(/\s+/)) {
            if (name && !classes.includes(name)) classes.push(name);
        }
    }
    return classes;
}

function collectTextNodes(root, list) {
    for (const child of Array.from(root.childNodes)) {
        if (child.nodeType === 3) {
            if (child.nodeValue) list.push(child);
        } else if (child.nodeType === 1 && !SKIP_TAGS.has(child.nodeName.toLowerCase())) {
            collectTextNodes(child, list);
        }
    }
}

/** 在单个文本节点内找出所有代码，按位置去重后一次性替换。 */
function replaceInTextNode(node, rules, doc, classNames = []) {
    const text = node.nodeValue;
    const hits = [];

    for (const rule of rules) {
        rule.regexp.lastIndex = 0;
        let match;
        while ((match = rule.regexp.exec(text)) !== null) {
            if (!match[0].length) {
                rule.regexp.lastIndex++;
                continue;
            }
            let alias = '';
            for (let g = 1; g <= rule.aliasCount; g++) {
                if (match[g] !== undefined) { alias = match[g]; break; }
            }
            const file = rule.resolve(alias);
            if (!file) continue;
            hits.push({
                start: match.index,
                end: match.index + match[0].length,
                rule,
                alias,
                file
            });
        }
    }
    if (!hits.length) return;

    hits.sort((a, b) => a.start - b.start ||
        (b.end - b.start) - (a.end - a.start) ||
        a.rule.order - b.rule.order);

    const frag = doc.createDocumentFragment();
    let cursor = 0;
    for (const hit of hits) {
        if (hit.start < cursor) continue;
        if (hit.start > cursor) {
            frag.appendChild(doc.createTextNode(text.slice(cursor, hit.start)));
        }
        const img = el(doc, 'img', 'mkep-smiley', {
            src: hit.rule.path + hit.file + hit.rule.file,
            alt: hit.rule.named ? hit.alias : '',
            loading: 'lazy',
            decoding: 'async'
        });
        if (hit.rule.named) img.setAttribute('title', hit.alias);
        if (classNames.length) img.classList.add(...classNames);
        frag.appendChild(img);
        cursor = hit.end;
    }
    if (cursor < text.length) {
        frag.appendChild(doc.createTextNode(text.slice(cursor)));
    }
    node.parentNode.replaceChild(frag, node);
}

/**
 * 解析一个元素内的表情代码，返回该元素（便于链式调用）。
 * 生成的图片带 mkep-smiley 类，可通过 options.className 追加自定义类。
 * 默认每个元素只解析一次；options.force = true 可强制重新解析。
 */
export function parse(target, options = {}) {
    const doc = ownerDoc(target, options);
    if (!doc) throw new Error('[mk-emoji-picker] parse 需要 document 环境');
    const root = resolveElement(target, doc);
    if (!root) throw new TypeError('[mk-emoji-picker] parse 找不到目标元素: ' + String(target));
    if (!options.force && root.getAttribute(PARSED_ATTR) === '1') return root;

    const groups = Array.isArray(options.icons) ? options.icons : [];
    const basePath = typeof options.basePath === 'string' ? options.basePath : '';
    const rules = groups.map((group, i) => buildRule(group, basePath, i)).filter(Boolean);
    if (!rules.length) return root;

    const classNames = normalizeClasses(options.className);
    const nodes = [];
    collectTextNodes(root, nodes);
    for (const node of nodes) replaceInTextNode(node, rules, doc, classNames);
    root.setAttribute(PARSED_ATTR, '1');
    return root;
}
