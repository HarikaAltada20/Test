/**
 * Password validation utilities for the GoViral platform
 * Enforces comprehensive security requirements
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions?: string[];
}

// Common weak passwords to prohibit
const COMMON_PASSWORDS = [
  'password', 'password123', '123456', '123456789', 'qwerty', 'abc123',
  'password1', 'admin', 'letmein', 'welcome', 'monkey', '1234567890',
  'dragon', 'master', 'sunshine', 'princess', 'football', 'baseball',
  'welcome123', 'admin123', 'password!', 'Password123', 'qwerty123',
  'iloveyou', 'trustno1', 'starwars', 'montypython', 'freedom',
  'whatever', 'welcome1', 'password12', 'shadow', 'michael', 'jennifer',
  'jordan', 'hunter', 'summer', 'hello', 'lovely', 'buster'
];

/**
 * Validates password against comprehensive security requirements
 * @param password - The password to validate
 * @returns PasswordValidationResult with validation status and feedback
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // 1. Check minimum length (8 characters)
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
    suggestions.push("Add more characters to reach the minimum length");
  }

  // 2. Check maximum length (32 characters)
  if (password.length > 32) {
    errors.push("Password must not exceed 32 characters");
    suggestions.push("Reduce the password length to 32 characters or less");
  }

  // 3. Check for at least one uppercase letter (A-Z)
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter (A-Z)");
    suggestions.push("Add at least one uppercase letter");
  }

  // 4. Check for at least one lowercase letter (a-z)
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter (a-z)");
    suggestions.push("Add at least one lowercase letter");
  }

  // 5. Check for at least one digit (0-9)
  if (!/[0-9]/.test(password)) {
    errors.push("Password must include at least one digit (0-9)");
    suggestions.push("Add at least one number");
  }

  // 6. Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must include at least one special character (e.g., ! @ # $ % ^ & *)");
    suggestions.push("Add a special character like !, @, #, $, %, ^, &, *, etc.");
  }

  // 7. Check for spaces (not allowed)
  if (/\s/.test(password)) {
    errors.push("Password must not contain spaces");
    suggestions.push("Remove all spaces from the password");
  }

  // 8. Check against common/weak passwords
  const lowerPassword = password.toLowerCase();
  const isCommonPassword = COMMON_PASSWORDS.some(commonPwd => 
    lowerPassword.includes(commonPwd.toLowerCase()) || 
    commonPwd.toLowerCase().includes(lowerPassword)
  );

  if (isCommonPassword) {
    errors.push("Password is too common or easily guessable");
    suggestions.push("Use a more unique combination of words, numbers, and symbols");
  }

  // 9. Check for sequential characters (additional security)
  if (hasSequentialChars(password)) {
    errors.push("Password should not contain obvious sequential patterns");
    suggestions.push("Avoid sequential characters like 'abc', '123', or 'qwerty'");
  }

  // 10. Check for repeated characters (additional security)
  if (hasRepeatedChars(password)) {
    errors.push("Password should not contain excessive repeated characters");
    suggestions.push("Avoid repeating the same character multiple times");
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions: errors.length > 0 ? suggestions : undefined
  };
}

/**
 * Checks for sequential characters in password
 */
function hasSequentialChars(password: string): boolean {
  const sequences = ['abc', '123', 'qwe', 'asd', 'zxc', 'qaz', 'wsx', 'edc'];
  const lowerPassword = password.toLowerCase();
  
  // Check for common sequences
  for (const seq of sequences) {
    if (lowerPassword.includes(seq) || lowerPassword.includes(seq.split('').reverse().join(''))) {
      return true;
    }
  }

  // Check for numeric sequences
  for (let i = 0; i < password.length - 2; i++) {
    const char1 = password.charCodeAt(i);
    const char2 = password.charCodeAt(i + 1);
    const char3 = password.charCodeAt(i + 2);
    
    if ((char2 === char1 + 1 && char3 === char2 + 1) || 
        (char2 === char1 - 1 && char3 === char2 - 1)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks for excessive repeated characters
 */
function hasRepeatedChars(password: string): boolean {
  // Check for 3 or more consecutive identical characters
  return /(.)\1{2,}/.test(password);
}

/**
 * Generates password strength description
 */
export function getPasswordStrength(password: string): 'weak' | 'fair' | 'good' | 'strong' | 'very-strong' {
  if (password.length === 0) return 'weak';
  
  const validation = validatePassword(password);
  if (!validation.isValid) {
    return 'weak';
  }

  let score = 0;
  
  // Length score
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  
  // Character variety score
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;
  
  // Complexity bonuses
  if (password.length >= 20) score += 1;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?].*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;

  if (score <= 3) return 'fair';
  if (score <= 5) return 'good';
  if (score <= 7) return 'strong';
  return 'very-strong';
}

/**
 * Returns formatted error message for display
 */
export function getPasswordErrorMessage(validation: PasswordValidationResult): string {
  if (validation.isValid) return '';
  
  if (validation.errors.length === 1) {
    return validation.errors[0];
  }
  
  return `Password requirements not met: ${validation.errors.join(', ')}`;
}

/**
 * Returns formatted suggestions for password improvement
 */
export function getPasswordSuggestions(validation: PasswordValidationResult): string[] {
  return validation.suggestions || [];
} 