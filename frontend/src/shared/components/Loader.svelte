<script>
    import { fade, scale } from 'svelte/transition'
    import { cubicOut } from 'svelte/easing'

    /**
     * Component props
     */
    let {
        /** Size variant of the loader */
        size = 'md',
        /** Visual variant of the loader */
        variant = 'spinner',
        /** Optional loading text to display */
        text = null,
        /** Show/hide the loader */
        show = true
    } = $props()

    // Size classes mapping
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    }

    const textSizeClasses = {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg'
    }
</script>

{#if show}
    <div
        class="flex flex-col items-center justify-center gap-3"
        in:fade={{ duration: 200, easing: cubicOut }}
        out:fade={{ duration: 150, easing: cubicOut }}
    >
        {#if variant === 'spinner'}
            <div class="relative {sizeClasses[size]}" in:scale={{ duration: 300, delay: 100, easing: cubicOut }}>
                <div class="border-primary-100 absolute inset-0 rounded-full border-2"></div>
                <div class="border-t-primary-600 absolute inset-0 animate-spin rounded-full border-2 border-transparent"></div>
            </div>
        {:else if variant === 'dots'}
            <div class="flex items-center gap-1">
                {#each Array(3) as _, i}
                    <div
                        class="bg-primary-600 dot-bounce rounded-full"
                        class:w-2={size === 'sm'}
                        class:h-2={size === 'sm'}
                        class:w-3={size === 'md'}
                        class:h-3={size === 'md'}
                        class:w-4={size === 'lg'}
                        class:h-4={size === 'lg'}
                        style="animation-delay: {i * 0.15}s"
                        in:scale={{ duration: 200, delay: i * 100, easing: cubicOut }}
                    ></div>
                {/each}
            </div>
        {:else if variant === 'pulse'}
            <div class="relative {sizeClasses[size]}">
                <div class="bg-primary-600 pulse-ring absolute inset-0 rounded-full"></div>
                <div class="bg-primary-600 pulse-ring absolute inset-0 rounded-full" style="animation-delay: 1s"></div>
                <div class="bg-primary-600 absolute inset-2 rounded-full" in:scale={{ duration: 300, easing: cubicOut }}></div>
            </div>
        {/if}

        {#if text}
            <p
                class="text-secondary-700 font-medium {textSizeClasses[size]} animate-pulse"
                in:fade={{ duration: 300, delay: 200, easing: cubicOut }}
            >
                {text}
            </p>
        {/if}
    </div>
{/if}

<style>
    /* Dot bounce animation */
    @keyframes dot-bounce {
        0%,
        80%,
        100% {
            transform: scale(0.8);
            opacity: 0.5;
        }
        40% {
            transform: scale(1);
            opacity: 1;
        }
    }

    .dot-bounce {
        animation: dot-bounce 1.4s infinite ease-in-out;
    }

    /* Pulse ring animation */
    @keyframes pulse-ring {
        0% {
            transform: scale(0.8);
            opacity: 0.8;
        }
        100% {
            transform: scale(2);
            opacity: 0;
        }
    }

    .pulse-ring {
        animation: pulse-ring 2s infinite ease-out;
    }

    /* Spinner animation is handled by Tailwind's animate-spin utility */
</style>
