import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * mk-emoji-picker 后端解析器（Java 8+，零第三方依赖）。
 *
 * 与前端 parse() 使用同一份表情规则，把文本里的表情代码转换成 &lt;img&gt;。
 * 配置来自 dist/emoji-list.json（由 npm run build 生成）。
 *
 * <pre>
 * EmojiParser parser = EmojiParser.fromJson(Paths.get("dist/emoji-list.json"),
 *         Collections.singletonMap("basePath", "/images/emoji"));
 * String html = parser.parse(commentText);
 * </pre>
 *
 * 默认按纯文本处理（escape=true）；输入可信 HTML 时传 escape=false，
 * 只替换标签外文本并跳过 script/style 等敏感标签整块。
 * 本文件为单文件实现，可按项目需要添加 package 声明。
 */
public final class EmojiParser {

    private static final Pattern TOKEN = Pattern.compile(
            "<(script|style|noscript|iframe|textarea|select|title|pre|code)\\b[^>]*>.*?</\\1>|<[^>]*>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern ALIAS_SPLIT = Pattern.compile("\\{alias\\}", Pattern.CASE_INSENSITIVE);
    private static final Pattern HAS_ALIAS = Pattern.compile("(?s).*\\{alias\\}.*", Pattern.CASE_INSENSITIVE);

    private final boolean escape;
    private final List<String> classNames;
    private final List<Rule> rules;

    /** @param groups icons 分组配置 @param options basePath / escape / className / icons */
    public EmojiParser(List<Map<String, Object>> groups, Map<String, Object> options) {
        this.escape = !(option(options, "escape") instanceof Boolean) || (Boolean) option(options, "escape");
        this.classNames = normalizeClasses(option(options, "className"));
        Object override = option(options, "icons");
        String basePath = str(option(options, "basePath"));
        this.rules = compile(override instanceof List ? asMaps(override) : groups, basePath);
    }

    public static EmojiParser fromJson(Path file, Map<String, Object> options) throws IOException {
        return fromJson(new String(Files.readAllBytes(file), StandardCharsets.UTF_8), options);
    }

    public static EmojiParser fromJson(Path file) throws IOException {
        return fromJson(file, null);
    }

    public static EmojiParser fromJson(String json, Map<String, Object> options) {
        Map<String, Object> root = asMap(Json.parse(json));
        Object groups = root.get("groups");
        if (!(groups instanceof List)) {
            throw new IllegalArgumentException("[mk-emoji-picker] 配置格式错误，缺少 groups");
        }
        return new EmojiParser(asMaps(groups), options);
    }

    /** 把表情代码转换成 &lt;img&gt;，返回 HTML 片段。 */
    public String parse(String text) {
        if (text.isEmpty() || rules.isEmpty()) {
            return escape ? esc(text) : text;
        }
        if (escape) {
            return parseSegment(text);
        }

        Matcher matcher = TOKEN.matcher(text);
        StringBuilder out = new StringBuilder();
        int cursor = 0;
        while (matcher.find()) {
            if (matcher.start() > cursor) {
                out.append(parseSegment(text.substring(cursor, matcher.start())));
            }
            out.append(matcher.group());
            cursor = matcher.end();
        }
        if (cursor < text.length()) {
            out.append(parseSegment(text.substring(cursor)));
        }
        return out.toString();
    }

    private String parseSegment(String segment) {
        if (segment.isEmpty()) {
            return "";
        }
        List<Hit> hits = new ArrayList<>();
        for (Rule rule : rules) {
            Matcher matcher = rule.pattern.matcher(segment);
            while (matcher.find()) {
                String alias = "";
                for (int g = 1; g <= rule.aliasCount; g++) {
                    String value = matcher.group(g);
                    if (value != null && !value.isEmpty()) {
                        alias = value;
                        break;
                    }
                }
                String file = rule.resolve(alias);
                if (file == null || file.isEmpty()) {
                    continue;
                }
                hits.add(new Hit(matcher.start(), matcher.end(), alias, file, rule));
            }
        }
        if (hits.isEmpty()) {
            return escape ? esc(segment) : segment;
        }

        Collections.sort(hits, (a, b) -> {
            if (a.start != b.start) {
                return Integer.compare(a.start, b.start);
            }
            int lengthA = a.end - a.start;
            int lengthB = b.end - b.start;
            if (lengthA != lengthB) {
                return Integer.compare(lengthB, lengthA);
            }
            return Integer.compare(a.rule.order, b.rule.order);
        });

        StringBuilder out = new StringBuilder();
        int cursor = 0;
        for (Hit hit : hits) {
            if (hit.start < cursor) {
                continue;
            }
            out.append(text(segment.substring(cursor, hit.start)));
            out.append(imgTag(hit));
            cursor = hit.end;
        }
        out.append(text(segment.substring(cursor)));
        return out.toString();
    }

    private String imgTag(Hit hit) {
        StringBuilder className = new StringBuilder("mkep-smiley");
        for (String name : classNames) {
            className.append(' ').append(name);
        }
        StringBuilder html = new StringBuilder();
        html.append("<img class=\"").append(esc(className.toString())).append('"');
        html.append(" src=\"").append(esc(hit.rule.path + hit.file + hit.rule.file)).append('"');
        html.append(" alt=\"").append(esc(hit.rule.named ? hit.alias : "")).append('"');
        html.append(" loading=\"lazy\" decoding=\"async\"");
        if (hit.rule.named) {
            html.append(" title=\"").append(esc(hit.alias)).append('"');
        }
        return html.append('>').toString();
    }

    private String text(String value) {
        return escape ? esc(value) : value;
    }

    private static List<Rule> compile(List<Map<String, Object>> groups, String basePath) {
        List<Rule> rules = new ArrayList<>();
        for (int order = 0; order < groups.size(); order++) {
            Map<String, Object> group = groups.get(order);
            String groupPath = str(group.get("path"));
            String placeholder = str(group.get("placeholder"));
            if (groupPath.isEmpty() || !HAS_ALIAS.matcher(placeholder).matches()) {
                continue;
            }

            Object emojiRaw = group.get("emoji");
            Map<String, Object> emoji = emojiRaw instanceof Map ? asMap(emojiRaw) : null;
            boolean named = emoji != null;
            String aliasSource;
            if (named) {
                List<String> names = new ArrayList<>();
                for (Map.Entry<String, Object> entry : emoji.entrySet()) {
                    Object value = entry.getValue();
                    if (value instanceof String && !((String) value).isEmpty()) {
                        names.add(entry.getKey());
                    }
                }
                // 长别名优先，避免「笑」抢先匹配掉「笑哭」
                names.sort((a, b) -> Integer.compare(b.length(), a.length()));
                if (names.isEmpty()) {
                    continue;
                }
                List<String> quoted = new ArrayList<>();
                for (String name : names) {
                    quoted.add(Pattern.quote(name));
                }
                aliasSource = "(?:" + String.join("|", quoted) + ")";
            } else {
                aliasSource = "\\d+";
            }

            String[] literals = ALIAS_SPLIT.split(placeholder, -1);
            StringBuilder source = new StringBuilder();
            for (int p = 0; p < literals.length; p++) {
                source.append(Pattern.quote(literals[p]));
                if (p < literals.length - 1) {
                    source.append('(').append(aliasSource).append(')');
                }
            }
            Rule rule = new Rule();
            rule.pattern = Pattern.compile(source.toString());
            rule.order = order;
            rule.aliasCount = literals.length - 1;
            rule.named = named;
            rule.emoji = emoji;
            rule.path = joinPath(basePath, groupPath);
            rule.file = group.get("file") == null ? ".jpg" : str(group.get("file"));
            rules.add(rule);
        }
        return rules;
    }

    private static String joinPath(String base, String path) {
        if (base.isEmpty()) {
            return path;
        }
        int end = base.length();
        while (end > 0 && base.charAt(end - 1) == '/') {
            end--;
        }
        int start = 0;
        while (start < path.length() && path.charAt(start) == '/') {
            start++;
        }
        return base.substring(0, end) + "/" + path.substring(start);
    }

    private static List<String> normalizeClasses(Object value) {
        List<?> list = value instanceof List ? (List<?>) value : Collections.singletonList(value);
        List<String> classes = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof String)) {
                continue;
            }
            String trimmed = ((String) item).trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            for (String name : trimmed.split("\\s+")) {
                if (!name.isEmpty() && !classes.contains(name)) {
                    classes.add(name);
                }
            }
        }
        return classes;
    }

    private static String esc(String value) {
        StringBuilder out = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '&': out.append("&amp;"); break;
                case '<': out.append("&lt;"); break;
                case '>': out.append("&gt;"); break;
                case '"': out.append("&quot;"); break;
                case '\'': out.append("&#39;"); break;
                default: out.append(c);
            }
        }
        return out.toString();
    }

    private static Object option(Map<String, Object> options, String key) {
        return options == null ? null : options.get(key);
    }

    private static String str(Object value) {
        return value instanceof String ? (String) value : (value == null ? "" : String.valueOf(value));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        if (!(value instanceof Map)) {
            throw new IllegalArgumentException("[mk-emoji-picker] 配置节点应为对象");
        }
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> asMaps(Object value) {
        List<?> raw = (List<?>) value;
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : raw) {
            result.add(asMap(item));
        }
        return result;
    }

    private static final class Rule {
        Pattern pattern;
        int order;
        int aliasCount;
        boolean named;
        Map<String, Object> emoji;
        String path;
        String file;

        String resolve(String alias) {
            if (!named) {
                return alias;
            }
            Object value = emoji.get(alias);
            return value instanceof String ? (String) value : null;
        }
    }

    private static final class Hit {
        final int start;
        final int end;
        final String alias;
        final String file;
        final Rule rule;

        Hit(int start, int end, String alias, String file, Rule rule) {
            this.start = start;
            this.end = end;
            this.alias = alias;
            this.file = file;
            this.rule = rule;
        }
    }

    /**
     * 精简 JSON 读取器：只用于解析本库生成的 emoji-list.json，
     * 避免后端引入 Jackson / Gson 等第三方依赖。可供调用方复用。
     */
    public static final class Json {
        private final String source;
        private int pos;

        private Json(String source) {
            this.source = source;
        }

        public static Object parse(String json) {
            Json reader = new Json(json);
            reader.skipWhitespace();
            Object value = reader.value();
            reader.skipWhitespace();
            if (reader.pos != json.length()) {
                throw reader.error("JSON 结尾有多余内容");
            }
            return value;
        }

        private Object value() {
            skipWhitespace();
            if (pos >= source.length()) {
                throw error("JSON 意外结束");
            }
            char c = source.charAt(pos);
            switch (c) {
                case '{': return object();
                case '[': return array();
                case '"': return string();
                case 't': literal("true"); return Boolean.TRUE;
                case 'f': literal("false"); return Boolean.FALSE;
                case 'n': literal("null"); return null;
                default: return number();
            }
        }

        private Map<String, Object> object() {
            pos++;
            Map<String, Object> map = new LinkedHashMap<>();
            skipWhitespace();
            if (peek() == '}') {
                pos++;
                return map;
            }
            while (true) {
                skipWhitespace();
                String key = string();
                skipWhitespace();
                if (next() != ':') {
                    throw error("对象缺少 ':'");
                }
                map.put(key, value());
                skipWhitespace();
                char c = next();
                if (c == '}') {
                    return map;
                }
                if (c != ',') {
                    throw error("对象缺少 ','");
                }
            }
        }

        private List<Object> array() {
            pos++;
            List<Object> list = new ArrayList<>();
            skipWhitespace();
            if (peek() == ']') {
                pos++;
                return list;
            }
            while (true) {
                list.add(value());
                skipWhitespace();
                char c = next();
                if (c == ']') {
                    return list;
                }
                if (c != ',') {
                    throw error("数组缺少 ','");
                }
            }
        }

        private String string() {
            if (next() != '"') {
                throw error("期望字符串");
            }
            StringBuilder out = new StringBuilder();
            while (pos < source.length()) {
                char c = source.charAt(pos++);
                if (c == '"') {
                    return out.toString();
                }
                if (c != '\\') {
                    out.append(c);
                    continue;
                }
                char escaped = source.charAt(pos++);
                switch (escaped) {
                    case '"': out.append('"'); break;
                    case '\\': out.append('\\'); break;
                    case '/': out.append('/'); break;
                    case 'b': out.append('\b'); break;
                    case 'f': out.append('\f'); break;
                    case 'n': out.append('\n'); break;
                    case 'r': out.append('\r'); break;
                    case 't': out.append('\t'); break;
                    case 'u':
                        out.append((char) Integer.parseInt(source.substring(pos, pos + 4), 16));
                        pos += 4;
                        break;
                    default: throw error("非法转义 \\" + escaped);
                }
            }
            throw error("字符串未闭合");
        }

        private Object number() {
            int start = pos;
            while (pos < source.length() && "-+.eE0123456789".indexOf(source.charAt(pos)) >= 0) {
                pos++;
            }
            if (start == pos) {
                throw error("非法值");
            }
            return Double.valueOf(source.substring(start, pos));
        }

        private void literal(String word) {
            if (!source.regionMatches(pos, word, 0, word.length())) {
                throw error("期望 " + word);
            }
            pos += word.length();
        }

        private char peek() {
            return pos < source.length() ? source.charAt(pos) : '\0';
        }

        private char next() {
            if (pos >= source.length()) {
                throw error("JSON 意外结束");
            }
            return source.charAt(pos++);
        }

        private void skipWhitespace() {
            while (pos < source.length() && Character.isWhitespace(source.charAt(pos))) {
                pos++;
            }
        }

        private IllegalArgumentException error(String message) {
            return new IllegalArgumentException("[mk-emoji-picker] JSON 解析失败 @" + pos + ": " + message);
        }
    }
}
