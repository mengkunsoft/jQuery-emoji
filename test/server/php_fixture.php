<?php
/** 后端一致性测试夹具：stdin 收 JSON，stdout 输出 parse 结果。 */
use MkEmojiPicker\EmojiParser;

require __DIR__ . '/../../server/php/EmojiParser.php';

$input = json_decode(stream_get_contents(STDIN), true);
if (!is_array($input)) {
    fwrite(STDERR, "invalid fixture input\n");
    exit(1);
}

$parser = EmojiParser::fromJsonFile(
    __DIR__ . '/../../dist/emoji-list.json',
    isset($input['options']) && is_array($input['options']) ? $input['options'] : []
);
echo $parser->parse(isset($input['text']) ? (string) $input['text'] : '');
