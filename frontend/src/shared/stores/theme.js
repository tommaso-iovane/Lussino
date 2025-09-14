/**
 * Theme store for managing dark/light mode
 */
import { writable } from 'svelte/store';

// Check if we're in the browser
const browser = typeof window !== 'undefined';

// Check for saved theme preference or default to 'light'
function getInitialTheme() {
	if (!browser) return 'light';
	
	// Check localStorage first
	const saved = localStorage.getItem('theme');
	if (saved) return saved;
	
	// Check system preference
	if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
		return 'dark';
	}
	
	return 'light';
}

// Create the theme store
export const theme = writable(getInitialTheme());

// Apply theme to document
export function applyTheme(newTheme) {
	if (!browser) return;
	
	const root = document.documentElement;
	
	if (newTheme === 'dark') {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}
	
	// Save to localStorage
	localStorage.setItem('theme', newTheme);
}

// Toggle theme function
export function toggleTheme() {
	theme.update(currentTheme => {
		const newTheme = currentTheme === 'light' ? 'dark' : 'light';
		applyTheme(newTheme);
		return newTheme;
	});
}

// Initialize theme on load
if (browser) {
	theme.subscribe(applyTheme);
	
	// Listen for system theme changes
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
		if (!localStorage.getItem('theme')) {
			const newTheme = e.matches ? 'dark' : 'light';
			theme.set(newTheme);
		}
	});
}