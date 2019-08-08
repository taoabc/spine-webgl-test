module.exports = {
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    indent: "off", // note you must disable the base rule as it can report incorrect errors
    '@typescript-eslint/indent': ['error', 2],
    quotes: ['error', 'single']
  }
}