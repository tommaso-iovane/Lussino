import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export const hashPassword = async (password, rounds = 12) => {
    if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string')
    }

    try {
        const salt = await bcrypt.genSalt(rounds)
        const hash = await bcrypt.hash(password, salt)
        return hash
    } catch (error) {
        throw new Error(`Failed to hash password: ${error.message}`)
    }
}

export const comparePassword = async (password, hash) => {
    if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string')
    }
    if (!hash || typeof hash !== 'string') {
        throw new Error('Hash must be a non-empty string')
    }

    try {
        return await bcrypt.compare(password, hash)
    } catch (error) {
        throw new Error(`Failed to compare password: ${error.message}`)
    }
}

/**
 * @param {number} length - Length of the token (default: 32)
 * @returns {Promise<string>} Secure random token in base64url format
 * @throws {Error} If length is less than 16 or not a number
 */
export const generateToken = async (length = 32) => {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(length, (err, buffer) => {
            if (err) {
                reject(new Error('Failed to generate secure token: ' + err.message))
                return
            }
            
            // Convert to base64url format (URL-safe base64)
            // Replace + with -, / with _, and remove =
            const token = buffer.toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '')
                .replace('-', '')
                .replace('_', '')
            
            resolve(token)
        })
    })
}

export default {
    hashPassword,
    comparePassword,
    generateToken
}