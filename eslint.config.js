import globals from 'globals';

export default [
    {
        ignores: [
            'dist/**',
            'images/**',
            'lib/**',
            'node_modules/**',
            'coverage/**',
            'wordpress/mk-emoji-picker/**'
        ]
    },
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                __MK_EMOJI_PICKER_VERSION__: 'readonly'
            }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-var': 'error',
            'prefer-const': 'error',
            eqeqeq: ['error', 'always']
        }
    }
];
