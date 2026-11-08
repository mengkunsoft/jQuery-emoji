<?php
/**
 * 卸载时清理本插件写入的选项。
 */
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('mkep_options');
