module.exports = {
  env: {
    es2021: true,
    node: true,
  },
  extends: 'airbnb-base',
  overrides: [
    {
      env: {
        node: true,
      },
      files: ['.eslintrc.{js,cjs}'],
      parserOptions: {
        sourceType: 'script',
      },
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'object-curly-newline': [
      'error',
      {
        consistent: true,
      },
    ],
    'no-console': ['error', { allow: ['warn', 'error', 'info', 'debug'] }],
    'import/extensions': 'off',
    'import/prefer-default-export': 'off',
  },
};
