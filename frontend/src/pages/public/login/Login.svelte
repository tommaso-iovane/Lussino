<script>
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import Loader from '../../../shared/components/Loader.svelte';
	import { login } from '../../../shared/services/auth.js';
	import { toast } from '../../../shared/services/toast.js';
    import { setUser } from '../../../shared/stores/user.store'
    import { navigate } from '../../../shared/classes/Router'

	// Form state
	let username = $state('');
	let password = $state('');
	let isLoading = $state(false);
	let errors = $state({ username: '', password: '' });

	/**
	 * Validate form inputs
	 */
	function validateForm() {
		const newErrors = { username: '', password: '' };

		if (!username.trim()) {
			newErrors.username = 'Username is required';
		} else if (username.trim().length < 2) {
			newErrors.username = 'Username must be at least 2 characters';
		}

		if (!password) {
			newErrors.password = 'Password is required';
		} else if (password.length < 4) {
			newErrors.password = 'Password must be at least 4 characters';
		}

		errors = newErrors;
		return !newErrors.username && !newErrors.password;
	}

	/**
	 * Handle form submission
	 */
	async function handleSubmit(event) {
		event.preventDefault();
		
		// Clear previous errors
		errors = { username: '', password: '' };

		// Validate form
		if (!validateForm()) {
			return;
		}

		isLoading = true;

		try {
			const result = await login(username.trim(), password);

			if (result.error) {
				// Error toast is already shown by the HTTP service
				return;
			}

			// Success!
			toast.success(`Welcome back, ${result.user.username}!`);
			
			// TODO: Redirect to dashboard or emit event
			console.log('Login successful:', result);
            setUser(result.user)
            navigate('/home')
			
		} catch (error) {
			console.error('Login error:', error);
			toast.error('An unexpected error occurred');
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Clear error for specific field
	 */
	function clearError(field) {
		if (field === 'username') {
			errors = { ...errors, username: '' };
		} else if (field === 'password') {
			errors = { ...errors, password: '' };
		}
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
	<div 
		class="w-full max-w-md"
		in:fly={{ y: 20, duration: 400, delay: 100, easing: quintOut }}
	>
		<!-- Logo/Brand Section -->
		<div class="text-center mb-8">
			<div 
				class="inline-flex items-center justify-center w-16 h-16 bg-white dark:bg-gray-700 rounded-2xl mb-4 shadow-medium overflow-hidden"
				in:fade={{ duration: 600, delay: 200 }}
			>
				<img src="/logo.png" alt="Lussino Logo" class="w-full h-full object-contain" />
			</div>
			<h1 class="text-3xl font-bold text-primary-900 dark:text-primary-100 mb-2">Lussino</h1>
			<p class="text-secondary-600 dark:text-gray-300">Container vulnerability management platform</p>
		</div>

		<!-- Login Card -->
		<div 
			class="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg dark:shadow-2xl border border-gray-200 dark:border-gray-700"
			in:fade={{ duration: 500, delay: 300 }}
		>
			<div class="mb-6">
				<h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Welcome back</h2>
				<p class="text-secondary-600 dark:text-gray-300">Sign in to your account to continue</p>
			</div>

			<!-- Login Form -->
			<form onsubmit={handleSubmit} class="space-y-6">
				<!-- Username Field -->
				<div>
					<label for="username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Username
					</label>
					<input
						id="username"
						type="text"
						bind:value={username}
						oninput={() => clearError('username')}
						class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
						class:border-error-500={errors.username}
						class:focus:ring-error-500={errors.username}
						class:focus:border-error-500={errors.username}
						placeholder="Enter your username"
						disabled={isLoading}
						autocomplete="username"
						required
					/>
					{#if errors.username}
						<p class="mt-1 text-sm text-red-600 dark:text-red-400" in:fade={{ duration: 200 }}>
							{errors.username}
						</p>
					{/if}
				</div>

				<!-- Password Field -->
				<div>
					<label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
						Password
					</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						oninput={() => clearError('password')}
						class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
						class:border-error-500={errors.password}
						class:focus:ring-error-500={errors.password}
						class:focus:border-error-500={errors.password}
						placeholder="Enter your password"
						disabled={isLoading}
						autocomplete="current-password"
						required
					/>
					{#if errors.password}
						<p class="mt-1 text-sm text-red-600 dark:text-red-400" in:fade={{ duration: 200 }}>
							{errors.password}
						</p>
					{/if}
				</div>

				<!-- Submit Button -->
				<button
					type="submit"
					class="w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
					disabled={isLoading}
				>
					{#if isLoading}
						<div class="flex items-center justify-center gap-3">
							<Loader size="sm" variant="spinner" show={true} />
							<span>Signing in...</span>
						</div>
					{:else}
						Sign in
					{/if}
				</button>
			</form>

			<!-- Additional Links -->
			<div class="mt-6 text-center">
				<p class="text-sm text-secondary-600 dark:text-gray-400">
					Forgot your password? 
					<button class="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
						Contact administrator
					</button>
				</p>
			</div>
		</div>

		<!-- Footer -->
		<div class="text-center mt-8">
			<p class="text-sm text-secondary-500 dark:text-gray-400">
				© 2025 Lussino Security. Container security made simple.
			</p>
		</div>
	</div>
</div>