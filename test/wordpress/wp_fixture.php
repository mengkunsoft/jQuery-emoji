<?php
/**
 * WordPress 函数桩：在没有 WordPress 的环境里加载插件源码并验证行为。
 * stdin 收 JSON（options / flags / text / sanitize），stdout 输出 JSON。
 */
declare(strict_types=1);

$root = dirname(__DIR__, 2);
$input = json_decode((string) stream_get_contents(STDIN), true);
if (!is_array($input)) {
    $input = [];
}

define('ABSPATH', $root . '/');
define('MKEP_PLUGIN_DIR', $root . '/wordpress/src/');
define('MKEP_PLUGIN_URL', 'https://example.com/wp-content/plugins/mk-emoji-picker/');
define('MKEP_INCLUDES_DIR', $root . '/wordpress/src/includes/');
define('MKEP_ASSETS_DIR', $root . '/dist/');
define('MKEP_ASSETS_URL', MKEP_PLUGIN_URL . 'assets/');
define('MKEP_PARSER_FILE', $root . '/server/php/EmojiParser.php');

$GLOBALS['mkep_db'] = ['mkep_options' => $input['options'] ?? []];
$GLOBALS['mkep_flags'] = array_merge([
    'is_admin' => false,
    'is_singular' => true,
    'comments_open' => true,
    'can_manage' => true,
], $input['flags'] ?? []);
$GLOBALS['mkep_filters'] = [];
$GLOBALS['mkep_removed'] = [];
$GLOBALS['mkep_enqueued'] = [];
$GLOBALS['mkep_inline'] = [];
$GLOBALS['mkep_admin_pages'] = [];
$GLOBALS['mkep_settings'] = [];
$GLOBALS['mkep_activation'] = [];

function add_filter($tag, $callback, $priority = 10, $acceptedArgs = 1)
{
    $GLOBALS['mkep_filters'][$tag][$priority][] = $callback;
    return true;
}

function remove_filter($tag, $callback, $priority = 10)
{
    $GLOBALS['mkep_removed'][] = [$tag, $callback, $priority];
    foreach ($GLOBALS['mkep_filters'][$tag][$priority] ?? [] as $index => $existing) {
        if ($existing === $callback) {
            unset($GLOBALS['mkep_filters'][$tag][$priority][$index]);
        }
    }
    return true;
}

function apply_filters($tag, $value, ...$args)
{
    $hooks = $GLOBALS['mkep_filters'][$tag] ?? [];
    ksort($hooks);
    foreach ($hooks as $callbacks) {
        foreach ($callbacks as $callback) {
            $value = call_user_func_array($callback, array_merge([$value], $args));
        }
    }
    return $value;
}

function add_action($tag, $callback, $priority = 10, $acceptedArgs = 1)
{
    return add_filter($tag, $callback, $priority, $acceptedArgs);
}

function do_action($tag, ...$args)
{
    apply_filters($tag, null, ...$args);
}

function get_option($name, $default = false)
{
    return $GLOBALS['mkep_db'][$name] ?? $default;
}

function add_option($name, $value)
{
    if (!array_key_exists($name, $GLOBALS['mkep_db'])) {
        $GLOBALS['mkep_db'][$name] = $value;
    }
    return true;
}

function delete_option($name)
{
    unset($GLOBALS['mkep_db'][$name]);
    return true;
}

function update_option($name, $value)
{
    $GLOBALS['mkep_db'][$name] = $value;
    return true;
}

function register_activation_hook($file, $callback)
{
    $GLOBALS['mkep_activation'][] = $callback;
}

function plugin_basename($file)
{
    return 'mk-emoji-picker/' . basename($file);
}

function is_admin()
{
    return !empty($GLOBALS['mkep_flags']['is_admin']);
}

function is_singular()
{
    return !empty($GLOBALS['mkep_flags']['is_singular']);
}

function comments_open()
{
    return !empty($GLOBALS['mkep_flags']['comments_open']);
}

function current_user_can($capability)
{
    return !empty($GLOBALS['mkep_flags']['can_manage']);
}

function wp_enqueue_style($handle, $src = '', $deps = [], $version = false, $media = 'all')
{
    $GLOBALS['mkep_enqueued'][] = ['style', $handle, $src, $deps, $version];
}

