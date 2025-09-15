// @ts-nocheck
import { Hono } from 'hono'
import { validateUser, createUser, changePassword } from '../repository/users.js'
import { isLogged } from '../middlewares/auth-middleware.js'

const authRoutes = new Hono()



authRoutes.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json()

    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400)
    }

    const user = await validateUser(username, password)

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    const setSession = c.get('setSession')
    await setSession({
      userId: user.id,
      username: user.username,
      email: user.email,
      loginAt: new Date().toISOString()
    })

    return c.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      }
    })
  } catch (error) {
    return c.json({ error: 'Login failed' }, 500)
  }
})

authRoutes.get('/logged-user', isLogged, async (c) => {
  try {
    const session = c.get('session')
    return c.json({
      user: {
        id: session.userId,
        username: session.username,
        email: session.email,
      }
    })
  } catch (error) {
    return c.json({ error: 'Failed to get user info' }, 500)
  }
})

authRoutes.post('/update-password', isLogged, async (c) => {
  try {
    const session = c.get('session')
    const { currentPassword, newPassword } = await c.req.json()

    if (!currentPassword || !newPassword) {
      return c.json({ error: 'Current password and new password are required' }, 400)
    }

    await changePassword(session.userId, currentPassword, newPassword)

    return c.json({ message: 'Password updated successfully' })
  } catch (error) {
    return c.json({ error: error.message }, 400)
  }
})

authRoutes.post('/create-user', isLogged, async (c) => {
  try {
    const { username, email, password } = await c.req.json()

    if (!username || !email || !password) {
      return c.json({ error: 'Username, email, and password are required' }, 400)
    }

    const user = await createUser(username, email, password)

    return c.json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      }
    }, 201)
  } catch (error) {
    return c.json({ error: error.message }, 400)
  }
})

authRoutes.post('/logout', isLogged, async (c) => {
  try {
    const setSession = c.get('setSession')
    await setSession({
      userId: null,
      username: null,
      email: null,
      loginAt: null,
      logoutAt: new Date().toISOString()
    })

    return c.json({ message: 'Logout successful' })
  } catch (error) {
    return c.json({ error: 'Logout failed' }, 500)
  }
})

export default authRoutes