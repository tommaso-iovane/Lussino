import http from './http'


export const login = async (username, password) => {
    const response = await http.post('/api/auth/login', { username, password })
    return response
}

export const changePassword = async (currentPassword, newPassword) => {
    const response = await http.post('/api/auth/update-password', { currentPassword, newPassword })
    return response
}


export const getLoggedUser = async () => {
    const response = await http.get('/api/auth/logged-user')
    return response
}

