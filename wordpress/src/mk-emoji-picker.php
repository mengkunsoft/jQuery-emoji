<?php
/**
 * Plugin Name:       MK Emoji Picker
 * Plugin URI:        https://github.com/mengkunsoft/mk-emoji-picker
 * Description:       把评论与文章里的表情代码转换成图片，并为评论框添加零依赖的表情选择面板。
 * Version:           2.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Sky, Mengkun
 * Author URI:        https://github.com/mengkunsoft
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 * Text Domain:       mk-emoji-picker
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('MKEP_VERSION')) {
    define('MKEP_VERSION', '2.0.0');
}
define('MKEP_PLUGIN_FILE', __FILE__);
if (!defined('MKEP_PLUGIN_DIR')) {
    define('MKEP_PLUGIN_DIR', plugin_dir_path(__FILE__));
}
if (!defined('MKEP_PLUGIN_URL')) {
    define('MKEP_PLUGIN_URL', plugin_dir_url(__FILE__));
}
if (!defined('MKEP_INCLUDES_DIR')) {
    define('MKEP_INCLUDES_DIR', MKEP_PLUGIN_DIR . 'includes/');
}
if (!defined('MKEP_ASSETS_DIR')) {
    define('MKEP_ASSETS_DIR', MKEP_PLUGIN_DIR . 'assets/');
}
if (!defined('MKEP_ASSETS_URL')) {
    define('MKEP_ASSETS_URL', MKEP_PLUGIN_URL . 'assets/');
}
if (!defined('MKEP_PARSER_FILE')) {
    define('MKEP_PARSER_FILE', MKEP_INCLUDES_DIR . 'EmojiParser.php');
}

require_once MKEP_PARSER_FILE;
require_once MKEP_INCLUDES_DIR . 'class-mk-emoji-picker.php';

/** @return MkEmojiPicker_Plugin */
function mkep_plugin()
{
    return MkEmojiPicker_Plugin::instance();
}

/**
 * 供主题或其他插件直接解析一段文本。
 * $options 可覆盖 basePath / className / escape / icons。
 */
function mkep_parse_text($text, array $options = [])
{
    return mkep_plugin()->parse_text((string) $text, $options);
}

register_activation_hook(__FILE__, static function () {
    add_option('mkep_options', MkEmojiPicker_Plugin::defaults());
});

add_action('plugins_loaded', 'mkep_plugin');
