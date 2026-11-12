// craco.config.js — adds the "@/..." import alias on top of Create React App.
const path = require('path');

module.exports = {
  eslint: {
    configure: {
      extends: ['plugin:react-hooks/recommended'],
      rules: {
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  jest: {
    configure: (jestConfig) => ({
      ...jestConfig,
      moduleNameMapper: {
        ...(jestConfig.moduleNameMapper || {}),
        '^@/(.*)$': '<rootDir>/src/$1',
        // axios's default entry is ESM, which CRA's Jest does not transform; use its CommonJS build.
        '^axios$': 'axios/dist/node/axios.cjs',
        // react-router 7 publishes through "exports", which CRA's Jest (27) cannot read.
        '^react-router-dom$': '<rootDir>/node_modules/react-router-dom/dist/index.js',
        '^react-router$': '<rootDir>/node_modules/react-router/dist/development/index.js',
        '^react-router/dom$': '<rootDir>/node_modules/react-router/dist/development/dom-export.js',
      },
    }),
  },
};
