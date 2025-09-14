<script>
    import Loader from './shared/components/Loader.svelte'
    import { getLoggedUser } from './shared/services/auth'
    import { setUser } from './shared/stores/user.store'

    let Router = $state()

    const init = async () => {
        Router = (await import('./pages/Router.svelte')).default

        const loggedUser = await getLoggedUser()

        if (loggedUser?.user) {
            setUser(loggedUser.user)
        }
    }
</script>

{#await init()}
    <div class="absolute left-[calc(50%-1.25rem)] top-[calc(50%-1.25rem)]">
        <Loader size="lg"></Loader>
    </div>
{:then}
    <Router></Router>
{:catch}
    System Maintenance
{/await}
