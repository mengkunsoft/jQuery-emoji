/**
 * 表情面板：零依赖、原生 DOM、支持多实例与显式销毁。
 */
import {
    BLANK_IMG, el, insertAtCursor, isVisible, joinPath,
    loadImage, offset, ownerDoc, prefersReducedMotion, resolveElement
} from './dom.js';

const DEFAULTS = {
    button: null,
    container: null,
    showTab: true,
    animation: 'fade',
    basePath: '',
    icons: [],
    onSelect: null,
    onShow: null,
    onHide: null
};

const MOTION_MS = 180;
const LOAD_BUFFER = 100;
const instances = new WeakMap();
let nextId = 0;

export class EmojiPicker {
    constructor(target, options = {}) {
        const doc = ownerDoc(target, options);
        if (!doc) throw new Error('[mk-emoji-picker] create 需要 document 环境');
        const field = resolveElement(target, doc);
        if (!field) throw new TypeError('[mk-emoji-picker] 找不到目标元素: ' + String(target));
        if (!Array.isArray(options.icons) || !options.icons.length) {
            throw new TypeError('[mk-emoji-picker] options.icons 必须是非空数组');
        }

        this.doc = doc;
        this.win = doc.defaultView || globalThis;
        this.field = field;
        this.options = { ...DEFAULTS, ...options };
        this.container = resolveElement(this.options.container, doc) || doc.body;
        this.id = ++nextId;
        this.destroyed = false;
        this.isOpen = false;
        this.ownsButton = false;
        this._listeners = [];
        this._loadTimer = 0;
        this.groups = [];
        this.tabButtons = [];

        this._build();
        this._bind();
        instances.set(field, this);
        this._scheduleLoad();
    }

    get animation() {
        const value = this.options.animation;
        return value === 'none' || value === 'slide' ? value : 'fade';
    }

    _build() {
        const o = this.options;
        const doc = this.doc;

        if (o.button) {
            this.button = resolveElement(o.button, doc);
            if (!this.button) throw new TypeError('[mk-emoji-picker] 找不到 button: ' + String(o.button));
        } else {
            this.button = el(doc, 'button', 'mkep-btn', {
                type: 'button',
                title: '表情',
                'aria-label': '打开表情面板',
                text: ':)'
            });
            this.container.appendChild(this.button);
            this.ownsButton = true;
            const box = offset(this.field);
            this.button.style.top = (box.top + box.height + 10) + 'px';
            this.button.style.left = (box.left + 2) + 'px';
        }

        this.panel = el(doc, 'div', 'mkep-panel', {
            id: 'mkep-panel-' + this.id,
            'data-mkep-panel': String(this.id),
            role: 'dialog',
            'aria-label': '表情面板',
            hidden: true
        });
        this.panel.dataset.animation = this.animation;

        this.content = el(doc, 'div', 'mkep-content');
        this.panel.appendChild(this.content);

        this._groupMeta = o.icons.filter((group, i) => this._validateGroup(group, i));
        if (!this._groupMeta.length) {
            if (this.ownsButton) this.button.remove();
            throw new TypeError('[mk-emoji-picker] options.icons 中没有可用的表情分组');
        }
        this._groupMeta.forEach((group, i) => this._buildGroup(group, i));

        this.tabs = el(doc, 'div', 'mkep-tabs', {
            role: 'tablist',
            'aria-label': '表情分组'
        });
        if (this._groupMeta.length === 1 && !o.showTab) this.tabs.setAttribute('hidden', '');
        const list = el(doc, 'div', 'mkep-tabs__list');
        const ul = el(doc, 'ul', 'mkep-tabs__items');
        this._groupMeta.forEach((group, i) => {
            const li = el(doc, 'li', 'mkep-tabs__item');
            const tab = el(doc, 'button', 'mkep-tab', {
                type: 'button',
                role: 'tab',
                'aria-selected': i === 0 ? 'true' : 'false',
                'data-mkep-group': String(i),
                title: group.name || 'group' + (i + 1),
                text: group.name || 'group' + (i + 1)
            });
            if (i === 0) tab.classList.add('is-selected');
            else tab.tabIndex = -1;
            li.appendChild(tab);
            ul.appendChild(li);
            this.tabButtons.push(tab);
        });
        list.appendChild(ul);
        this.tabs.appendChild(list);
        this.panel.appendChild(this.tabs);

        this.preview = el(doc, 'div', 'mkep-preview', { hidden: true, 'aria-hidden': 'true' });
        this.previewImg = el(doc, 'img', '', { alt: '' });
        this.preview.appendChild(this.previewImg);
        this.panel.appendChild(this.preview);

        this.container.appendChild(this.panel);
    }

