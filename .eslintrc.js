module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: 'google',
  overrides: [
    {
      env: {
        node: true,
      },
      files: ['.eslintrc.{js,cjs,ejs}'],
      parserOptions: {
        sourceType: 'script',
      },
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {},
};
