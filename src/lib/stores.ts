import { browser } from '$app/environment';
import { writable, type Writable } from 'svelte/store';

function fromLocalStorage<T>(key: string, initialValue: T): () => T {
	if (browser) {
		const stored = window.localStorage.getItem(key);
		if (stored) {
			return () => JSON.parse(stored);
		}
	}
	return () => initialValue;
}

function toLocalStorage<T>(store: Writable<T>, key: string): void {
	if (browser) {
		store.subscribe((value) => {
			const json = JSON.stringify(value);

			window.localStorage.setItem(key, json);
		});
	}
}

export const uiBlock = writable<boolean>(true);
export const errorMessage = writable<string>();

function getInitialDarkMode(): boolean {
	if (browser) {
		const stored = window.localStorage.getItem('darkMode');
		if (stored !== null) return JSON.parse(stored);
		return window.matchMedia('(prefers-color-scheme: dark)').matches;
	}
	return false;
}

export const darkMode = writable<boolean>(getInitialDarkMode());

if (browser) {
	darkMode.subscribe((value) => {
		window.localStorage.setItem('darkMode', JSON.stringify(value));
		if (value) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	});
}
