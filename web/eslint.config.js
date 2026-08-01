import eslint from '@eslint/js';

export default [
  eslint.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        HTMLElement: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        crypto: 'readonly',
        Blob: 'readonly',
        FormData: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        Audio: 'readonly',
        WebSocket: 'readonly',
        Worker: 'readonly',
        performance: 'readonly',
        history: 'readonly',
        location: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        satellite: 'readonly',
        maplibregl: 'readonly',
        Vue: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        DOMParser: 'readonly',
        CompressionStream: 'readonly',
        TextEncoder: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off',
      'eqeqeq': ['warn', 'smart'],
      'no-var': 'error',
      'prefer-const': 'warn',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'curly': 'off',
      'semi': ['warn', 'always'],
      'quotes': 'off',
      'indent': 'off',
      'no-trailing-spaces': 'off',
      'no-multiple-empty-lines': 'off',
      'comma-dangle': 'off',
      'eol-last': 'off'
    }
  },
  {
    ignores: ['node_modules/**', 'js/data/**']
  }
];