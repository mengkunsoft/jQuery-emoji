# mk-emoji-picker

[![CI](https://github.com/mengkunsoft/mk-emoji-picker/actions/workflows/ci.yml/badge.svg)](https://github.com/mengkunsoft/mk-emoji-picker/actions/workflows/ci.yml)

零依赖的表情选择面板：给 `textarea` 或 `contenteditable` 元素插入自定义表情，并把文本里的表情代码转换成表情图片。

A zero-dependency custom emoji picker for `textarea` and `contenteditable`, with emoticon-code parsing. No jQuery, no framework, no network requests.

> v2 起改名为 **mk-emoji-picker**，全面重写为原生 JavaScript，与 v1（jQuery-emoji）的 API 不兼容。迁移见文末。

## 预览

打开仓库里的 `index.html` 即可体验。

## 特性

- **零运行时依赖**：纯原生 DOM / ESM，不再需要 jQuery 或任何第三方库。
- **自动识别输入区**：`textarea` 插入表情代码，`contenteditable` 直接插入图片。
- **表情代码转图片**：只处理正文文本节点，不误伤属性、脚本、样式、代码块与表单。
- **多分组 Tab**：分组名称、路径、代码占位符、文件后缀均可配置。
- **按需加载**：只请求进入可视区域（含缓冲）的图片，跟随滚动、缩放与分组切换。
- **多实例与显式销毁**：同一元素复用实例，`destroy()` 一次性解绑所有事件。
- **现代化样式与无障碍**：`--mkep-*` CSS 变量、深色模式、`prefers-reduced-motion`、`:focus-visible`、语义化 `button` / `role="dialog"` / `role="tablist"`、Esc 关闭。
- **三种模块格式**：IIFE（浏览器全局）、ESM、CJS；`dist/` 由 esbuild 自动构建。

## 安装

```bash
npm install mk-emoji-picker
```

或直接引用构建产物：

```html
<link rel="stylesheet" href="dist/mk-emoji-picker.css">
<script src="dist/mk-emoji-picker.js"></script>
<script src="dist/emoji-list.js"></script>
```

CDN（发布后可用）：

```html
<link rel="stylesheet" href="https://unpkg.com/mk-emoji-picker/dist/mk-emoji-picker.css">
<script src="https://unpkg.com/mk-emoji-picker/dist/mk-emoji-picker.js"></script>
```

> 内置表情图片位于仓库的 `images/emoji/`（510 张），不在 npm 包内。使用时把该目录部署到站点，并通过 `basePath` 指向它。

## 快速开始

### ESM / 打包器

```js
import { create, parse } from 'mk-emoji-picker';
import { emojiLists } from 'mk-emoji-picker/emoji-list';
import 'mk-emoji-picker/style.css';

const picker = create('#content', {
    button: '#emojiButton',
    basePath: '/images/emoji',
    icons: emojiLists,
    onSelect: (code, src) => console.log(code, src)
});

parse('#comment', { basePath: '/images/emoji', icons: emojiLists });
```

### 浏览器全局（IIFE）

```js
const picker = MkEmojiPicker.create('#editor', {
    button: '#btn',
    animation: 'slide',
    basePath: 'images/emoji',
    icons: window.mkEmojiLists
});

MkEmojiPicker.parse('#sourceText', {
    basePath: 'images/emoji',
    icons: window.mkEmojiLists
});
```

### CommonJS

```js
const { create, parse } = require('mk-emoji-picker');
const { emojiLists } = require('mk-emoji-picker/emoji-list');
```

## API

### `create(target, options) → EmojiPicker`

`target` 是元素或 CSS 选择器，`options` 见下表。同一目标重复调用会复用已有实例。

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `button` | `Element \| string \| null` | `null` | 触发按钮；不传则自动创建一个按钮。 |
| `container` | `Element \| string \| null` | `document.body` | 面板与自动按钮挂载的容器。 |
| `showTab` | `boolean` | `true` | 只有一组表情时是否仍显示 Tab。 |
| `animation` | `'fade' \| 'slide' \| 'none'` | `'fade'` | 面板动画；系统开启「减少动态效果」时自动禁用。 |
| `basePath` | `string` | `''` | 表情图片根路径。 |
| `icons` | `Array` | `[]` | **必填**，表情分组配置。 |
| `onSelect` | `(code, src) => void` | `null` | 选中表情后回调。 |
| `onShow` / `onHide` | `(picker) => void` | `null` | 面板显示 / 隐藏后回调。 |

`icons[]` 每组字段：

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `name` | `string` | `group(n)` | Tab 名称。 |
| `path` | `string` | — | **必填**，相对 `basePath` 的子目录，如 `'qq/'`。 |
| `placeholder` | `string` | `#em(n)_{alias}#` | 插入文本框的代码模板，必须含 `{alias}`。 |
| `emoji` | `Object` | — | `{ "显示名": "文件名" }`；配置后 `{alias}` 只匹配这些名字。 |
| `maxNum` | `number` | — | 未配置 `emoji` 时**必填**，按数字文件名生成。 |
| `excludeNums` | `number[]` | `[]` | 要跳过的序号。 |
| `file` | `string` | `'.jpg'` | 图片后缀。 |

### 实例方法

| 方法 | 返回值 | 说明 |
| --- | --- | --- |
| `show()` / `hide()` / `toggle()` | `Promise<EmojiPicker>` | 动画结束后 resolve，并触发可视区域图片加载。 |
| `loadVisible()` | `number` | 立即加载可视区域图片，返回本次加载数量。 |
| `destroy()` | `void` | 移除面板与自动按钮、解绑全部事件。 |

实例属性：`element`（输入区）、`panel`、`button`、`isOpen`、`destroyed`、`id`。

### `parse(target, options) → Element`

把元素内的表情代码替换为 `<img class="mkep-smiley wp-smiley">`，返回该元素。默认每个元素只解析一次（打 `data-mkep-parsed` 标记）；`options.force = true` 可强制重解析。`options` 支持 `basePath`、`icons`，以及内部测试用的 `document`。

`wp-smiley` 作为兼容钩子保留，方便沿用旧样式。

## 主题定制

所有外观通过 CSS 变量控制，可直接覆盖：

```css
.mkep-panel {
    --mkep-bg: #1c2331;
    --mkep-fg: #e8ecf4;
    --mkep-border: #333d50;
    --mkep-accent: #7c74f2;
    --mkep-cell: 48px;
    --mkep-radius: 16px;
    --mkep-duration: 120ms;
}
```

无 `data-theme` 时自动跟随 `prefers-color-scheme`；宿主页面设置 `:root[data-theme="dark"]` / `"light"` 时以页面为准。完整变量见 `src/css/mk-emoji-picker.css`。

## 开发与构建

```bash
npm ci          # 安装 esbuild / eslint / jsdom
npm run build   # 清理并重建 dist/（IIFE / ESM / CJS / CSS + sourcemap）
npm test        # node:test（jsdom 单元 + 无头浏览器布局冒烟）
npm run lint    # ESLint 9 flat config
npm run check   # lint + test + build
```

`dist/` 由 `scripts/build.mjs` 生成并提交到仓库：文档页与探针直接引用它，CI 会用 `git diff --exit-code -- dist` 校验源码与产物同步。浏览器探针需要本机 Chrome/Edge，也可用 `BROWSER_PATH` 指定；找不到浏览器时相关用例自动跳过。

## 发布流程

在 GitHub 上发布 Release（`published`）会自动触发 `.github/workflows/release.yml`：

1. `npm ci` → lint → test → build；
2. 把 `dist/` 打包为 `mk-emoji-picker-dist.zip`；
3. 把全部 `dist` 文件与 zip 上传到该 Release 的 Assets；
4. 若仓库配置了 `NPM_TOKEN` secret，同时执行 `npm publish`。

也可在 Actions 页手动 `workflow_dispatch` 触发，产物会作为 workflow artifact 保存。每次 push / PR 由 `ci.yml` 在 Node 20 / 22 上跑完整校验。

## 从 v1（jQuery-emoji）迁移

| v1 | v2 |
| --- | --- |
| `$('#content').emoji(options)` | `MkEmojiPicker.create('#content', options)` |
| `$('#text').emojiParse(options)` | `MkEmojiPicker.parse('#text', options)` |
| `$('#editor').emoji('show' / 'hide' / 'toggle')` | `picker.show()` / `hide()` / `toggle()` |
| `$.fn.emoji.Constructor` | `MkEmojiPicker.EmojiPicker` |
| 全局 `emojiLists` | `window.mkEmojiLists`（或 `import { emojiLists }`） |
| `jquery.emoji.js` / `jquery.emoji.css` | `mk-emoji-picker.js` / `mk-emoji-picker.css` |
| `.emoji_container`、`.emoji_content`、`.emoji_icons`、`.emoji_tab*`、`.emoji_preview`、`.emoji_btn` | `.mkep-panel`、`.mkep-content`、`.mkep-group`、`.mkep-tab*`、`.mkep-preview`、`.mkep-btn` |
| DOM id `emoji_container_N` | `mkep-panel-N`（另有 `data-mkep-panel`） |
| 依赖 `jQuery 2.x` + mCustomScrollbar | 无运行时依赖 |
| 无销毁接口，document 上重复绑定 | `picker.destroy()` 完整解绑 |
| 事件 `mouseenter` / `scroll.emoji*` | `pointerover` / 普通 `scroll`，随实例销毁 |

配置项 `button` / `showTab` / `animation` / `basePath` / `icons` 及 `icons[]` 的字段保持兼容；`animation` 现在还支持 `'none'`。旧的 `flag` / `prefix` 早已在 v1.1 移除。

## 浏览器支持

支持原生 ESM、CSS 自定义属性、CSS Grid 与 `Element.closest` 的现代浏览器（Chrome / Edge / Firefox / Safari 最近两个主要版本）。

## 许可

MIT © Sky / Mengkun，基于 [eshengsky/jQuery-emoji](https://github.com/eshengsky/jQuery-emoji) 修改而来。详见 `LICENSE`。
