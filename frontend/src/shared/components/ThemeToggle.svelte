<script>
	import { theme, toggleTheme } from '../stores/theme.js';

	// Component props
	let { size = 'md', variant = 'button' } = $props();

	// Size classes
	const sizeClasses = {
		sm: 'w-8 h-8',
		md: 'w-10 h-10',
		lg: 'w-12 h-12'
	};

	// Icon size classes
	const iconSizeClasses = {
		sm: 'w-4 h-4',
		md: 'w-5 h-5',
		lg: 'w-6 h-6'
	};
</script>

{#if variant === 'button'}
	<button
		onclick={toggleTheme}
		class="relative {sizeClasses[size]} rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
		aria-label="Toggle theme"
		title="Toggle theme"
	>
		<!-- Sun icon (visible in dark mode) -->
		<svg 
			class="{iconSizeClasses[size]} text-yellow-500 transition-all duration-200 {$theme === 'dark' ? 'rotate-0 opacity-100' : 'rotate-90 opacity-0'} absolute"
			fill="none" 
			stroke="currentColor" 
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
		</svg>
		
		<!-- Moon icon (visible in light mode) -->
		<svg 
			class="{iconSizeClasses[size]} text-gray-700 dark:text-gray-300 transition-all duration-200 {$theme === 'light' ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0'} absolute"
			fill="none" 
			stroke="currentColor" 
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
		</svg>
	</button>
{:else if variant === 'switch'}
	<button
		onclick={toggleTheme}
		class="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 dark:bg-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
		aria-label="Toggle theme"
		title="Toggle theme"
	>
		<span
			class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 {$theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}"
		></span>
		
		<!-- Sun icon inside switch -->
		<svg 
			class="w-3 h-3 text-yellow-500 absolute left-1.5 transition-opacity duration-200 {$theme === 'light' ? 'opacity-100' : 'opacity-0'}"
			fill="currentColor" 
			viewBox="0 0 24 24"
		>
			<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
		</svg>
		
		<!-- Moon icon inside switch -->
		<svg 
			class="w-3 h-3 text-gray-300 absolute right-1.5 transition-opacity duration-200 {$theme === 'dark' ? 'opacity-100' : 'opacity-0'}"
			fill="currentColor" 
			viewBox="0 0 24 24"
		>
			<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
		</svg>
	</button>
{/if}