import { get, writable } from 'svelte/store'

export const routerParams = writable(null)

export const setRouterParams = (value) => {
    routerParams.set(value)
}

export const getRouterParams = () => {
    return get(routerParams)
}

export default { routerParams, getRouterParams, setRouterParams }
