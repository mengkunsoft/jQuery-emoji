/**
 * Created by Sky on 2015/12/11.
 * Edited by Mengkun on 2017/12/17.
 */
(function ($, window, document) {

    var PLUGIN_NAME = 'emoji',
        VERSION = '1.1.1',
        BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        LOAD_BUFFER = 100,
        DEFAULTS = {
            showTab: true,
            animation: 'fade',
            icons: []
        };

    window.emoji_index = 0;

    function Plugin(element, options) {
        this.$content = $(element);
        this.options = options;
        this.index = emoji_index;
        switch (options.animation) {
            case 'none':
                this.showFunc = 'show';
                this.hideFunc = 'hide';
                this.toggleFunc = 'toggle';
                break;
            case 'slide':
                this.showFunc = 'slideDown';
                this.hideFunc = 'slideUp';
                this.toggleFunc = 'slideToggle';
                break;
            case 'fade':
                this.showFunc = 'fadeIn';
                this.hideFunc = 'fadeOut';
                this.toggleFunc = 'fadeToggle';
                break;
            default :
                this.showFunc = 'fadeIn';
                this.hideFunc = 'fadeOut';
                this.toggleFunc = 'fadeToggle';
                break;
        }
        this._init();
    }

    Plugin.prototype = {
        _init: function () {
            var that = this;
            var btn = this.options.button;
            var newBtn,
                contentTop,
                contentLeft;
            var ix = that.index;
            if (!btn) {
                newBtn = '<input type="image" class="emoji_btn" id="emoji_btn_' + ix + '" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZBAMAAAA2x5hQAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAkUExURUxpcfTGAPTGAPTGAPTGAPTGAPTGAPTGAPTGAPTGAPTGAPTGAOfx6yUAAAALdFJOUwAzbVQOoYrzwdwkAoU+0gAAAM1JREFUGNN9kK0PQWEUxl8fM24iCYopwi0muuVuzGyKwATFZpJIU01RUG/RBMnHxfz+Oef9uNM84d1+23nO+zxHKVG2WWupRJkdcAwtpCK0lpbqWE01pB0QayonREMoIp7AawQrWSgGGb4pn6dSeSh68FAVXqHqy3wKrkJiDGDTg3dnp//w+WnwlwIOJauF+C7sXRVfdha4O4oIJfTbtdSxs2uqhs585A0ko8iLTMEcDE1n65A+29pYAlr72nz9dKu7GuNTcsL2fDQzB/wCPVJ69nZGb3gAAAAASUVORK5CYII="/>';
                contentTop = this.$content.offset().top + this.$content.outerHeight() + 10;
                contentLeft = this.$content.offset().left + 2;
                $(newBtn).appendTo($('body'));
                $('#emoji_btn_' + ix).css({'top': contentTop + 'px', 'left': contentLeft + 'px'});
                btn = '#emoji_btn_' + ix;
            }

            var showTab = this.options.showTab;
            var basePath = this.options.basePath;
            var iconsGroup = this.options.icons;
            var groupLength = iconsGroup.length;
            if (groupLength === 0) {
                console.error('表情图路径读取失败');
                return false;
            }

            var emoji_container = '<div class="emoji_container" id="emoji_container_' + ix + '">';
            var emoji_content = '<div class="emoji_content">';
            var emoji_tab = '<div class="emoji_tab" style="' + (groupLength === 1 && !showTab ? 'display:none;' : '') + '"><div class="emoji_tab_prev"></div><div class="emoji_tab_list"><ul>';
            var panel,
                name,
                path,
                maxNum,
                excludeNums,
                file,
                placeholder,
                emoji,
                index,
                notation;
            for (var i = 0; i < groupLength; i++) {
                name = iconsGroup[i].name || 'group' + (i + 1);
                path = basePath + '/' + iconsGroup[i].path;
                maxNum = iconsGroup[i].maxNum;  // 表情最大数
                excludeNums = iconsGroup[i].excludeNums;    // 要排除的
                file = iconsGroup[i].file || '.jpg';
                placeholder = iconsGroup[i].placeholder || '#em' + (i + 1) + '_{alias}#';
                emoji = iconsGroup[i].emoji;    // 表情数据列表 [显示名:文件名]
                index = 0;
                if (!path) {
                    console.error('第 ' + i + ' 组表情未配置图片路径 path');
                    continue;
                }
                
                panel = '<div id="emoji' + i + '" class="emoji_icons" style="' + (i === 0 ? '' : 'display:none;') + '"><ul>';
                
                if (emoji) {    // 指定了emoji 数组
                    if (typeof emoji !== 'object') {
                        console.error('第 ' + i + ' 组 emoji 参数设置不正确');
                        continue;
                    }
                    
                    maxNum = maxNum || emoji.length;
                    
                    // 循环添加表情
                    for(var tmp in emoji) {
                        index++;
                        
                        if (index > maxNum || (excludeNums && excludeNums.indexOf(index) >= 0)) {
                            continue;  // 排除要排除的表情
                        }
                        
                        notation = placeholder.replace(new RegExp('{alias}', 'gi'), tmp.toString());
                        panel += '<li><a data-emoji_code="' + notation + '" data-index="' + index + '" title="' + tmp +
                        '"><img src="' + BLANK_IMG + '" data-src="' + path + emoji[tmp] + file + '" alt=""/></a></li>';
                    }
                    
                    
                } else {
                    if(!maxNum) {
                        console.error('请指定第 ' + i + ' 组表情的 maxNum 或 emoji 参数');
                        continue;
                    }
                    
                    for (var j = 1; j <= maxNum; j++) {
                        
                        if (excludeNums && excludeNums.indexOf(j) >= 0) {
                            continue;  // 排除要排除的表情
                        }
                        
                        notation = placeholder.replace(new RegExp('{alias}', 'gi'), j.toString());
                        panel += '<li><a data-emoji_code="' + notation + '" data-index="' + j + '"><img src="' + BLANK_IMG + '" data-src="' + path + j + file + '" alt=""/></a></li>';
                    }
                }
                
                
                panel += '</ul></div>';
                emoji_content += panel;
                emoji_tab += '<li data-emoji_tab="emoji' + i + '" class="' + (i === 0 ? 'selected' : '') + '" title="' + name + '">' + name + '</li>';
            }
            emoji_content += '</div>';
            emoji_tab += '</ul></div><div class="emoji_tab_next"></div></div>';
            var emoji_preview = '<div class="emoji_preview"><img/></div>';
            emoji_container += emoji_content;
            emoji_container += emoji_tab;
            emoji_container += emoji_preview;

            $(emoji_container).appendTo($('body'));
            
            // 面板滚动、窗口滚动或尺寸变化时，只加载进入可视区域的表情图片
            var loadTimer;
            var scheduleLoad = function () {
                clearTimeout(loadTimer);
                loadTimer = setTimeout(function () {
                    that._loadVisibleEmoji();
                }, 50);
            };
            $('#emoji_container_' + ix + ' .emoji_content').on('scroll.emoji', scheduleLoad);
            $(window).on('scroll.emoji' + ix + ' resize.emoji' + ix, scheduleLoad);
            scheduleLoad();

            var pageCount = groupLength % 8 === 0 ? parseInt(groupLength / 8) : parseInt(groupLength / 8) + 1;
            var pageIndex = 1;
            $(document).on({
                'click': function (e) {
                    var target = e.target;
                    var field = that.$content[0];
                    var code,
                        tab,
                        imgSrc,
                        insertHtml;
                    if (target === $(btn)[0]) {
                        // 后续点击
                        var btnTop = $(btn).offset().top + $(btn).outerHeight() + 5;
                        var btnLeft = $(btn).offset().left;
                        
                        /* RTL 布局 */
                        // btnLeft = btnLeft - $('#emoji_container_' + ix).width() + $(btn).width();
                        
                        $('#emoji_container_' + ix).css({'top': btnTop + 'px', 'left': btnLeft + 'px'});
                        // 走 toggle()，动画结束后才会触发可视区域图片的加载
                        that.toggle();
                        // that.$content.focus();
                    } else if ($(target).parents('#emoji_container_' + ix).length > 0) {
                        code = $(target).data('emoji_code') || $(target).parent().data('emoji_code');
                        tab = $(target).data('emoji_tab');
                        if (code) {
                            if (field.nodeName === 'DIV') {
                                imgSrc = that._loadEmoji($(target).closest('#emoji_container_' + ix + ' a[data-emoji_code]').find('img')[0]);
                                insertHtml = '<img class="emoji_icon" src="' + imgSrc + '"/>';
                                that._insertAtCursor(field, insertHtml, false);
                            } else {
                                that._insertAtCursor(field, code);
                            }
                            that.hide();
                            that.$content.focus();
                        }
                        else if (tab) {
                            if (!$(target).hasClass('selected')) {
                                $('#emoji_container_' + ix + ' .emoji_icons').hide();
                                $('#emoji_container_' + ix + ' #' + tab).show();
                                // 切换分组后回到顶部，再加载新分组顶部的表情
                                $('#emoji_container_' + ix + ' .emoji_content').scrollTop(0);
                                $(target).addClass('selected').siblings().removeClass('selected');
                                that._loadVisibleEmoji();
                            }
                        } else if ($(target).hasClass('emoji_tab_prev')) {
                            if (pageIndex > 1) {
                                $('#emoji_container_' + ix + ' .emoji_tab_list ul').css('margin-left', ('-503' * (pageIndex - 2)) + 'px');
                                pageIndex--;
                            }

                        } else if ($(target).hasClass('emoji_tab_next')) {
                            if (pageIndex < pageCount) {
                                $('#emoji_container_' + ix + ' .emoji_tab_list ul').css('margin-left', ('-503' * pageIndex) + 'px');
                                pageIndex++;
                            }
                        }
                        // that.$content.focus();
                    } else if ($('#emoji_container_' + ix + ':visible').length > 0) {
                        that.hide();
                        that.$content.focus();
                    }
                }
            });

            $('#emoji_container_' + ix + ' .emoji_icons a').mouseenter(function () {
                if (($(this).offset().left - $('#emoji_container_' + ix).offset().left) * 2 < $('#emoji_container_' + ix).width()) {
                    $('#emoji_container_' + ix + ' .emoji_preview').css({'left': 'auto', 'right': 0});
                } else {
                    $('#emoji_container_' + ix + ' .emoji_preview').css({'left': 0, 'right': 'auto'});
                }
                var src = that._loadEmoji($(this).find('img')[0]);
                $('#emoji_container_' + ix + ' .emoji_preview img').attr('src', src).parent().show();
            });

            $('#emoji_container_' + ix + ' .emoji_icons a').mouseleave(function () {
                $('#emoji_container_' + ix + ' .emoji_preview img').removeAttr('src').parent().hide();
            });
            
            
        },

        // 把真实地址写入 src，加载单个表情
        _loadEmoji: function (img) {
            if (!img) {
                return '';
            }
            var src = img.getAttribute('data-src');
            if (src) {
                img.setAttribute('src', src);
                img.removeAttribute('data-src');
            }
            return img.getAttribute('src');
        },

        // 只加载当前分组中落在可视区域（含少量缓冲）内的表情
        _loadVisibleEmoji: function () {
            var $container = $('#emoji_container_' + this.index);
            if (!$container.is(':visible')) {
                return;
            }
            var $content = $container.find('.emoji_content');
            var $panel = $content.find('.emoji_icons:visible');
            if (!$content.length || !$panel.length) {
                return;
            }
            var box = $content[0].getBoundingClientRect();
            var viewH = $(window).height();
            var viewW = $(window).width();
            var top = Math.max(box.top, 0) - LOAD_BUFFER;
            var bottom = Math.min(box.bottom, viewH) + LOAD_BUFFER;
            var left = Math.max(box.left, 0) - LOAD_BUFFER;
            var right = Math.min(box.right, viewW) + LOAD_BUFFER;
            if (top >= bottom || left >= right) {
                return;
            }
            var pending = [];
            $panel.find('img[data-src]').each(function () {
                var rect = this.getBoundingClientRect();
                if (rect.bottom >= top && rect.top <= bottom && rect.right >= left && rect.left <= right) {
                    pending.push(this);
                }
            });
            for (var i = 0; i < pending.length; i++) {
                this._loadEmoji(pending[i]);
            }
        },

        _insertAtCursor: function (field, value, selectPastedContent) {
            var sel, range;
            if (field.nodeName === 'DIV') {
                field.focus();
                if (window.getSelection) {
                    sel = window.getSelection();
                    if (sel.getRangeAt && sel.rangeCount) {
                        range = sel.getRangeAt(0);
                        range.deleteContents();
                        var el = document.createElement('div');
                        el.innerHTML = value;
                        var frag = document.createDocumentFragment(), node, lastNode;
                        while ((node = el.firstChild)) {
                            lastNode = frag.appendChild(node);
                        }
                        var firstNode = frag.firstChild;
                        range.insertNode(frag);

                        if (lastNode) {
                            range = range.cloneRange();
                            range.setStartAfter(lastNode);
                            if (selectPastedContent) {
                                range.setStartBefore(firstNode);
                            } else {
                                range.collapse(true);
                            }
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    }
                } else if ((sel = document.selection) && sel.type !== 'Control') {
                    var originalRange = sel.createRange();
                    originalRange.collapse(true);
                    sel.createRange().pasteHTML(html);
                    if (selectPastedContent) {
                        range = sel.createRange();
                        range.setEndPoint('StartToStart', originalRange);
                        range.select();
                    }
                }
            } else {
                if (document.selection) {
                    field.focus();
                    sel = document.selection.createRange();
                    sel.text = value;
                    sel.select();
                }
                else if (field.selectionStart || field.selectionStart === 0) {
                    var startPos = field.selectionStart;
                    var endPos = field.selectionEnd;
                    var restoreTop = field.scrollTop;
                    field.value = field.value.substring(0, startPos) + value + field.value.substring(endPos, field.value.length);
                    if (restoreTop > 0) {
                        field.scrollTop = restoreTop;
                    }
                    field.focus();
                    field.selectionStart = startPos + value.length;
                    field.selectionEnd = startPos + value.length;
                } else {
                    field.value += value;
                    field.focus();
                }
            }

        },

        show: function () {
            var that = this;
            $('#emoji_container_' + this.index)[this.showFunc]().promise().done(function () {
                that._loadVisibleEmoji();
            });
        },

        hide: function () {
            $('#emoji_container_' + this.index)[this.hideFunc]();
        },

        toggle: function () {
            var that = this;
            $('#emoji_container_' + this.index)[this.toggleFunc]().promise().done(function () {
                that._loadVisibleEmoji();
            });
        }
    };

    function fn(option) {
        emoji_index++;
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('plugin_' + PLUGIN_NAME + emoji_index);
            var options = $.extend({}, DEFAULTS, $this.data(), typeof option === 'object' && option);

            if (!data) $this.data('plugin_' + PLUGIN_NAME + emoji_index, (data = new Plugin(this, options)));
            if (typeof option === 'string') data[option]();
        });
    }

    $.fn[PLUGIN_NAME] = fn;
    $.fn[PLUGIN_NAME].Constructor = Plugin;

}(jQuery, window, document));

