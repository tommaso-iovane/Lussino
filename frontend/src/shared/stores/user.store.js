import { get, writable } from 'svelte/store'

export const user = writable(null)

export const setUser = (value) => {
    user.set(value)
}

export const getUser = () => {
    return get(user)
}

export default { user, setUser }