    _validateGroup(group, index) {
        if (typeof group.path !== 'string' || !group.path) {
            console.error('[mk-emoji-picker] 第 ' + index + ' 组表情未配置 path');
            return false;
        }
        if (!group.emoji && !Number(group.maxNum)) {
            console.error('[mk-emoji-picker] 第 ' + index + ' 组需要 maxNum 或 emoji');
            return false;
        }
        return true;
    }

    _buildGroup(group, index) {
        const o = this.options;
        const doc = this.doc;
        const placeholder = group.placeholder || '#em' + (index + 1) + '_{alias}#';
        const file = group.file || '.jpg';
        const path = joinPath(o.basePath, group.path);
        const maxNum = Number(group.maxNum) || 0;
        const excludeNums = Array.isArray(group.excludeNums) ? group.excludeNums : [];
        const emoji = group.emoji && typeof group.emoji === 'object' ? group.emoji : null;

        const panel = el(doc, 'div', 'mkep-group', {
            id: 'mkep-group-' + this.id + '-' + index,
            'data-mkep-group': String(index),
            role: 'tabpanel'
        });
        if (index !== 0) panel.setAttribute('hidden', '');
        const ul = el(doc, 'ul', 'mkep-grid');

        const addItem = (alias, fileKey, order) => {
            const li = el(doc, 'li', 'mkep-cell');
            const code = placeholder.replace(/\{alias\}/gi, String(alias));
            const button = el(doc, 'button', 'mkep-item', {
                type: 'button',
                'data-mkep-code': code,
                'data-mkep-index': String(order),
                title: String(alias)
            });
            const img = el(doc, 'img', '', {
                src: BLANK_IMG,
                'data-src': path + fileKey + file,
                alt: '',
                loading: 'lazy',
                decoding: 'async'
            });
            button.appendChild(img);
            li.appendChild(button);
            ul.appendChild(li);
        };

        if (emoji) {
            let order = 0;
            for (const alias of Object.keys(emoji)) {
                order++;
                if ((maxNum && order > maxNum) || excludeNums.includes(order)) continue;
                addItem(alias, emoji[alias], order);
            }
        } else {
            for (let n = 1; n <= maxNum; n++) {
                if (excludeNums.includes(n)) continue;
                addItem(n, n, n);
            }
        }

        panel.appendChild(ul);
        this.content.appendChild(panel);
        this.groups.push(panel);
    }

    _on(target, type, handler) {
        target.addEventListener(type, handler);
        this._listeners.push([target, type, handler]);
    }

    _bind() {
        this._on(this.button, 'click', event => {
            event.preventDefault();
            this._position();
            this.toggle();
        });
        this._on(this.panel, 'click', event => this._onPanelClick(event));
        this._on(this.doc, 'click', event => {
            if (this.isOpen && !this.panel.contains(event.target) &&
                !this.button.contains(event.target)) {
                this.hide();
            }
        });
        this._on(this.doc, 'keydown', event => {
            if (event.key === 'Escape' && this.isOpen) this.hide();
        });
        this._on(this.content, 'scroll', () => this._scheduleLoad());
        this._on(this.win, 'scroll', () => this._scheduleLoad());
        this._on(this.win, 'resize', () => this._scheduleLoad());
        this._on(this.content, 'pointerover', event => this._onPointerOver(event));
        this._on(this.content, 'pointerout', event => this._onPointerOut(event));
    }

    _position() {
        const box = offset(this.button);
        this.panel.style.top = (box.top + box.height + 5) + 'px';
        this.panel.style.left = box.left + 'px';
    }

    static _eventItem(event) {
        const node = event.target && event.target.nodeType === 1
            ? event.target
            : event.target && event.target.parentElement;
        return node && typeof node.closest === 'function' ? node : null;
    }

    _onPanelClick(event) {
        const node = EmojiPicker._eventItem(event);
        if (!node) return;
        const item = node.closest('.mkep-item');
        if (item && this.panel.contains(item)) {
            this._select(item);
            return;
        }
        const tab = node.closest('.mkep-tab');
        if (tab && this.panel.contains(tab)) {
            this._activate(Number(tab.getAttribute('data-mkep-group')));
        }
    }

    _onPointerOver(event) {
        const node = EmojiPicker._eventItem(event);
        const item = node && node.closest('.mkep-item');
        if (!item || !this.content.contains(item)) return;
        const src = loadImage(item.querySelector('img'));
        if (!src) return;
        this.previewImg.setAttribute('src', src);
        const itemBox = item.getBoundingClientRect();
        const panelBox = this.panel.getBoundingClientRect();
        this.preview.classList.toggle('is-flipped',
            panelBox.width > 0 && itemBox.left - panelBox.left > panelBox.width / 2);
        this.preview.removeAttribute('hidden');
    }

    _onPointerOut(event) {
        const node = EmojiPicker._eventItem(event);
        const item = node && node.closest('.mkep-item');
        if (!item || !this.content.contains(item)) return;
        const next = event.relatedTarget;
        if (next && item.contains(next)) return;
        this.preview.setAttribute('hidden', '');
        this.previewImg.removeAttribute('src');
    }

