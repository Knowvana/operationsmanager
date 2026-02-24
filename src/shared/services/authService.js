// ============================================================================
// AuthService — Password hashing and verification using bcryptjs.
//
// ARCHITECTURE NOTE:
// This service handles password security for the platform:
//   - hashPassword(): Hash a plain-text password with bcrypt (cost factor 10)
//   - verifyPassword(): Compare a plain-text password against a stored hash
//   - generateSessionId(): Create a unique session identifier
//
// Passwords are NEVER stored in plain text. The only place plain text
// passwords exist is in config/system-admin.json for development convenience.
// When seeding the database, passwords are hashed before writing.
//
// Usage:
//   import { AuthService } from '@shared';
//   const hash = await AuthService.hashPassword('admin123');
//   const isValid = await AuthService.verifyPassword('admin123', hash);
// ============================================================================
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

const AuthService = {
  /**
   * Hash a plain-text password using bcrypt.
   * @param {string} plainPassword
   * @returns {Promise<string>} bcrypt hash
   */
  async hashPassword(plainPassword) {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return bcrypt.hash(plainPassword, salt);
  },

  /**
   * Verify a plain-text password against a bcrypt hash.
   * @param {string} plainPassword
   * @param {string} hash — bcrypt hash from database
   * @returns {Promise<boolean>}
   */
  async verifyPassword(plainPassword, hash) {
    return bcrypt.compare(plainPassword, hash);
  },

  /**
   * Generate a unique session ID for log tracking.
   * @returns {string}
   */
  generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },
};

export default AuthService;