function wp_enqueue_script($handle, $src = '', $deps = [], $version = false, $inFooter = false)
{
    $GLOBALS['mkep_enqueued'][] = ['script', $handle, $src, $deps, $version, $inFooter];
}

function wp_add_inline_script($handle, $data, $position = 'after')
{
    $GLOBALS['mkep_inline'][] = [$handle, $data, $position];
}

function wp_json_encode($data, $flags = 0, $depth = 512)
{
    return json_encode($data, $flags | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES, $depth);
}

function esc_attr($value)
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function esc_html($value)
{
    return esc_attr($value);
}

function esc_html__($text, $domain = '')
{
    return esc_html($text);
}

function __($text, $domain = '')
{
    return $text;
}

function esc_url($url)
{
    return esc_url_raw($url);
}

function esc_url_raw($url)
{
    return preg_replace('/[\x00-\x20"\x27<>]/u', '', trim((string) $url));
}

function sanitize_html_class($class)
{
    return preg_replace('/[^A-Za-z0-9_-]/', '', (string) $class);
}

function checked($checked, $current = true, $echo = true)
{
    $html = (string) $checked === (string) $current ? ' checked="checked"' : '';
    if ($echo) {
        echo $html;
    }
    return $html;
}

function admin_url($path = '')
{
    return 'https://example.com/wp-admin/' . ltrim((string) $path, '/');
}

function add_options_page($pageTitle, $menuTitle, $capability, $slug, $callback)
{
    $GLOBALS['mkep_admin_pages'][] = [$pageTitle, $menuTitle, $capability, $slug];
}

function register_setting($group, $name, $args = [])
{
    $GLOBALS['mkep_settings'][] = [$group, $name, $args['type'] ?? ''];
}

function settings_fields($group)
{
    echo '<input type="hidden" name="option_page" value="' . esc_attr($group) . '">';
}

function get_admin_page_title()
{
    return 'MK Emoji Picker';
}

function submit_button()
{
    echo '<p class="submit"><input type="submit" class="button button-primary" value="保存更改"></p>';
}

require $root . '/wordpress/src/mk-emoji-picker.php';
do_action('plugins_loaded');
do_action('init');
do_action('admin_menu');
do_action('admin_init');

$plugin = mkep_plugin();
$text = $input['text'] ?? '<p>你好[微笑] 和 [aru_11]</p>';

$describe = static function ($callback) {
    if (is_array($callback)) {
        $class = is_object($callback[0]) ? get_class($callback[0]) : (string) $callback[0];
        return $class . '::' . (string) $callback[1];
    }
    return is_string($callback) ? $callback : 'closure';
};

$filters = [];
foreach ($GLOBALS['mkep_filters'] as $tag => $priorities) {
    foreach ($priorities as $priority => $callbacks) {
        foreach ($callbacks as $callback) {
            $filters[] = ['tag' => $tag, 'priority' => $priority, 'callback' => $describe($callback)];
        }
    }
}

do_action('wp_enqueue_scripts');

ob_start();
$plugin->render_admin_page();
$adminPage = (string) ob_get_clean();

echo json_encode([
    'filters' => $filters,
    'removed' => $GLOBALS['mkep_removed'],
    'enqueued' => $GLOBALS['mkep_enqueued'],
    'inline' => $GLOBALS['mkep_inline'],
    'admin_pages' => $GLOBALS['mkep_admin_pages'],
    'settings' => $GLOBALS['mkep_settings'],
    'admin_page' => $adminPage,
    'action_links' => $plugin->action_links(['<a href="#">停用</a>']),
    'defaults' => MkEmojiPicker_Plugin::defaults(),
    'comment_text' => apply_filters('comment_text', $text),
    'the_content' => apply_filters('the_content', $text),
    'the_excerpt' => apply_filters('the_excerpt', $text),
    'field' => apply_filters('comment_form_field_comment', '<p class="comment-form-comment"><textarea id="comment"></textarea></p>'),
    'enqueue_result' => count($GLOBALS['mkep_enqueued']) > 0,
    'base_path' => $plugin->base_path(),
    'parse_direct' => mkep_parse_text('[微笑]', ['basePath' => 'https://cdn.example.com/emoji/']),
    'sanitized' => MkEmojiPicker_Plugin::sanitize_options($input['sanitize'] ?? []),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
