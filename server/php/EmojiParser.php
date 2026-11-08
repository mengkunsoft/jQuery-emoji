<?php
/**
 * mk-emoji-picker 后端解析器（PHP 7.4+，零依赖）。
 *
 * 与前端 parse() 使用同一份表情规则，把文本里的表情代码转换成 <img>。
 * 配置来自 dist/emoji-list.json（由 npm run build 生成）。
 *
 *   use MkEmojiPicker\EmojiParser;
 *   $parser = EmojiParser::fromJsonFile(__DIR__ . '/dist/emoji-list.json', [
 *       'basePath' => '/images/emoji',
 *       'className' => 'comment-emoji'
 *   ]);
 *   echo $parser->parse($commentText);
 */
declare(strict_types=1);

namespace MkEmojiPicker;

final class EmojiParser
{
    /** 与前端 SKIP_TAGS 保持一致：这些标签整块不参与替换。 */
    private const SKIP_TAGS = 'script|style|noscript|iframe|textarea|select|title|pre|code';

    /** @var array<int,array<string,mixed>> */
    private $rules = [];
    /** @var string */
    private $basePath;
    /** @var bool */
    private $escape;
    /** @var string[] */
    private $classNames;

    /**
     * @param array<int,array<string,mixed>> $groups  icons 分组配置
     * @param array<string,mixed>            $options basePath / escape / className / icons
     */
    public function __construct(array $groups, array $options = [])
    {
        $this->basePath = isset($options['basePath']) ? (string) $options['basePath'] : '';
        $this->escape = !array_key_exists('escape', $options) || (bool) $options['escape'];
        $this->classNames = self::normalizeClasses($options['className'] ?? null);
        if (isset($options['icons']) && is_array($options['icons'])) {
            $groups = array_values($options['icons']);
        }
        $this->rules = $this->compile($groups);
    }

    /** @param array<string,mixed> $options */
    public static function fromJsonFile(string $path, array $options = []): self
    {
        $json = @file_get_contents($path);
        if ($json === false) {
            throw new \RuntimeException('[mk-emoji-picker] 无法读取配置: ' . $path);
        }
        return self::fromJson($json, $options);
    }

    /** @param array<string,mixed> $options */
    public static function fromJson(string $json, array $options = []): self
    {
        $data = json_decode($json, true);
        if (!is_array($data) || !isset($data['groups']) || !is_array($data['groups'])) {
            throw new \RuntimeException('[mk-emoji-picker] 配置格式错误，缺少 groups');
        }
        return new self(array_values($data['groups']), $options);
    }

    /**
     * 把表情代码转换成 <img>。
     * escape=true（默认）：输入按纯文本处理，非表情内容一律 HTML 转义。
     * escape=false：输入按 HTML 片段处理，只替换标签外的文本，跳过敏感标签整块。
     */
    public function parse(string $text): string
    {
        if ($text === '' || !$this->rules) {
            return $this->escape ? self::esc($text) : $text;
        }
        if ($this->escape) {
            return $this->parseSegment($text);
        }

        $tokenizer = '~<(' . self::SKIP_TAGS . ')\b[^>]*>.*?</\1>|<[^>]*>~is';
        $matched = preg_match_all($tokenizer, $text, $tokens, PREG_OFFSET_CAPTURE);
        if ($matched === false || $matched === 0) {
            return $this->parseSegment($text);
        }

        $out = '';
        $cursor = 0;
        foreach ($tokens[0] as $token) {
            $offset = $token[1];
            if ($offset > $cursor) {
                $out .= $this->parseSegment(substr($text, $cursor, $offset - $cursor));
            }
            $out .= $token[0];
            $cursor = $offset + strlen($token[0]);
        }
        if ($cursor < strlen($text)) {
            $out .= $this->parseSegment(substr($text, $cursor));
        }
        return $out;
    }

    /** 在一个纯文本段里查找所有代码，去重后一次性替换。 */
    private function parseSegment(string $segment): string
    {
        if ($segment === '') {
            return '';
        }
        $hits = [];
        foreach ($this->rules as $rule) {
            $count = preg_match_all(
                $rule['regexp'],
                $segment,
                $matches,
                PREG_OFFSET_CAPTURE | PREG_SET_ORDER
            );
            if ($count === false || $count === 0) {
                continue;
            }
            foreach ($matches as $match) {
                $alias = '';
                for ($g = 1; $g <= $rule['aliasCount']; $g++) {
                    if (isset($match[$g]) && $match[$g][1] >= 0 && $match[$g][0] !== '') {
                        $alias = $match[$g][0];
                        break;
                    }
                }
                $file = call_user_func($rule['resolve'], $alias);
                if (!is_string($file) || $file === '') {
                    continue;
                }
                $hits[] = [
                    'start' => $match[0][1],
                    'end' => $match[0][1] + strlen($match[0][0]),
                    'alias' => $alias,
                    'file' => $file,
                    'rule' => $rule
                ];
            }
        }
        if (!$hits) {
            return $this->escape ? self::esc($segment) : $segment;
        }

        usort($hits, static function (array $a, array $b): int {
            if ($a['start'] !== $b['start']) {
                return $a['start'] <=> $b['start'];
            }
            $lenA = $a['end'] - $a['start'];
            $lenB = $b['end'] - $b['start'];
            if ($lenA !== $lenB) {
                return $lenB <=> $lenA;
            }
            return $a['rule']['order'] <=> $b['rule']['order'];
        });

        $out = '';
        $cursor = 0;
        foreach ($hits as $hit) {
            if ($hit['start'] < $cursor) {
                continue;
            }
            $out .= $this->text(substr($segment, $cursor, $hit['start'] - $cursor));
            $out .= $this->imgTag($hit);
            $cursor = $hit['end'];
        }
        $out .= $this->text(substr($segment, $cursor));
        return $out;
    }

