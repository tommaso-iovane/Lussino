function getCurrentPath() {
    return window.location.pathname
}

const customNavigation = (event, path) => {
    event.preventDefault()
    navigate(path)
}

export const sinlink = (element) => {
    const path = element.getAttribute('href')
    element.addEventListener('click', (event) => customNavigation(event, path))
}

export const navigate = (path) => {
    history.pushState({}, '', path)
}

class Router {
    activeRoute
    isSubRouter = false
    history = []

    /**
     * @constructor
     * Routes is an array of objects with the following structure:
     * ```javascript
     * {
     *      '/path/to': {
     *          functions: [Function[]],
     *          has_children: Boolean
     *      }
     *      // or
     *      'other-path': [Function[]]
     * }
     * ```
     * - functions determines what functions are going to be called when the relative path is matched
     * - has_children determines if there's another Router in the loaded page, if true functions will be called only the first time the path is matched. For example
     *
     * main has /example/*, /another-page
     *
     * child has /example/sub-page1, /example/sub-page2
     *
     * functions in /example/* are going to be called the first time i visit /example but not if i switch between sub-page1 and sub-page2. If i navigate to /another-page and then go back to /example/*, /example/* functions are going to be called again.
     *
     *
     * globalPreFunctions are called on every matched route before anything else
     *
     * globalPostFunctions are called on every matched route after everything
     *
     * @param {{routes, base?: string, globalPreFunctions?: Function[], globalPostFunctions?: Function[], isSubRouter?: Boolean}} param0
     */
    constructor({ routes, base = '', globalPreFunctions = [], globalPostFunctions = [], isSubRouter = false }) {
        this.window = window
        this.routes = routes
        this.base = base
        this.isSubRouter = isSubRouter
        this.globalPreFunctions = globalPreFunctions
        this.globalPostFunctions = globalPostFunctions

        // Bind handlePathChange to ensure the correct context
        this.handlePathChange = this.handlePathChange.bind(this)

        this.start()
    }

    start() {
        window.addEventListener('popstate', this.handlePathChange)
        window.addEventListener('hashchange', this.handlePathChange)

        const originalPushState = history.pushState
        history.pushState = (...args) => {
            originalPushState.apply(history, args)
            this.handlePathChange()
        }

        const originalReplaceState = history.replaceState
        history.replaceState = (...args) => {
            originalReplaceState.apply(history, args)
            this.handlePathChange()
        }

        this.handlePathChange()
    }

    handlePathChange() {
        this.matchRoute()
    }

    async matchRoute() {
        const path = getCurrentPath()
        const pathParts = path.split('/')

        let routeFunctions = null
        let foundRoute = null
        let has_children = false

        for (const routePath in this.routes) {
            const routeParts = (this.base + routePath).split('/')

            // skip routes with different length
            if (pathParts.length !== routeParts.length && !this.routes[routePath]?.has_children) {
                continue
            }

            let match = true

            for (let i = 0; i < routeParts.length; i++) {
                const routeToCheck = routeParts[i]
                const currentRoute = pathParts[i]

                if (routeToCheck.startsWith(':') || routeToCheck === '*') {
                    // match anything in this part
                    continue
                }
                if (routeToCheck === '**') {
                    // match anything in this part and every part coming next
                    break
                }
                if (routeToCheck !== currentRoute) {
                    match = false
                    break
                }
            }
            if (match) {
                foundRoute = routePath
                const matchedRoute = this.routes[routePath]

                // short version, funcions as array
                if (Array.isArray(matchedRoute)) {
                    has_children = false
                    routeFunctions = [...this.globalPreFunctions, ...matchedRoute, ...this.globalPostFunctions]
                } else {
                    // extended versions, route is an object with multiple properties
                    if (matchedRoute.disabled) {
                        foundRoute = null
                    } else {
                        has_children = matchedRoute.has_children
                        routeFunctions = [...this.globalPreFunctions, ...matchedRoute.functions, ...this.globalPostFunctions]
                    }
                }

                break
            }
        }

        // if !foundRoute ans routes has __default load it
        // if this is a subrouter I need to make sure that path includes the subrouter base, otherwise the subrouters __default will run even if the subrouter is not active
        if (!foundRoute && this.routes.__default && (!this.isSubRouter || path.includes(this.base))) {
            const defaultRoute = this.routes.__default
            if (Array.isArray(defaultRoute)) {
                routeFunctions = [...this.globalPreFunctions, ...defaultRoute, ...this.globalPostFunctions]
            } else {
                routeFunctions = [...this.globalPreFunctions, ...defaultRoute.functions, ...this.globalPostFunctions]
            }
            foundRoute = '__default'
        }

        let runFunctions = true
        // if has_children and last route in history was the same has the current, dont execute functions
        if (has_children) {
            if (this.history.length && this.history[this.history.length - 1] === path) {
                runFunctions = false
            }
        }

        this.history.push(path)
        if (runFunctions && routeFunctions) {
            const params = {}
            let query = {}
            if (foundRoute) {
                // check if foundRoute has path parameters (:variable)
                const currentPathParts = path.split('/')
                const foundRouteParts = foundRoute.split('/')
                for (let i = 0; i < foundRouteParts.length; i++) {
                    const variableName = foundRouteParts[i]
                    if (variableName.startsWith(':')) {
                        params[variableName.replace(':', '')] = currentPathParts[i] || null
                    }
                }
            }

            // read get parameters
            const url = window.location.href
            if (url.includes('?')) {
                const urlParams = new URLSearchParams(url.substring(url.indexOf('?')))
                query = Object.fromEntries(urlParams.entries())
            }

            this.activeRoute = {
                path,
                pathParts: path.substring(1).split('/'),
                params,
                query,
                previousPath: this.history[this.history.length - 2] || null
            }
            for (const fn of routeFunctions) {
                await this.runRouteFunction(fn)
            }
        }
    }

    runRouteFunction(fn) {
        return new Promise((resolve) => {
            const next = () => {
                resolve(true)
            }
            fn(this.activeRoute, next)
        })
    }
}

export default Router
