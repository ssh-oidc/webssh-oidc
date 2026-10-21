import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				NodeJS: true
			},
			parserOptions: {
				sourceType: 'module',
				ecmaVersion: 2020
			}
		}
	},
	{
		rules: {
			// Auth.js provider configs intentionally use any for upstream profile types.
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', caughtErrors: 'none' }
			]
		}
	},
	{
		// The privacy policy is a static local file rendered with marked.
		files: ['src/lib/Markdown.svelte'],
		rules: {
			'svelte/no-at-html-tags': 'off'
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		ignores: ['*.cjs', '.svelte-kit/**', 'build/**', 'node_modules/**']
	}
);
