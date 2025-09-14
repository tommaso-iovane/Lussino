import { hashPassword, comparePassword } from '../lib/crypt.js'
import db from '../lib/db.js'

export async function validateUser(username, password) {
  if (!username || !password) {
    return null
  }

  const stmt = db.prepare('SELECT * FROM users WHERE username = ?')
  const user = stmt.get(username)
  
  if (!user) {
    return null
  }

  const isValidPassword = await comparePassword(password, user.password)
  
  if (!isValidPassword) {
    return null
  }

  const { password: _, ...userWithoutPassword } = user
  return userWithoutPassword
}

export async function createUser(username, email, password) {
  if (!username || !email || !password) {
    throw new Error('Username, email, and password are required')
  }

  const checkUserStmt = db.prepare('SELECT id FROM users WHERE username = ?')
  if (checkUserStmt.get(username)) {
    throw new Error('Username already exists')
  }

  const checkEmailStmt = db.prepare('SELECT id FROM users WHERE email = ?')
  if (checkEmailStmt.get(email)) {
    throw new Error('Email already exists')
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format')
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long')
  }

  const hashedPassword = await hashPassword(password)

  const insertStmt = db.prepare(`
    INSERT INTO users (username, email, password) 
    VALUES (?, ?, ?) 
    RETURNING id, username, email, created_at, updated_at
  `)
  
  const user = insertStmt.get(username, email, hashedPassword)
  return user
}

export async function changePassword(userId, currentPassword, newPassword) {

  const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
  const user = stmt.get(userId)
  
  if (!user) {
    throw new Error('User not found')
  }

  const isCurrentPasswordValid = await comparePassword(currentPassword, user.password)
  
  if (!isCurrentPasswordValid) {
    throw new Error('Current password is incorrect')
  }

  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long')
  }

  const isSamePassword = await comparePassword(newPassword, user.password)
  if (isSamePassword) {
    throw new Error('New password must be different from current password')
  }

  const hashedNewPassword = await hashPassword(newPassword)

  const updateStmt = db.prepare(`
    UPDATE users 
    SET password = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `)
  
  updateStmt.run(hashedNewPassword, userId)
  return true
}

export function getUserByUsername(username) {
  const stmt = db.prepare('SELECT id, username, email, created_at, updated_at FROM users WHERE username = ?')
  return stmt.get(username)
}

export function getAllUsers() {
  const stmt = db.prepare('SELECT id, username, email, created_at, updated_at FROM users')
  return stmt.all()
}