    _select(item) {
        const code = item.getAttribute('data-mkep-code') || '';
        const src = loadImage(item.querySelector('img'));
        if (this.field.nodeName === 'DIV' || this.field.isContentEditable) {
            insertAtCursor(this.field, el(this.doc, 'img', 'mkep-icon', { src, alt: code }));
        } else {
            insertAtCursor(this.field, code);
        }
        this.hide();
        this.field.focus();
        if (typeof this.options.onSelect === 'function') this.options.onSelect(code, src);
    }

    _activate(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.groups.length) return;
        this.groups.forEach((group, i) => {
            if (i === index) group.removeAttribute('hidden');
            else group.setAttribute('hidden', '');
        });
        this.tabButtons.forEach((tab, i) => {
            const selected = i === index;
            tab.classList.toggle('is-selected', selected);
            tab.setAttribute('aria-selected', selected ? 'true' : 'false');
            tab.tabIndex = selected ? 0 : -1;
        });
        this.content.scrollTop = 0;
        this.loadVisible();
    }

    _scheduleLoad() {
        this.win.clearTimeout(this._loadTimer);
        this._loadTimer = this.win.setTimeout(() => this.loadVisible(), 50);
    }

    /** 只加载当前分组中落在可视区域（含缓冲）内的图片，返回本次加载数量。 */
    loadVisible() {
        if (this.destroyed || !isVisible(this.panel, this.doc)) return 0;
        const view = this.win;
        const viewH = view.innerHeight || this.doc.documentElement.clientHeight || 0;
        const viewW = view.innerWidth || this.doc.documentElement.clientWidth || 0;
        const box = this.content.getBoundingClientRect();
        const top = Math.max(box.top, 0) - LOAD_BUFFER;
        const bottom = Math.min(box.bottom, viewH) + LOAD_BUFFER;
        const left = Math.max(box.left, 0) - LOAD_BUFFER;
        const right = Math.min(box.right, viewW) + LOAD_BUFFER;
        if (top >= bottom || left >= right) return 0;

        const active = this.groups.find(group => !group.hasAttribute('hidden'));
        if (!active) return 0;
        let loaded = 0;
        for (const img of Array.from(active.querySelectorAll('img[data-src]'))) {
            const rect = img.getBoundingClientRect();
            if (rect.bottom >= top && rect.top <= bottom &&
                rect.right >= left && rect.left <= right) {
                loadImage(img);
                loaded++;
            }
        }
        return loaded;
    }

    _motion() {
        if (this.animation === 'none' || prefersReducedMotion(this.win)) return 0;
        return MOTION_MS;
    }

    // CSS transition 的时长由 --mkep-duration 与 MOTION_MS 约定；
    // 用定时器而非 transitionend，可在 jsdom / 无动画环境下稳定完成回调。
    _wait(ms) {
        if (!ms) return Promise.resolve();
        return new Promise(resolve => this.win.setTimeout(resolve, ms));
    }

    async show() {
        if (this.destroyed || this.isOpen) return this;
        if (!this.panel.style.top || !this.panel.style.left) this._position();
        this.isOpen = true;
        this.panel.removeAttribute('hidden');
        const duration = this._motion();
        if (duration) void this.panel.getBoundingClientRect(); // 强制样式计算，让过渡生效
        this.panel.classList.add('is-open');
        await this._wait(duration);
        if (this.destroyed) return this;
        this.loadVisible();
        if (typeof this.options.onShow === 'function') this.options.onShow(this);
        return this;
    }

    async hide() {
        if (this.destroyed || !this.isOpen) return this;
        this.isOpen = false;
        this.panel.classList.remove('is-open');
        this.preview.setAttribute('hidden', '');
        await this._wait(this._motion());
        if (!this.destroyed && !this.isOpen) this.panel.setAttribute('hidden', '');
        if (typeof this.options.onHide === 'function') this.options.onHide(this);
        return this;
    }

    toggle() {
        return this.isOpen ? this.hide() : this.show();
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.isOpen = false;
        for (const [target, type, handler] of this._listeners) {
            target.removeEventListener(type, handler);
        }
        this._listeners.length = 0;
        this.win.clearTimeout(this._loadTimer);
        this.panel.remove();
        if (this.ownsButton) this.button.remove();
        instances.delete(this.field);
    }
}

/** 创建面板；同一目标重复调用会复用实例，避免重复生成 DOM。 */
export function create(target, options = {}) {
    const doc = ownerDoc(target, options);
    if (!doc) throw new Error('[mk-emoji-picker] create 需要 document 环境');
    const field = resolveElement(target, doc);
    if (!field) throw new TypeError('[mk-emoji-picker] 找不到目标元素: ' + String(target));
    const existing = instances.get(field);
    if (existing && !existing.destroyed) return existing;
    return new EmojiPicker(field, options);
}
