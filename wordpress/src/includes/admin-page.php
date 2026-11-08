<?php
/**
 * 设置页模板（由 MkEmojiPicker_Plugin::render_admin_page() 载入）。
 *
 * @var array<string,mixed> $options
 */
if (!defined('ABSPATH')) {
    exit;
}

$checkbox = static function ($key, $label, $description = '') use ($options) {
    $name = MkEmojiPicker_Plugin::OPTION_KEY . '[' . $key . ']';
    echo '<tr><th scope="row">' . esc_html($label) . '</th><td>';
    echo '<label for="mkep-' . esc_attr($key) . '">';
    echo '<input type="checkbox" id="mkep-' . esc_attr($key) . '" name="' . esc_attr($name)
        . '" value="1"' . checked(!empty($options[$key]), true, false) . '> ';
    echo esc_html($description) . '</label></td></tr>';
};

$textField = static function ($key, $label, $description = '') use ($options) {
    $name = MkEmojiPicker_Plugin::OPTION_KEY . '[' . $key . ']';
    echo '<tr><th scope="row"><label for="mkep-' . esc_attr($key) . '">'
        . esc_html($label) . '</label></th><td>';
    echo '<input type="text" class="regular-text" id="mkep-' . esc_attr($key)
        . '" name="' . esc_attr($name) . '" value="'
        . esc_attr(isset($options[$key]) ? (string) $options[$key] : '') . '">';
    if ($description !== '') {
        echo '<p class="description">' . esc_html($description) . '</p>';
    }
    echo '</td></tr>';
};
?>
<div class="wrap">
    <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
    <p><?php echo esc_html__('表情代码在服务端转换成图片，评论框可选配表情选择面板。', MkEmojiPicker_Plugin::TEXT_DOMAIN); ?></p>

    <form action="options.php" method="post">
        <?php settings_fields('mkep'); ?>
        <h2><?php echo esc_html__('解析位置', MkEmojiPicker_Plugin::TEXT_DOMAIN); ?></h2>
        <table class="form-table" role="presentation">
            <tbody>
                <?php
                $checkbox('parse_comments', __('评论内容', MkEmojiPicker_Plugin::TEXT_DOMAIN), __('把评论里的表情代码转换成图片。', MkEmojiPicker_Plugin::TEXT_DOMAIN));
                $checkbox('parse_content', __('文章内容', MkEmojiPicker_Plugin::TEXT_DOMAIN), __('同时处理文章与页面正文。', MkEmojiPicker_Plugin::TEXT_DOMAIN));
                $checkbox('parse_excerpt', __('摘要', MkEmojiPicker_Plugin::TEXT_DOMAIN), __('同时处理文章摘要。', MkEmojiPicker_Plugin::TEXT_DOMAIN));
                $checkbox('disable_core_smilies', __('停用 WP 自带表情转换', MkEmojiPicker_Plugin::TEXT_DOMAIN), __('避免 convert_smilies 抢先替换代码。', MkEmojiPicker_Plugin::TEXT_DOMAIN));
                ?>
            </tbody>
        </table>

        <h2><?php echo esc_html__('表情面板与显示', MkEmojiPicker_Plugin::TEXT_DOMAIN); ?></h2>
        <table class="form-table" role="presentation">
            <tbody>
                <?php
                $checkbox('enable_picker', __('评论框显示表情按钮', MkEmojiPicker_Plugin::TEXT_DOMAIN), __('加载前端脚本并在评论表单追加按钮。', MkEmojiPicker_Plugin::TEXT_DOMAIN));
                $textField('image_base_url', __('表情图片目录 URL', MkEmojiPicker_Plugin::TEXT_DOMAIN), __('留空则使用插件自带的 images/emoji/；也可指向 CDN 或主题目录。', MkEmojiPicker_Plugin::TEXT_DOMAIN));
                $textField('class_name', __('附加 CSS 类', MkEmojiPicker_Plugin::TEXT_DOMAIN), __('空格分隔；如需沿用 WordPress 主题的表情样式可填 wp-smiley。', MkEmojiPicker_Plugin::TEXT_DOMAIN));
                $checkbox('escape_html', __('纯文本模式', MkEmojiPicker_Plugin::TEXT_DOMAIN), __('开启后转义输入中的 HTML；WordPress 内容已是合法 HTML，通常保持关闭。', MkEmojiPicker_Plugin::TEXT_DOMAIN));
                ?>
            </tbody>
        </table>

        <?php submit_button(); ?>
    </form>

    <h2><?php echo esc_html__('开发者接口', MkEmojiPicker_Plugin::TEXT_DOMAIN); ?></h2>
    <p><code>mkep_parse_text( $text )</code>、过滤器 <code>mkep_options</code> / <code>mkep_parse_options</code> / <code>mkep_base_path</code> / <code>mkep_should_enqueue</code>。</p>
</div>