    /** @param array<string,mixed> $hit */
    private function imgTag(array $hit): string
    {
        $rule = $hit['rule'];
        $alias = $hit['alias'];
        $class = 'mkep-smiley';
        if ($this->classNames) {
            $class .= ' ' . implode(' ', $this->classNames);
        }
        $html = '<img class="' . self::esc($class) . '"'
            . ' src="' . self::esc($rule['path'] . $hit['file'] . $rule['file']) . '"'
            . ' alt="' . self::esc($rule['named'] ? $alias : '') . '"'
            . ' loading="lazy" decoding="async"';
        if ($rule['named']) {
            $html .= ' title="' . self::esc($alias) . '"';
        }
        return $html . '>';
    }

    private function text(string $value): string
    {
        return $this->escape ? self::esc($value) : $value;
    }

    /** @param array<int,array<string,mixed>> $groups @return array<int,array<string,mixed>> */
    private function compile(array $groups): array
    {
        $rules = [];
        foreach (array_values($groups) as $order => $group) {
            if (!is_array($group)) {
                continue;
            }
            $groupPath = isset($group['path']) ? (string) $group['path'] : '';
            $placeholder = isset($group['placeholder']) ? (string) $group['placeholder'] : '';
            if ($groupPath === '' || !preg_match('/\{alias\}/i', $placeholder)) {
                continue;
            }

            $emoji = isset($group['emoji']) && is_array($group['emoji']) ? $group['emoji'] : null;
            $named = $emoji !== null;
            if ($named) {
                $names = [];
                foreach ($emoji as $name => $value) {
                    if (is_string($value) && $value !== '') {
                        $names[] = (string) $name;
                    }
                }
                // 长别名优先，避免「笑」抢先匹配掉「笑哭」
                usort($names, static function (string $a, string $b): int {
                    return strlen($b) <=> strlen($a);
                });
                if (!$names) {
                    continue;
                }
                $aliasSource = '(?:' . implode('|', array_map(static function (string $n): string {
                    return preg_quote($n, '/');
                }, $names)) . ')';
                $resolve = static function (string $alias) use ($emoji) {
                    return isset($emoji[$alias]) ? (string) $emoji[$alias] : null;
                };
            } else {
                $aliasSource = '\\d+';
                $resolve = static function (string $alias): string {
                    return $alias;
                };
            }

            $literals = preg_split('/\{alias\}/i', $placeholder);
            $source = '';
            $count = count($literals);
            for ($p = 0; $p < $count; $p++) {
                $source .= preg_quote($literals[$p], '/');
                if ($p < $count - 1) {
                    $source .= '(' . $aliasSource . ')';
                }
            }

            $rules[] = [
                'order' => $order,
                'regexp' => '/' . $source . '/u',
                'aliasCount' => $count - 1,
                'named' => $named,
                'resolve' => $resolve,
                'path' => self::joinPath($this->basePath, $groupPath),
                'file' => isset($group['file']) ? (string) $group['file'] : '.jpg'
            ];
        }
        return $rules;
    }

    private static function joinPath(string $base, string $path): string
    {
        if ($base === '') {
            return $path;
        }
        return rtrim($base, '/') . '/' . ltrim($path, '/');
    }

    /** @param mixed $value @return string[] */
    private static function normalizeClasses($value): array
    {
        $list = is_array($value) ? $value : [$value];
        $classes = [];
        foreach ($list as $item) {
            if (!is_string($item)) {
                continue;
            }
            foreach (preg_split('/\s+/u', trim($item)) ?: [] as $name) {
                if ($name !== '' && !in_array($name, $classes, true)) {
                    $classes[] = $name;
                }
            }
        }
        return $classes;
    }

    private static function esc(string $value): string
    {
        return strtr($value, [
            '&' => '&amp;',
            '<' => '&lt;',
            '>' => '&gt;',
            '"' => '&quot;',
            "'" => '&#39;'
        ]);
    }
}
