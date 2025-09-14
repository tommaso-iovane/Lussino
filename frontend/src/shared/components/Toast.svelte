<!--
@component
Modern toast notification system for displaying error and success messages.
Designed to match the app's minimalistic style.

Usage:
```svelte
import { showToast } from '../services/toast.js';

// Show error toast
showToast('Something went wrong', 'error');

// Show success toast  
showToast('Container scan completed', 'success');
```
-->

<script>
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { toasts } from '../services/toast.js';

	/**
	 * Remove a toast by its ID
	 * @param {string} id - Toast ID to remove
	 */
	function removeToast(id) {
		toasts.update(items => items.filter(item => item.id !== id));
	}

	/**
	 * Get icon for toast type
	 * @param {string} type - Toast type
	 */
	function getIcon(type) {
		switch (type) {
			case 'success': return '✓';
			case 'error': return '✕';
			case 'warning': return '⚠';
			case 'info': return 'ℹ';
			default: return 'ℹ';
		}
	}

	/**
	 * Get styles for toast type
	 * @param {string} type - Toast type
	 */
	function getToastClasses(type) {
		const baseClasses = 'flex items-center gap-3 px-4 py-3 rounded-lg shadow-medium max-w-md min-w-80';
		
		switch (type) {
			case 'success':
				return `${baseClasses} bg-success-50 border border-success-200 text-success-800`;
			case 'error':
				return `${baseClasses} bg-error-50 border border-error-200 text-error-800`;
			case 'warning':
				return `${baseClasses} bg-warning-50 border border-warning-200 text-warning-800`;
			case 'info':
			default:
				return `${baseClasses} bg-primary-50 border border-primary-200 text-primary-800`;
		}
	}

	/**
	 * Get icon styles for toast type
	 * @param {string} type - Toast type
	 */
	function getIconClasses(type) {
		const baseClasses = 'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold';
		
		switch (type) {
			case 'success':
				return `${baseClasses} bg-success-600 text-white`;
			case 'error':
				return `${baseClasses} bg-error-600 text-white`;
			case 'warning':
				return `${baseClasses} bg-warning-600 text-white`;
			case 'info':
			default:
				return `${baseClasses} bg-primary-600 text-white`;
		}
	}
</script>

<!-- Toast Container -->
{#if $toasts.length > 0}
	<div class="fixed top-4 right-4 z-50 space-y-2">
		{#each $toasts as toast (toast.id)}
			<div
				class={getToastClasses(toast.type)}
				in:fly={{ x: 300, duration: 300, easing: quintOut }}
				out:fly={{ x: 300, duration: 200, easing: quintOut }}
			>
				<!-- Icon -->
				<div class={getIconClasses(toast.type)}>
					{getIcon(toast.type)}
				</div>

				<!-- Message -->
				<div class="flex-1 font-medium">
					{toast.message}
				</div>

				<!-- Close Button -->
				<button
					class="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 transition-colors"
					onclick={() => removeToast(toast.id)}
					aria-label="Close notification"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</div>
		{/each}
	</div>
{/if}