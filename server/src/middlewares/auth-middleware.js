export const isLogged = async (c, next) => {
  const session = c.get('session')
  
  if (!session || !session.userId) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  await next()
}

export const agentTokenIsValid = async (c, next) => {
  const token = c.req.query('auth_token')

  if (!token) {
    return c.json({ error: 'Token required' }, 401)
  }
  
  if (token !== Bun.env.AGENT_TOKEN) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  await next()
}