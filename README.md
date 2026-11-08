# mk-emoji-picker

[![CI](https://github.com/mengkunsoft/mk-emoji-picker/actions/workflows/ci.yml/badge.svg)](https://github.com/mengkunsoft/mk-emoji-picker/actions/workflows/ci.yml)

零依赖的表情选择面板：给 `textarea` 或 `contenteditable` 元素插入自定义表情，并把文本里的表情代码转换成表情图片。

A zero-dependency custom emoji picker for `textarea` and `contenteditable`, with emoticon-code parsing. No jQuery, no framework, no network requests.

![预览图](https://github.com/user-attachments/assets/13ff8d17-a56b-422d-90a2-319059f8a5d4)

> v2 起改名为 **mk-emoji-picker**，全面重写为原生 JavaScript，与 v1（jQuery-emoji）的 API 不兼容。迁移见文末。

## 预览

在线预览：https://mengkunsoft.github.io/mk-emoji-picker/

也可以直接打开仓库里的 `index.html` 体验。

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

把元素内的表情代码替换为 `<img class="mkep-smiley">`，返回该元素。默认每个元素只解析一次（打 `data-mkep-parsed` 标记）；`options.force = true` 可强制重解析。

`options` 支持 `basePath`、`icons`、`className`、`force`，以及内部测试用的 `document`。`className` 会追加到生成的图片上，支持空格分隔的字符串或字符串数组，自动忽略空值与非字符串、并去重：

```js
parse('#comment', {
    basePath: '/images/emoji',
    icons: emojiLists,
    className: 'comment-emoji rounded'   // 也可传 ['comment-emoji', 'rounded']
});
```

> v2 起不再生成 `wp-smiley` 兼容类；需要沿用旧样式时，把 `className: 'wp-smiley'` 传给 `parse()` 即可。

## 后端解析（PHP / Java）

服务端渲染时可直接把数据库里的表情代码转换成 `<img>`，不必让前端再解析一次。三端共用同一份配置：`npm run build` 从 `src/js/emoji-list.js` 生成 `dist/emoji-list.json`（含 `name` / `version` / `groups`），该文件随 npm 包一起发布。

| 文件 | 运行环境 | 第三方依赖 |
| --- | --- | --- |
| `server/php/EmojiParser.php` | PHP 7.4+ | 无（仅内置 json / pcre） |
| `server/java/EmojiParser.java` | Java 8+ | 无（内置精简 JSON 读取器） |

两个解析器和 `dist/emoji-list.json` 都随 npm 包发布，安装后位于 `node_modules/mk-emoji-picker/server/`，可直接复制到服务端项目中。

PHP：

```php
use MkEmojiPicker\EmojiParser;
require __DIR__ . '/EmojiParser.php';   // 把 server/php/EmojiParser.php 复制到项目中

$parser = EmojiParser::fromJsonFile(__DIR__ . '/dist/emoji-list.json', [
    'basePath' => '/images/emoji',
    'className' => 'comment-emoji'
]);
echo $parser->parse($row['content']);
```

Java（`EmojiParser` 使用默认包，可按需加 `package` 声明）：

```java
Map<String, Object> options = new HashMap<>();
options.put("basePath", "/images/emoji");
options.put("className", "comment-emoji");

EmojiParser parser = EmojiParser.fromJson(Paths.get("dist/emoji-list.json"), options);
String html = parser.parse(content);
```

输出与前端 `parse()` 一致，属性顺序固定：

```html
<img class="mkep-smiley comment-emoji" src="/images/emoji/qq/weixiao.gif" alt="微笑" loading="lazy" decoding="async" title="微笑">
```

`options`：

| 参数 | 说明 |
| --- | --- |
| `basePath` | 图片根路径，尾部斜杠自动归一。 |
| `icons` | 覆盖配置里的 `groups`；不读 JSON 时也可直接构造传入。 |
| `className` | 追加自定义类，支持空格分隔字符串或数组，自动去重。 |
| `escape` | 默认 `true`：输入按纯文本处理，非表情内容一律 HTML 转义，适合评论等原始文本。设为 `false` 时按 HTML 片段处理，用轻量 tokenizer 跳过 `<script>` / `<style>` / `<textarea>` / `<pre>` / `<code>` 等整块及所有标签属性，只替换正文文本——**仅用于可信或已净化的 HTML**。 |

规则与前端完全对齐：占位符除 `{alias}` 外按字面量匹配、`{alias}` 大小写不敏感、长别名优先、重叠位置取更长匹配、同一位置只替换一次。后端是无状态纯函数，没有前端的 `data-mkep-parsed` 幂等标记，重复调用会重新处理输入。

`test/server.test.js` 用 11 组用例对比 PHP / Java / JS 三端输出；CI 通过 `setup-php` 与 `setup-java` 提供运行时，并在 server job 设置 `MKEP_REQUIRE_PHP` / `MKEP_REQUIRE_JAVA`，运行时缺失时直接失败、不会静默跳过；本机缺少 JDK 时 Java 用例自动跳过。

## WordPress 插件

仓库附带一个可直接安装到 WordPress 的插件，把服务端解析与前端面板接到评论系统：

- 服务端把评论（可选文章、摘要）里的表情代码转成 `<img>`，不依赖前端脚本；
- 在评论表单文本域后追加表情按钮，点击打开多分组、懒加载的表情面板；
- 停用 WordPress 自带的 `convert_smilies`，避免 `:)` 一类代码被抢先替换；
- 设置页（设置 → MK Emoji Picker）可配置解析位置、图片目录 URL、附加 CSS 类与纯文本模式；
- 前后端与 PHP / Java 解析器共用同一份 `assets/emoji-list.json`。

构建与安装：

```bash
npm run build:wp
```

生成 `wordpress/mk-emoji-picker/` 与 `wordpress/mk-emoji-picker-2.0.0.zip`。脚本把 `dist/` 的前端产物、`server/php/EmojiParser.php` 和 `images/emoji/` 下的 510 张图片复制进插件目录；上传 zip 或把该目录放到 `wp-content/plugins/` 后启用即可。构建产物不入库，插件源码保留在 `wordpress/src/`。

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| `parse_comments` | 开 | 解析评论内容。 |
| `parse_content` / `parse_excerpt` | 关 | 解析文章正文 / 摘要。 |
| `disable_core_smilies` | 开 | 移除 `convert_smilies` 过滤器。 |
| `enable_picker` | 开 | 评论框表情按钮与前端资源。 |
| `image_base_url` | 空 | 留空使用插件自带 `images/emoji/`，也可指向 CDN。 |
| `class_name` | 空 | 追加到 `<img>` 的 CSS 类；沿用主题表情样式可填 `wp-smiley`。 |
| `escape_html` | 关 | 开启后按纯文本转义输入；WordPress 内容已是合法 HTML，通常保持关闭。 |

开发者接口：模板函数 `mkep_parse_text( $text, $options )`（`$options` 可覆盖 `basePath` / `className` / `escape` / `icons`），以及过滤器 `mkep_options`、`mkep_parse_options`、`mkep_base_path`、`mkep_should_enqueue`。

`test/wordpress.test.js` 用 WordPress 函数桩在 Node 里驱动 PHP 源码，覆盖过滤器注册、解析输出、设置项净化、资源加载与 ZIP 结构；CI 的 server job 会同时验证 PHP / Java / WordPress 三端。

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
npm test        # pretest 自动重建 dist，再跑 node:test（jsdom 单元 + 无头浏览器布局冒烟）
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
