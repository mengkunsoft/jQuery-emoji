import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.util.Map;

/** 后端一致性测试夹具：stdin 收 JSON，stdout 输出 parse 结果。 */
public class JavaFixture {
    @SuppressWarnings("unchecked")
    public static void main(String[] args) throws Exception {
        StringBuilder input = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(System.in, StandardCharsets.UTF_8))) {
            char[] buffer = new char[4096];
            int count;
            while ((count = reader.read(buffer)) != -1) {
                input.append(buffer, 0, count);
            }
        }

        Map<String, Object> data = (Map<String, Object>) EmojiParser.Json.parse(input.toString());
        Object optionsRaw = data.get("options");
        Map<String, Object> options = optionsRaw instanceof Map
                ? (Map<String, Object>) optionsRaw : null;
        Object text = data.get("text");

        EmojiParser parser = EmojiParser.fromJson(Paths.get(args[0]), options);
        String result = parser.parse(text == null ? "" : String.valueOf(text));

        PrintStream out = new PrintStream(System.out, true, "UTF-8");
        out.print(result);
        out.flush();
    }
}
