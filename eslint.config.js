const tsParser = require('@typescript-eslint/parser');
const ngTemplateParser = require('@angular-eslint/template-parser');
const ngTemplatePlugin = require('@angular-eslint/eslint-plugin-template');

const toWarn = (rules) =>
  Object.fromEntries(Object.keys(rules).map((ruleName) => [ruleName, 'warn']));

module.exports = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.angular/**',
      'coverage/**',
      'functions/**'
    ]
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest'
      }
    },
    rules: {}
  },
  {
    files: ['src/**/*.html'],
    languageOptions: {
      parser: ngTemplateParser
    },
    plugins: {
      '@angular-eslint/template': ngTemplatePlugin
    },
    rules: {
      ...toWarn(ngTemplatePlugin.configs.recommended.rules),
      ...toWarn(ngTemplatePlugin.configs.accessibility.rules)
    }
  }
];
