<script>
    import Router, { navigate } from '../shared/classes/Router'
    import { setRouterParams } from '../shared/stores/router-params.store'
    import { getUser } from '../shared/stores/user.store'


    let Page = $state()

    const parse = (activeRoute, next) => {
        setRouterParams(activeRoute)
        next()
    }

    const isLogged = (_activeRoute, next) => {
        const user = getUser()
        if (!user) {
            return navigate('/login')
        }
        next()
    }

    const routes = {
        '/': [() => navigate('/home')],

        // public routes
        '/login': [async () => (Page = (await import('@/pages/public/login/Login.svelte')).default)],


        // private routes
        '/home': [isLogged, async () => (Page = (await import('@/pages/private/home/Home.svelte')).default)],
        '/profile': [isLogged, async () => (Page = (await import('@/pages/private/profile/Profile.svelte')).default)],

        '/container/:containerid': [isLogged, async () => (Page = (await import('@/pages/private/container/Container.svelte')).default)],
    }

    new Router({ routes, globalPreFunctions: [parse] })
</script>

<Page />