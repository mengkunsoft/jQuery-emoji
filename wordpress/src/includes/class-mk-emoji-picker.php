<?php
/**
 * WordPress 集成：内容过滤、前端资源、评论框按钮与设置页。
 *
 * 只依赖 WordPress 自身与本插件附带的 EmojiParser，不加载任何第三方库。
 */
if (!defined('ABSPATH')) {
    exit;
}

use MkEmojiPicker\EmojiParser;

final class MkEmojiPicker_Plugin
{
    const OPTION_KEY = 'mkep_options';
    const TEXT_DOMAIN = 'mk-emoji-picker';

    /** @var MkEmojiPicker_Plugin|null */
    private static $instance = null;
    /** @var array<string,mixed>|null */
    private $options = null;
    /** @var EmojiParser|null */
    private $parser = null;
    /** @var string|null */
    private $parserKey = null;

    /** @return self */
    public static function instance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /** @return array<string,mixed> */
    public static function defaults()
    {
        return [
            'parse_comments'       => 1,
            'parse_content'        => 0,
            'parse_excerpt'        => 0,
            'disable_core_smilies' => 1,
            'enable_picker'        => 1,
            'image_base_url'       => '',
            'class_name'           => '',
            'escape_html'          => 0,
        ];
    }

    private function __construct()
    {
        add_action('init', [$this, 'init']);
        add_filter('plugin_action_links_' . plugin_basename(MKEP_PLUGIN_FILE), [$this, 'action_links']);
    }

    /** @return array<string,mixed> */
    public function options()
    {
        if ($this->options === null) {
            $saved = get_option(self::OPTION_KEY, []);
            $this->options = array_merge(self::defaults(), is_array($saved) ? $saved : []);
            $this->options = apply_filters('mkep_options', $this->options);
            if (!is_array($this->options)) {
                $this->options = self::defaults();
            }
        }
        return $this->options;
    }

    public function init()
    {
        if (is_admin()) {
            add_action('admin_menu', [$this, 'admin_menu']);
            add_action('admin_init', [$this, 'admin_init']);
        }

        $o = $this->options();

        if (!empty($o['disable_core_smilies'])) {
            $this->remove_core_smilies();
        }
        if (!empty($o['parse_comments'])) {
            add_filter('comment_text', [$this, 'filter_text'], 20);
        }
        if (!empty($o['parse_content'])) {
            add_filter('the_content', [$this, 'filter_text'], 20);
        }
        if (!empty($o['parse_excerpt'])) {
            add_filter('the_excerpt', [$this, 'filter_text'], 20);
        }
        if (!empty($o['enable_picker'])) {
            add_filter('comment_form_field_comment', [$this, 'comment_field'], 20);
            add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        }
    }

    /** WordPress 自带的 convert_smilies 会抢先把 :) 一类代码换掉，这里让位给本插件。 */
    public function remove_core_smilies()
    {
        foreach (['the_content', 'the_excerpt', 'comment_text'] as $tag) {
            remove_filter($tag, 'convert_smilies', 20);
        }
    }

    /** @param mixed $text @return string */
    public function filter_text($text)
    {
        return $this->parse_text((string) $text);
    }

    /** @return string */
    public function parse_text($text, array $options = [])
    {
        $o = $this->options();
        $config = [
            'basePath'  => $this->base_path(),
            'className' => isset($o['class_name']) ? (string) $o['class_name'] : '',
            'escape'    => !empty($o['escape_html']),
        ];
        $config = array_merge($config, $options);
        $config = apply_filters('mkep_parse_options', $config, (string) $text);
        return $this->parser($config)->parse((string) $text);
    }

    /** @return string 始终带尾部斜杠，供 EmojiParser 拼接分组路径。 */
    public function base_path()
    {
        $o = $this->options();
        $url = isset($o['image_base_url']) ? trim((string) $o['image_base_url']) : '';
        if ($url === '') {
            $url = MKEP_PLUGIN_URL . 'images/emoji/';
        }
        $url = apply_filters('mkep_base_path', $url);
        return rtrim(esc_url_raw($url), '/') . '/';
    }

    /** @return EmojiParser */
    private function parser(array $config)
    {
        $key = md5(serialize($config));
        if ($this->parserKey !== $key) {
            $this->parser = EmojiParser::fromJsonFile(MKEP_ASSETS_DIR . 'emoji-list.json', $config);
            $this->parserKey = $key;
        }
        return $this->parser;
    }

