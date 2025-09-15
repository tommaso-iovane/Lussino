<script>
	import ThemeToggle from '../../../shared/components/ThemeToggle.svelte';
	import { changePassword } from '../../../shared/services/auth.js';
	import { navigate } from '../../../shared/classes/Router.js';

	// State variables  
	let passwordForm = $state({
		currentPassword: '',
		newPassword: '',
		confirmPassword: ''
	});

	let isLoading = $state(false);
	let message = $state('');
	let messageType = $state(''); // 'success' or 'error'
	let showPasswords = $state(false);

	// Password validation - simplified
	let passwordValidation = $state({
		passwordsMatch: false
	});

	/**
	 * Validate password requirements
	 */
	function validatePassword() {
		const { newPassword, confirmPassword } = passwordForm;
		passwordValidation.passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
	}

	/**
	 * Check if password form is valid
	 */
	function isPasswordFormValid() {
		return passwordValidation.passwordsMatch && 
			   passwordForm.currentPassword.length > 0 &&
			   passwordForm.newPassword.length > 0;
	}

	/**
	 * Handle password change
	 */
	async function handlePasswordChange() {
		if (!isPasswordFormValid()) {
			showMessage('Please fix the validation errors before submitting', 'error');
			return;
		}

		isLoading = true;
		message = '';

		try {
			await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
			
			showMessage('Password changed successfully!', 'success');
			// Reset form
			passwordForm = {
				currentPassword: '',
				newPassword: '',
				confirmPassword: ''
			};
			passwordValidation = {
				passwordsMatch: false
			};
		} catch (error) {
			console.error('Error changing password:', error);
			showMessage(error.message || 'Failed to change password', 'error');
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Show message with auto-hide
	 */
	function showMessage(text, type) {
		message = text;
		messageType = type;
		setTimeout(() => {
			message = '';
			messageType = '';
		}, 5000);
	}

	/**
	 * Toggle password visibility
	 */
	function togglePasswordVisibility() {
		showPasswords = !showPasswords;
	}

	// Reactive updates for password validation
	$effect(() => {
		validatePassword();
	});
</script>

<div class="min-h-screen bg-gray-50 py-8 dark:bg-gray-900">
    <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <!-- Header -->
        <div class="mb-8">
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <button
                        onclick={() => navigate('/')}
                        class="mr-4 inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 transition-colors duration-200"
                    >
                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                        </svg>
                        Back to Dashboard
                    </button>
                    <div>
                        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Change Password</h1>
                        <p class="mt-2 text-gray-600 dark:text-gray-400">Update your password to keep your account secure</p>
                    </div>
                </div>
                <ThemeToggle />
            </div>
        </div>

        <!-- Change Password Card -->
        <div class="rounded-lg bg-white shadow-lg dark:bg-gray-800">
            <div class="border-b border-gray-200 px-6 py-5 dark:border-gray-700">
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Change Password</h2>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Update your password to keep your account secure</p>
            </div>

            <form onsubmit={(e) => { e.preventDefault(); handlePasswordChange(); }} class="px-6 py-5">
                <!-- Message Display -->
                {#if message}
                    <div
                        class="mb-6 rounded-md p-4 {messageType === 'success'
                            ? 'border border-green-200 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'border border-red-200 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300'}"
                    >
                        <div class="flex">
                            <div class="flex-shrink-0">
                                {#if messageType === 'success'}
                                    <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path
                                            fill-rule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                            clip-rule="evenodd"
                                        />
                                    </svg>
                                {:else}
                                    <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path
                                            fill-rule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                            clip-rule="evenodd"
                                        />
                                    </svg>
                                {/if}
                            </div>
                            <div class="ml-3">
                                <p class="text-sm font-medium">{message}</p>
                            </div>
                        </div>
                    </div>
                {/if}

                <div class="space-y-6">
                    <!-- Current Password -->
                    <div>
                        <label for="currentPassword" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Current Password
                        </label>
                        <div class="relative">
                            <input
                                type={showPasswords ? 'text' : 'password'}
                                id="currentPassword"
                                bind:value={passwordForm.currentPassword}
                                class="block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                placeholder="Enter your current password"
                                required
                            />
                        </div>
                    </div>

                    <!-- New Password -->
                    <div>
                        <label for="newPassword" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            New Password
                        </label>
                        <div class="relative">
                            <input
                                type={showPasswords ? 'text' : 'password'}
                                id="newPassword"
                                bind:value={passwordForm.newPassword}
                                class="block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                placeholder="Enter your new password"
                                required
                            />
                        </div>
                    </div>

                    <!-- Confirm Password -->
                    <div>
                        <label for="confirmPassword" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Confirm New Password
                        </label>
                        <div class="relative">
                            <input
                                type={showPasswords ? 'text' : 'password'}
                                id="confirmPassword"
                                bind:value={passwordForm.confirmPassword}
                                class="block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                placeholder="Confirm your new password"
                                required
                            />
                        </div>
                    </div>

                    <!-- Show/Hide Passwords Toggle -->
                    <div class="flex items-center">
                        <input
                            type="checkbox"
                            id="showPasswords"
                            bind:checked={showPasswords}
                            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                        />
                        <label for="showPasswords" class="ml-2 block text-sm text-gray-700 dark:text-gray-300"> Show passwords </label>
                    </div>

                    <!-- Submit Button -->
                    <div class="flex justify-end">
                        <button
                            type="submit"
                            disabled={!isPasswordFormValid() || isLoading}
                            class="rounded-md border border-transparent bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-800"
                        >
                            {#if isLoading}
                                <svg
                                    class="-ml-1 mr-3 inline h-4 w-4 animate-spin text-white"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path
                                        class="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                </svg>
                                Changing Password...
                            {:else}
                                Change Password
                            {/if}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>
</div>
