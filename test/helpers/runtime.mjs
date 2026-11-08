/** 查找本机可用的 PHP CLI；找不到返回 null。 */
import { execFileSync } from 'node:child_process';

export function findPhp() {
    const candidates = [
        process.env.PHP_PATH,
        'php',
        'D:/phpEnv/php/php-8.2/php.exe',
        'D:/phpEnv/php/php-8.0/php.exe',
        process.platform === 'win32' ? 'C:/php/php.exe' : '/usr/bin/php'
    ].filter(Boolean);
    for (const cmd of candidates) {
        try {
            execFileSync(cmd, ['-v'], { stdio: 'ignore' });
            return cmd;
        } catch {
            // 继续尝试下一个
        }
    }
    return null;
}