    /** 在评论表单的文本域后追加触发表情面板的按钮。 */
    public function comment_field($field)
    {
        $button = '<button type="button" id="mkep-comment-button"'
            . ' class="mkep-wp-trigger" aria-haspopup="dialog" aria-expanded="false">'
            . '<span class="mkep-wp-trigger-icon" aria-hidden="true">&#9786;</span>'
            . ' <span>' . esc_html__('插入表情', self::TEXT_DOMAIN) . '</span></button>';
        return (string) $field . '<p class="mkep-wp-trigger-wrap">' . $button . '</p>';
    }

    /** @return bool 是否注册了前端资源 */
    public function enqueue_assets()
    {
        $allowed = apply_filters('mkep_should_enqueue', is_singular() && comments_open());
        if (!$allowed) {
            return false;
        }

        wp_enqueue_style('mk-emoji-picker', MKEP_ASSETS_URL . 'mk-emoji-picker.css', [], MKEP_VERSION);
        wp_enqueue_style('mk-emoji-picker-wp', MKEP_ASSETS_URL . 'frontend.css', ['mk-emoji-picker'], MKEP_VERSION);
        wp_enqueue_script('mk-emoji-picker', MKEP_ASSETS_URL . 'mk-emoji-picker.js', [], MKEP_VERSION, true);
        wp_enqueue_script('mk-emoji-list', MKEP_ASSETS_URL . 'emoji-list.js', ['mk-emoji-picker'], MKEP_VERSION, true);
        wp_add_inline_script('mk-emoji-list', $this->inline_script());
        return true;
    }

    /** @return string */
    private function inline_script()
    {
        $config = [
            'basePath' => $this->base_path(),
            'showTab'  => true,
        ];
        $json = wp_json_encode(
            $config,
            JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES
        );
        return <<<JS
(function () {
    var field = document.getElementById('comment');
    var button = document.getElementById('mkep-comment-button');
    if (!field || !button || !window.MkEmojiPicker || !window.mkEmojiLists) { return; }
    var config = {$json};
    config.button = button;
    config.icons = window.mkEmojiLists;
    config.onShow = function () { button.setAttribute('aria-expanded', 'true'); };
    config.onHide = function () { button.setAttribute('aria-expanded', 'false'); };
    window.MkEmojiPicker.create(field, config);
}());
JS;
    }

    public function admin_menu()
    {
        add_options_page(
            esc_html__('MK Emoji Picker', self::TEXT_DOMAIN),
            esc_html__('MK Emoji Picker', self::TEXT_DOMAIN),
            'manage_options',
            'mk-emoji-picker',
            [$this, 'render_admin_page']
        );
    }

    public function admin_init()
    {
        register_setting('mkep', self::OPTION_KEY, [
            'type'              => 'array',
            'sanitize_callback' => [self::class, 'sanitize_options'],
            'default'           => self::defaults(),
        ]);
    }

    /** @return array<int,string> */
    public function action_links($links)
    {
        $links = is_array($links) ? $links : [];
        $url = admin_url('options-general.php?page=mk-emoji-picker');
        $links[] = '<a href="' . esc_url($url) . '">' . esc_html__('设置', self::TEXT_DOMAIN) . '</a>';
        return $links;
    }

    public function render_admin_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $options = $this->options();
        include MKEP_INCLUDES_DIR . 'admin-page.php';
    }

    /** @param mixed $input @return array<string,mixed> */
    public static function sanitize_options($input)
    {
        $input = is_array($input) ? $input : [];
        $out = [];
        foreach ([
            'parse_comments', 'parse_content', 'parse_excerpt',
            'disable_core_smilies', 'enable_picker', 'escape_html',
        ] as $key) {
            $out[$key] = empty($input[$key]) ? 0 : 1;
        }

        $url = isset($input['image_base_url']) ? trim((string) $input['image_base_url']) : '';
        $url = esc_url_raw($url);
        // 只允许 http(s) 绝对地址、以 / 开头的站点相对地址，或不含冒号的相对路径。
        if ($url !== '' && strpos($url, ':') !== false && !preg_match('#^https?://#i', $url)) {
            $url = '';
        }
        $out['image_base_url'] = $url;

        $classNames = isset($input['class_name']) ? (string) $input['class_name'] : '';
        $classes = [];
        foreach (preg_split('/\s+/u', trim($classNames)) ?: [] as $name) {
            $name = sanitize_html_class($name);
            if ($name !== '' && !in_array($name, $classes, true)) {
                $classes[] = $name;
            }
        }
        $out['class_name'] = implode(' ', $classes);

        return array_merge(self::defaults(), $out);
    }
}
