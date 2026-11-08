=== MK Emoji Picker ===
Contributors: mengkunsoft
Tags: emoji, smiley, comments, emoticon, picker
Requires at least: 5.8
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 2.0.0
License: MIT
License URI: https://opensource.org/licenses/MIT

Convert emoticon codes into images on the server, and add a zero-dependency emoji picker to the comment form.

== Description ==

MK Emoji Picker brings the mk-emoji-picker library to WordPress.

* Server-side rendering: `[微笑]`, `[aru_11]`, `#(玫瑰)` 等表情代码在输出评论 / 文章内容时由 PHP 转成 `<img>`，无需等待前端脚本。
* Comment form picker: 在评论文本域后追加表情按钮，点击打开零依赖、支持多分组与懒加载的表情面板。
* Shared configuration: 前后端与 PHP / Java 解析器共用同一份 `assets/emoji-list.json`。
* Safe by default: 只替换标签外的文本，跳过 `<script>` / `<style>` / `<code>` 等整块以及所有标签属性；可选纯文本转义模式。
* Settings page: 自定义解析位置、图片目录 URL、附加 CSS 类，并停用 WordPress 自带的 `convert_smilies`。
* No third-party PHP/JS dependencies, no remote requests, works with the bundled 510 emoji images.

Developer API: `mkep_parse_text( $text, $options )` plus the `mkep_options`, `mkep_parse_options`, `mkep_base_path` and `mkep_should_enqueue` filters.

== Installation ==

1. Upload the `mk-emoji-picker` folder to `/wp-content/plugins/`, or install the generated ZIP through Plugins > Add New.
2. Activate the plugin through the Plugins screen.
3. Optional: open Settings > MK Emoji Picker to choose where parsing is applied and where the images live.

The plugin folder must contain `assets/`, `includes/` and `images/emoji/`. When building from the source repository, run `npm run build:wp` first — it copies `dist/`, `server/php/EmojiParser.php` and `images/emoji/` into a ready-to-install folder and creates the ZIP.

== Frequently Asked Questions ==

= Does it need jQuery? =

No. The picker is written in vanilla JavaScript with zero runtime dependencies.

= Why do my emoticons still look like WordPress smilies? =

Enable "停用 WP 自带表情转换" in the settings. WordPress may otherwise convert `:)` style codes before this plugin runs.

= Can I serve the images from a CDN? =

Yes. Set "表情图片目录 URL" to the CDN directory that mirrors `images/emoji/`, keeping the same sub-directory and file names.

= My theme styles rely on img.wp-smiley =

Put `wp-smiley` into "附加 CSS 类". It is opt-in: v2 no longer emits that class by default.

== Changelog ==

= 2.0.0 =
* Initial WordPress integration for mk-emoji-picker v2.
* Server-side parsing, comment form picker, settings page and uninstall cleanup.
