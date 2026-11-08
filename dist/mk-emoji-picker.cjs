/*! mk-emoji-picker v2.0.0 | MIT License | (c) Sky, Mengkun */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/js/index.js
var index_exports = {};
__export(index_exports, {
  EmojiPicker: () => EmojiPicker,
  create: () => create,
  default: () => index_default,
  parse: () => parse,
  version: () => version
});
module.exports = __toCommonJS(index_exports);

// src/js/dom.js
var BLANK_IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
function ownerDoc(target, options) {
  if (options && options.document) return options.document;
  if (target && target.nodeType === 1) return target.ownerDocument;
  return globalThis.document;
}
function resolveElement(target, doc) {
  if (typeof target === "string") return doc.querySelector(target);
  return target && target.nodeType === 1 ? target : null;
}
function el(doc, tag, className, attrs) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (attrs) {
    for (const key of Object.keys(attrs)) {
      const value = attrs[key];
      if (value === null || value === void 0 || value === false) continue;
      if (key === "text") node.textContent = String(value);
      else node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  return node;
}
function isVisible(node, doc) {
  const view = doc.defaultView;
  for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
    if (n.hidden || n.hasAttribute("hidden")) return false;
    if (n.style && (n.style.display === "none" || n.style.visibility === "hidden")) {
      return false;
    }
    if (view && typeof view.getComputedStyle === "function") {
      const style = view.getComputedStyle(n);
      if (style && (style.display === "none" || style.visibility === "hidden")) {
        return false;
      }
    }
  }
  return true;
}
function offset(node) {
  const rect = node.getBoundingClientRect();
  const view = node.ownerDocument.defaultView;
  return {
    top: rect.top + (view ? view.scrollY || view.pageYOffset || 0 : 0),
    left: rect.left + (view ? view.scrollX || view.pageXOffset || 0 : 0),
    width: rect.width,
    height: rect.height
  };
}
function loadImage(img) {
  if (!img) return "";
  const src = img.getAttribute("data-src");
  if (src) {
    img.setAttribute("src", src);
    img.removeAttribute("data-src");
  }
  return img.getAttribute("src") || "";
}
function joinPath(basePath, groupPath) {
  if (!basePath) return groupPath;
  return basePath.replace(/\/+$/, "") + "/" + groupPath.replace(/^\/+/, "");
}
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function prefersReducedMotion(view) {
  return !!(view && typeof view.matchMedia === "function" && view.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function insertAtCursor(field, value) {
  const doc = field.ownerDocument;
  const view = doc.defaultView;
  if (field.nodeName === "DIV" || field.isContentEditable) {
    field.focus();
    const selection = view && view.getSelection && view.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = typeof value === "string" ? doc.createTextNode(value) : value;
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
  if (typeof start === "number" && typeof end === "number") {
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

// src/js/picker.js
var DEFAULTS = {
  button: null,
  container: null,
  showTab: true,
  animation: "fade",
  basePath: "",
  icons: [],
  onSelect: null,
  onShow: null,
  onHide: null
};
var MOTION_MS = 180;
var LOAD_BUFFER = 100;
var instances = /* @__PURE__ */ new WeakMap();
var nextId = 0;
var EmojiPicker = class _EmojiPicker {
  constructor(target, options = {}) {
    const doc = ownerDoc(target, options);
    if (!doc) throw new Error("[mk-emoji-picker] create \u9700\u8981 document \u73AF\u5883");
    const field = resolveElement(target, doc);
    if (!field) throw new TypeError("[mk-emoji-picker] \u627E\u4E0D\u5230\u76EE\u6807\u5143\u7D20: " + String(target));
    if (!Array.isArray(options.icons) || !options.icons.length) {
      throw new TypeError("[mk-emoji-picker] options.icons \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4");
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
    return value === "none" || value === "slide" ? value : "fade";
  }
  _build() {
    const o = this.options;
    const doc = this.doc;
    if (o.button) {
      this.button = resolveElement(o.button, doc);
      if (!this.button) throw new TypeError("[mk-emoji-picker] \u627E\u4E0D\u5230 button: " + String(o.button));
    } else {
      this.button = el(doc, "button", "mkep-btn", {
        type: "button",
        title: "\u8868\u60C5",
        "aria-label": "\u6253\u5F00\u8868\u60C5\u9762\u677F",
        text: ":)"
      });
      this.container.appendChild(this.button);
      this.ownsButton = true;
      const box = offset(this.field);
      this.button.style.top = box.top + box.height + 10 + "px";
      this.button.style.left = box.left + 2 + "px";
    }
    this.panel = el(doc, "div", "mkep-panel", {
      id: "mkep-panel-" + this.id,
      "data-mkep-panel": String(this.id),
      role: "dialog",
      "aria-label": "\u8868\u60C5\u9762\u677F",
      hidden: true
    });
    this.panel.dataset.animation = this.animation;
    this.content = el(doc, "div", "mkep-content");
    this.panel.appendChild(this.content);
    this._groupMeta = o.icons.filter((group, i) => this._validateGroup(group, i));
    if (!this._groupMeta.length) {
      if (this.ownsButton) this.button.remove();
      throw new TypeError("[mk-emoji-picker] options.icons \u4E2D\u6CA1\u6709\u53EF\u7528\u7684\u8868\u60C5\u5206\u7EC4");
    }
    this._groupMeta.forEach((group, i) => this._buildGroup(group, i));
    this.tabs = el(doc, "div", "mkep-tabs", {
      role: "tablist",
      "aria-label": "\u8868\u60C5\u5206\u7EC4"
    });
    if (this._groupMeta.length === 1 && !o.showTab) this.tabs.setAttribute("hidden", "");
    const list = el(doc, "div", "mkep-tabs__list");
    const ul = el(doc, "ul", "mkep-tabs__items");
    this._groupMeta.forEach((group, i) => {
      const li = el(doc, "li", "mkep-tabs__item");
      const tab = el(doc, "button", "mkep-tab", {
        type: "button",
        role: "tab",
        "aria-selected": i === 0 ? "true" : "false",
        "data-mkep-group": String(i),
        title: group.name || "group" + (i + 1),
        text: group.name || "group" + (i + 1)
      });
      if (i === 0) tab.classList.add("is-selected");
      else tab.tabIndex = -1;
      li.appendChild(tab);
      ul.appendChild(li);
      this.tabButtons.push(tab);
    });
    list.appendChild(ul);
    this.tabs.appendChild(list);
    this.panel.appendChild(this.tabs);
    this.preview = el(doc, "div", "mkep-preview", { hidden: true, "aria-hidden": "true" });
    this.previewImg = el(doc, "img", "", { alt: "" });
    this.preview.appendChild(this.previewImg);
    this.panel.appendChild(this.preview);
    this.container.appendChild(this.panel);
  }
  _validateGroup(group, index) {
    if (typeof group.path !== "string" || !group.path) {
      console.error("[mk-emoji-picker] \u7B2C " + index + " \u7EC4\u8868\u60C5\u672A\u914D\u7F6E path");
      return false;
    }
    if (!group.emoji && !Number(group.maxNum)) {
      console.error("[mk-emoji-picker] \u7B2C " + index + " \u7EC4\u9700\u8981 maxNum \u6216 emoji");
      return false;
    }
    return true;
  }
  _buildGroup(group, index) {
    const o = this.options;
    const doc = this.doc;
    const placeholder = group.placeholder || "#em" + (index + 1) + "_{alias}#";
    const file = group.file || ".jpg";
    const path = joinPath(o.basePath, group.path);
    const maxNum = Number(group.maxNum) || 0;
    const excludeNums = Array.isArray(group.excludeNums) ? group.excludeNums : [];
    const emoji = group.emoji && typeof group.emoji === "object" ? group.emoji : null;
    const panel = el(doc, "div", "mkep-group", {
      id: "mkep-group-" + this.id + "-" + index,
      "data-mkep-group": String(index),
      role: "tabpanel"
    });
    if (index !== 0) panel.setAttribute("hidden", "");
    const ul = el(doc, "ul", "mkep-grid");
    const addItem = (alias, fileKey, order) => {
      const li = el(doc, "li", "mkep-cell");
      const code = placeholder.replace(/\{alias\}/gi, String(alias));
      const button = el(doc, "button", "mkep-item", {
        type: "button",
        "data-mkep-code": code,
        "data-mkep-index": String(order),
        title: String(alias)
      });
      const img = el(doc, "img", "", {
        src: BLANK_IMG,
        "data-src": path + fileKey + file,
        alt: "",
        loading: "lazy",
        decoding: "async"
      });
      button.appendChild(img);
      li.appendChild(button);
      ul.appendChild(li);
    };
    if (emoji) {
      let order = 0;
      for (const alias of Object.keys(emoji)) {
        order++;
        if (maxNum && order > maxNum || excludeNums.includes(order)) continue;
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
    this._on(this.button, "click", (event) => {
      event.preventDefault();
      this._position();
      this.toggle();
    });
    this._on(this.panel, "click", (event) => this._onPanelClick(event));
    this._on(this.doc, "click", (event) => {
      if (this.isOpen && !this.panel.contains(event.target) && !this.button.contains(event.target)) {
        this.hide();
      }
    });
    this._on(this.doc, "keydown", (event) => {
      if (event.key === "Escape" && this.isOpen) this.hide();
    });
    this._on(this.content, "scroll", () => this._scheduleLoad());
    this._on(this.win, "scroll", () => this._scheduleLoad());
    this._on(this.win, "resize", () => this._scheduleLoad());
    this._on(this.content, "pointerover", (event) => this._onPointerOver(event));
    this._on(this.content, "pointerout", (event) => this._onPointerOut(event));
  }
  _position() {
    const box = offset(this.button);
    this.panel.style.top = box.top + box.height + 5 + "px";
    this.panel.style.left = box.left + "px";
  }
  static _eventItem(event) {
    const node = event.target && event.target.nodeType === 1 ? event.target : event.target && event.target.parentElement;
    return node && typeof node.closest === "function" ? node : null;
  }
  _onPanelClick(event) {
    const node = _EmojiPicker._eventItem(event);
    if (!node) return;
    const item = node.closest(".mkep-item");
    if (item && this.panel.contains(item)) {
      this._select(item);
      return;
    }
    const tab = node.closest(".mkep-tab");
    if (tab && this.panel.contains(tab)) {
      this._activate(Number(tab.getAttribute("data-mkep-group")));
    }
  }
  _onPointerOver(event) {
    const node = _EmojiPicker._eventItem(event);
    const item = node && node.closest(".mkep-item");
    if (!item || !this.content.contains(item)) return;
    const src = loadImage(item.querySelector("img"));
    if (!src) return;
    this.previewImg.setAttribute("src", src);
    const itemBox = item.getBoundingClientRect();
    const panelBox = this.panel.getBoundingClientRect();
    this.preview.classList.toggle(
      "is-flipped",
      panelBox.width > 0 && itemBox.left - panelBox.left > panelBox.width / 2
    );
    this.preview.removeAttribute("hidden");
  }
  _onPointerOut(event) {
    const node = _EmojiPicker._eventItem(event);
    const item = node && node.closest(".mkep-item");
    if (!item || !this.content.contains(item)) return;
    const next = event.relatedTarget;
    if (next && item.contains(next)) return;
    this.preview.setAttribute("hidden", "");
    this.previewImg.removeAttribute("src");
  }
  _select(item) {
    const code = item.getAttribute("data-mkep-code") || "";
    const src = loadImage(item.querySelector("img"));
    if (this.field.nodeName === "DIV" || this.field.isContentEditable) {
      insertAtCursor(this.field, el(this.doc, "img", "mkep-icon", { src, alt: code }));
    } else {
      insertAtCursor(this.field, code);
    }
    this.hide();
    this.field.focus();
    if (typeof this.options.onSelect === "function") this.options.onSelect(code, src);
  }
  _activate(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.groups.length) return;
    this.groups.forEach((group, i) => {
      if (i === index) group.removeAttribute("hidden");
      else group.setAttribute("hidden", "");
    });
    this.tabButtons.forEach((tab, i) => {
      const selected = i === index;
      tab.classList.toggle("is-selected", selected);
      tab.setAttribute("aria-selected", selected ? "true" : "false");
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
    const active = this.groups.find((group) => !group.hasAttribute("hidden"));
    if (!active) return 0;
    let loaded = 0;
    for (const img of Array.from(active.querySelectorAll("img[data-src]"))) {
      const rect = img.getBoundingClientRect();
      if (rect.bottom >= top && rect.top <= bottom && rect.right >= left && rect.left <= right) {
        loadImage(img);
        loaded++;
      }
    }
    return loaded;
  }
  _motion() {
    if (this.animation === "none" || prefersReducedMotion(this.win)) return 0;
    return MOTION_MS;
  }
  // CSS transition 的时长由 --mkep-duration 与 MOTION_MS 约定；
  // 用定时器而非 transitionend，可在 jsdom / 无动画环境下稳定完成回调。
  _wait(ms) {
    if (!ms) return Promise.resolve();
    return new Promise((resolve) => this.win.setTimeout(resolve, ms));
  }
  async show() {
    if (this.destroyed || this.isOpen) return this;
    if (!this.panel.style.top || !this.panel.style.left) this._position();
    this.isOpen = true;
    this.panel.removeAttribute("hidden");
    const duration = this._motion();
    if (duration) void this.panel.getBoundingClientRect();
    this.panel.classList.add("is-open");
    await this._wait(duration);
    if (this.destroyed) return this;
    this.loadVisible();
    if (typeof this.options.onShow === "function") this.options.onShow(this);
    return this;
  }
  async hide() {
    if (this.destroyed || !this.isOpen) return this;
    this.isOpen = false;
    this.panel.classList.remove("is-open");
    this.preview.setAttribute("hidden", "");
    await this._wait(this._motion());
    if (!this.destroyed && !this.isOpen) this.panel.setAttribute("hidden", "");
    if (typeof this.options.onHide === "function") this.options.onHide(this);
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
};
function create(target, options = {}) {
  const doc = ownerDoc(target, options);
  if (!doc) throw new Error("[mk-emoji-picker] create \u9700\u8981 document \u73AF\u5883");
  const field = resolveElement(target, doc);
  if (!field) throw new TypeError("[mk-emoji-picker] \u627E\u4E0D\u5230\u76EE\u6807\u5143\u7D20: " + String(target));
  const existing = instances.get(field);
  if (existing && !existing.destroyed) return existing;
  return new EmojiPicker(field, options);
}

// src/js/parse.js
var ALIAS_RE = /\{alias\}/i;
var PARSED_ATTR = "data-mkep-parsed";
var SKIP_TAGS = /* @__PURE__ */ new Set([
  "script",
  "style",
  "noscript",
  "iframe",
  "textarea",
  "select",
  "title",
  "pre",
  "code"
]);
function buildRule(group, basePath, index) {
  const groupPath = group.path;
  if (typeof groupPath !== "string" || !groupPath) {
    console.error("[mk-emoji-picker] \u7B2C " + index + " \u7EC4\u8868\u60C5\u672A\u914D\u7F6E path");
    return null;
  }
  const placeholder = group.placeholder;
  if (typeof placeholder !== "string" || !ALIAS_RE.test(placeholder)) {
    console.error("[mk-emoji-picker] \u7B2C " + index + " \u7EC4\u8868\u60C5\u672A\u914D\u7F6E\u542B {alias} \u7684 placeholder");
    return null;
  }
  const emoji = group.emoji || null;
  if (emoji && typeof emoji !== "object") {
    console.error("[mk-emoji-picker] \u7B2C " + index + " \u7EC4 emoji \u53C2\u6570\u4E0D\u6B63\u786E");
    return null;
  }
  let aliasSource;
  let resolve;
  let named = false;
  if (emoji) {
    const names = Object.keys(emoji).filter(
      (key) => Object.prototype.hasOwnProperty.call(emoji, key) && typeof emoji[key] === "string" && emoji[key]
    );
    names.sort((a, b) => b.length - a.length);
    if (!names.length) return null;
    aliasSource = "(?:" + names.map(escapeRegExp).join("|") + ")";
    resolve = (alias) => emoji[alias];
    named = true;
  } else {
    aliasSource = "\\d+";
    resolve = (alias) => alias;
  }
  const literals = placeholder.split(ALIAS_RE);
  let source = "";
  for (let p = 0; p < literals.length; p++) {
    source += escapeRegExp(literals[p]);
    if (p < literals.length - 1) source += "(" + aliasSource + ")";
  }
  return {
    order: index,
    regexp: new RegExp(source, "g"),
    aliasCount: literals.length - 1,
    named,
    resolve,
    path: joinPath(basePath, groupPath),
    file: group.file || ".jpg"
  };
}
function normalizeClasses(value) {
  const list = Array.isArray(value) ? value : [value];
  const classes = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
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
      let alias = "";
      for (let g = 1; g <= rule.aliasCount; g++) {
        if (match[g] !== void 0) {
          alias = match[g];
          break;
        }
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
  hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.rule.order - b.rule.order);
  const frag = doc.createDocumentFragment();
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start < cursor) continue;
    if (hit.start > cursor) {
      frag.appendChild(doc.createTextNode(text.slice(cursor, hit.start)));
    }
    const img = el(doc, "img", "mkep-smiley", {
      src: hit.rule.path + hit.file + hit.rule.file,
      alt: hit.rule.named ? hit.alias : "",
      loading: "lazy",
      decoding: "async"
    });
    if (hit.rule.named) img.setAttribute("title", hit.alias);
    if (classNames.length) img.classList.add(...classNames);
    frag.appendChild(img);
    cursor = hit.end;
  }
  if (cursor < text.length) {
    frag.appendChild(doc.createTextNode(text.slice(cursor)));
  }
  node.parentNode.replaceChild(frag, node);
}
function parse(target, options = {}) {
  const doc = ownerDoc(target, options);
  if (!doc) throw new Error("[mk-emoji-picker] parse \u9700\u8981 document \u73AF\u5883");
  const root = resolveElement(target, doc);
  if (!root) throw new TypeError("[mk-emoji-picker] parse \u627E\u4E0D\u5230\u76EE\u6807\u5143\u7D20: " + String(target));
  if (!options.force && root.getAttribute(PARSED_ATTR) === "1") return root;
  const groups = Array.isArray(options.icons) ? options.icons : [];
  const basePath = typeof options.basePath === "string" ? options.basePath : "";
  const rules = groups.map((group, i) => buildRule(group, basePath, i)).filter(Boolean);
  if (!rules.length) return root;
  const classNames = normalizeClasses(options.className);
  const nodes = [];
  collectTextNodes(root, nodes);
  for (const node of nodes) replaceInTextNode(node, rules, doc, classNames);
  root.setAttribute(PARSED_ATTR, "1");
  return root;
}

// src/js/index.js
var version = "2.0.0";
var index_default = { create, parse, version, EmojiPicker };