/**
 * 表情包解析
 */
(function ($, window, document) {

    var PLUGIN_NAME = 'emojiParse',
        VERSION = '1.2.0',
        DEFAULTS = {
            icons: []
        },
        // 占位符中代表表情代码的 {alias}，大小写不敏感
        ALIAS_RE = /\{alias\}/i,
        // 这些元素里的文本不是正文，替换会破坏脚本、样式、代码或表单内容
        SKIP_TAGS = ['script', 'style', 'noscript', 'iframe', 'textarea',
                     'select', 'title', 'pre', 'code'];

    // 正则元字符转义：占位符中除 {alias} 以外的部分一律按字面量匹配
    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function joinPath(basePath, groupPath) {
        if (!basePath) return groupPath;
        return basePath.replace(/\/+$/, '') + '/' + groupPath.replace(/^\/+/, '');
    }

    /**
     * 把一组表情配置编译成一条匹配规则。
     * {alias} 只匹配「已配置的别名」或「纯数字」，不再吞掉任意字符。
     */
    function buildRule(group, basePath, index) {
        var groupPath = group.path;
        if (typeof groupPath !== 'string' || !groupPath) {
            console.error('第 ' + index + ' 组表情未配置图片路径 path');
            return null;
        }

        var placeholder = group.placeholder;
        if (typeof placeholder !== 'string' || !ALIAS_RE.test(placeholder)) {
            console.error('第 ' + index + ' 组表情未配置含 {alias} 的 placeholder');
            return null;
        }

        var emoji = group.emoji || null;
        if (emoji && typeof emoji !== 'object') {
            console.error('第 ' + index + ' 组 emoji 参数设置不正确');
            return null;
        }

        var aliasSource, resolve, named = !!emoji;
        if (named) {
            var names = [];
            $.each(emoji, function (key, value) {
                if (Object.prototype.hasOwnProperty.call(emoji, key) &&
                    typeof value === 'string' && value) {
                    names.push(key);
                }
            });
            // 长别名优先，避免「笑」抢先匹配掉「笑哭」
            names.sort(function (a, b) { return b.length - a.length; });
            if (!names.length) return null;

            var alternatives = [];
            for (var n = 0; n < names.length; n++) {
                alternatives.push(escapeRegExp(names[n]));
            }
            aliasSource = '(?:' + alternatives.join('|') + ')';
            resolve = function (alias) { return emoji[alias]; };
        } else {
            aliasSource = '\\d+';
            resolve = function (alias) { return alias; };
        }

        var literals = placeholder.split(ALIAS_RE);
        var source = '';
        for (var p = 0; p < literals.length; p++) {
            source += escapeRegExp(literals[p]);
            if (p < literals.length - 1) source += '(' + aliasSource + ')';
        }

        return {
            order: index,
            regexp: new RegExp(source, 'g'),
            aliasCount: literals.length - 1,
            named: named,
            resolve: resolve,
            path: joinPath(basePath, groupPath),
            file: group.file || '.jpg'
        };
    }

    // 只收集正文文本节点：HTML 属性、脚本、代码块等一概不碰
    function collectTextNodes(root, list) {
        var children = root.childNodes;
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (child.nodeType === 3) {
                if (child.nodeValue) list.push(child);
            } else if (child.nodeType === 1 &&
                       $.inArray(child.nodeName.toLowerCase(), SKIP_TAGS) === -1) {
                collectTextNodes(child, list);
            }
        }
    }

    /**
     * 在单个文本节点内找出所有表情代码，按位置去重后一次性替换为 <img>。
     * 用 DOM API 生成节点，别名、路径里的引号不会破坏 HTML 结构。
     */
    function replaceInTextNode(node, rules, doc) {
        var text = node.nodeValue;
        var hits = [];
        var i, g, match, alias, file;

        for (i = 0; i < rules.length; i++) {
            var rule = rules[i];
            rule.regexp.lastIndex = 0;
            while ((match = rule.regexp.exec(text)) !== null) {
                if (!match[0].length) {
                    rule.regexp.lastIndex++;
                    continue;
                }
                alias = '';
                for (g = 1; g <= rule.aliasCount; g++) {
                    if (match[g] !== undefined) { alias = match[g]; break; }
                }
                file = rule.resolve(alias);
                if (!file) continue;
                hits.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    rule: rule,
                    alias: alias,
                    file: file
                });
            }
        }
        if (!hits.length) return;

        // 同一位置优先取更长的匹配，其次取配置中靠前的组；重叠区间只替换一次
        hits.sort(function (a, b) {
            return a.start - b.start ||
                   (b.end - b.start) - (a.end - a.start) ||
                   a.rule.order - b.rule.order;
        });

        var frag = doc.createDocumentFragment();
        var cursor = 0;
        for (i = 0; i < hits.length; i++) {
            var hit = hits[i];
            if (hit.start < cursor) continue;
            if (hit.start > cursor) {
                frag.appendChild(doc.createTextNode(text.slice(cursor, hit.start)));
            }
            var img = doc.createElement('img');
            img.className = 'wp-smiley';
            img.setAttribute('src', hit.rule.path + hit.file + hit.rule.file);
            if (hit.rule.named) {
                img.setAttribute('title', hit.alias);
                img.setAttribute('alt', hit.alias);
            }
            frag.appendChild(img);
            cursor = hit.end;
        }
        if (cursor < text.length) {
            frag.appendChild(doc.createTextNode(text.slice(cursor)));
        }
        node.parentNode.replaceChild(frag, node);
    }

    function Plugin(element, options) {
        this.$content = $(element);
        this.options = options;
        this._init();
    }

    Plugin.prototype = {
        _init: function () {
            var root = this.$content[0];
            var groups = this.options.icons;
            if (!root || !groups || groups.length <= 0) return;   // 没有表情包

            var basePath = typeof this.options.basePath === 'string' ? this.options.basePath : '';
            var rules = [];
            for (var i = 0; i < groups.length; i++) {
                var rule = buildRule(groups[i], basePath, i);
                if (rule) rules.push(rule);
            }
            if (!rules.length) return;

            var nodes = [];
            collectTextNodes(root, nodes);
            var doc = root.ownerDocument || document;
            for (var j = 0; j < nodes.length; j++) {
                replaceInTextNode(nodes[j], rules, doc);
            }
        }
    };
    
    function fn(option) {
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('plugin_' + PLUGIN_NAME);
            var options = $.extend({}, DEFAULTS, $this.data(), typeof option === 'object' && option);

            if (!data) $this.data('plugin_' + PLUGIN_NAME, (data = new Plugin(this, options)));
            if (typeof option === 'string') data[option]();
        });
    }

    $.fn[PLUGIN_NAME] = fn;
    $.fn[PLUGIN_NAME].Constructor = Plugin;

}(jQuery, window, document));
