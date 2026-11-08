/**
 * 共享 DOM 工具。所有函数都从目标元素上取 Document / Window，
 * 模块顶层不访问 window 或 document，便于在 jsdom、iframe 与打包器里使用。
 */

export const BLANK_IMG =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function ownerDoc(target, options) {
    if (options && options.document) return options.document;
    if (target && target.nodeType === 1) return target.ownerDocument;
    return globalThis.document;
}

export function resolveElement(target, doc) {
    if (typeof target === 'string') return doc.querySelector(target);
    return target && target.nodeType === 1 ? target : null;
}

/** 用 DOM API 创建元素，配置项一律通过属性写入，不拼接 innerHTML。 */
export function el(doc, tag, className, attrs) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (attrs) {
        for (const key of Object.keys(attrs)) {
            const value = attrs[key];
            if (value === null || value === undefined || value === false) continue;
            if (key === 'text') node.textContent = String(value);
            else node.setAttribute(key, value === true ? '' : String(value));
        }
    }
    return node;
}

/** 替代 jQuery 的 :visible，断言自身与所有祖先都可见。 */
export function isVisible(node, doc) {
    const view = doc.defaultView;
    for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
        if (n.hidden || n.hasAttribute('hidden')) return false;
        if (n.style && (n.style.display === 'none' || n.style.visibility === 'hidden')) {
            return false;
        }
        if (view && typeof view.getComputedStyle === 'function') {
            const style = view.getComputedStyle(n);
            if (style && (style.display === 'none' || style.visibility === 'hidden')) {
                return false;
            }
        }
    }
    return true;
}

/** 替代 jQuery .offset() / .outerHeight()。 */
export function offset(node) {
    const rect = node.getBoundingClientRect();
    const view = node.ownerDocument.defaultView;
    return {
        top: rect.top + (view ? view.scrollY || view.pageYOffset || 0 : 0),
        left: rect.left + (view ? view.scrollX || view.pageXOffset || 0 : 0),
        width: rect.width,
        height: rect.height
    };
}

/** 把 data-src 写入 src，返回最终地址。 */
export function loadImage(img) {
    if (!img) return '';
    const src = img.getAttribute('data-src');
    if (src) {
        img.setAttribute('src', src);
        img.removeAttribute('data-src');
    }
    return img.getAttribute('src') || '';
}

export function joinPath(basePath, groupPath) {
    if (!basePath) return groupPath;
    return basePath.replace(/\/+$/, '') + '/' + groupPath.replace(/^\/+/, '');
}

export function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function prefersReducedMotion(view) {
    return !!(view && typeof view.matchMedia === 'function' &&
        view.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/**
 * 在光标处插入文本或节点。
 * contenteditable 用 Selection/Range，textarea/input 用 selectionStart/End。
 */
export function insertAtCursor(field, value) {
    const doc = field.ownerDocument;
    const view = doc.defaultView;

    if (field.nodeName === 'DIV' || field.isContentEditable) {
        field.focus();
        const selection = view && view.getSelection && view.getSelection();
        if (!selection || !selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const node = typeof value === 'string' ? doc.createTextNode(value) : value;
        const frag = doc.createDocumentFragment();
        frag.appendChild(node);
        range.insertNode(frag);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return;
    }

    const text = String(value);
    const start = field.selectionStart;
    const end = field.selectionEnd;
    if (typeof start === 'number' && typeof end === 'number') {
        const scrollTop = field.scrollTop;
        field.value = field.value.slice(0, start) + text + field.value.slice(end);
        field.scrollTop = scrollTop;
        field.selectionStart = start + text.length;
        field.selectionEnd = start + text.length;
    } else {
        field.value += text;
    }
    field.focus();
}
