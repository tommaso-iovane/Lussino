import fs from 'fs/promises'
import { getSignedCookie, setSignedCookie } from 'hono/cookie'
import crypt from '../lib/crypt'

let secret
try {
    secret = (await fs.readFile('./data/secret')).toString()
} catch (error) {
    if (error.code === 'ENOENT') {
        secret = await crypt.generateToken(64)
        await fs.writeFile('./data/secret', secret)
    } else {
        throw error
    }
}


let sessions = new Map()

/**
 * 
 * @param {import('hono').Context} c 
 * @param {*} next 
 */
const session = async (c, next) => {
    let sessionKey = await getSignedCookie(c, secret, 'session')
    let session = {}

    if (sessionKey) {
        session = sessions.get(sessionKey)
    } else {
        sessionKey = await crypt.generateToken()
        await setSignedCookie(c, 'session', sessionKey, secret, {
            maxAge: 7 * 24 * 60 * 60
        })
    }
    if (!session) {
        session = { createdAt: new Date().toISOString() }
        sessions.set(sessionKey, session)
    }

    
    c.set('session', session)
    c.set('setSession', async (data) => {
        session = {...session, ...data}
        sessions.set(sessionKey, session)
    })

    await next()
}

export default session