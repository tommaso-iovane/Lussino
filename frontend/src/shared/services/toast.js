import { writable } from 'svelte/store';

// Toast store to manage active toasts
export const toasts = writable([]);

/**
 * Generate unique ID for toasts
 */
function generateId() {
	return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {'success' | 'error' | 'warning' | 'info'} type - The type of toast
 * @param {number} duration - Duration in milliseconds (0 = no auto-dismiss)
 */
export function showToast(message, type = 'info', duration = 5000) {
	const id = generateId();
	
	const toast = {
		id,
		message,
		type,
		timestamp: Date.now()
	};

	// Add toast to store
	toasts.update(items => [...items, toast]);

	// Auto-dismiss after duration (if duration > 0)
	if (duration > 0) {
		setTimeout(() => {
			toasts.update(items => items.filter(item => item.id !== id));
		}, duration);
	}

	return id;
}

/**
 * Remove a specific toast
 * @param {string} id - Toast ID to remove
 */
export function dismissToast(id) {
	toasts.update(items => items.filter(item => item.id !== id));
}

/**
 * Clear all toasts
 */
export function clearAllToasts() {
	toasts.set([]);
}

/**
 * Convenience methods for specific toast types
 */
export const toast = {
	success: (message, duration = 4000) => showToast(message, 'success', duration),
	error: (message, duration = 6000) => showToast(message, 'error', duration),
	warning: (message, duration = 5000) => showToast(message, 'warning', duration),
	info: (message, duration = 4000) => showToast(message, 'info', duration),
};