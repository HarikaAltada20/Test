/**
 * Name validation and formatting utilities
 */

// Name validation constants
export const NAME_CONSTRAINTS = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 25,
  FIRST_NAME_MAX: 25,
  LAST_NAME_MAX: 25,
  FULL_NAME_MAX: 52, // first + last + space
} as const;

type NameConstraintKeys = keyof typeof NAME_CONSTRAINTS;
type NameConstraintValues = typeof NAME_CONSTRAINTS[NameConstraintKeys];

// Regex for allowed characters in names (letters, spaces, hyphens, apostrophes)
const NAME_REGEX = /^[a-zA-Z\s\-']+$/;

/**
 * Validates a name field (first name, last name, or full name)
 */
export function validateName(name: string, type: 'first' | 'last' | 'full' = 'full'): {
  isValid: boolean;
  error?: string;
} {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'Name is required' };
  }

  const trimmedName = name.trim();
  
  // Check minimum length
  if (trimmedName.length < NAME_CONSTRAINTS.MIN_LENGTH) {
    return { isValid: false, error: 'Name must be at least 1 character long' };
  }

  // Check maximum length based on type
  let maxLength: number = NAME_CONSTRAINTS.MAX_LENGTH;
  if (type === 'first') maxLength = NAME_CONSTRAINTS.FIRST_NAME_MAX;
  else if (type === 'last') maxLength = NAME_CONSTRAINTS.LAST_NAME_MAX;
  else if (type === 'full') maxLength = NAME_CONSTRAINTS.FULL_NAME_MAX;

  if (trimmedName.length > maxLength) {
    const nameType = type === 'first' ? 'First name' : type === 'last' ? 'Last name' : 'Name';
    return { isValid: false, error: `${nameType} must be ${maxLength} characters or less` };
  }

  // Check for valid characters
  if (!NAME_REGEX.test(trimmedName)) {
    return { isValid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
  }

  // Check for excessive spaces
  if (trimmedName.includes('  ')) {
    return { isValid: false, error: 'Name cannot contain multiple consecutive spaces' };
  }

  // Check for names that start or end with special characters
  if (trimmedName.startsWith('-') || trimmedName.startsWith("'") || 
      trimmedName.endsWith('-') || trimmedName.endsWith("'")) {
    return { isValid: false, error: 'Name cannot start or end with hyphens or apostrophes' };
  }

  return { isValid: true };
}

/**
 * Validates first and last name combination
 */
export function validateFullName(firstName: string, lastName: string): {
  isValid: boolean;
  error?: string;
} {
  const firstNameValidation = validateName(firstName, 'first');
  if (!firstNameValidation.isValid) {
    return { isValid: false, error: `First name: ${firstNameValidation.error}` };
  }

  const lastNameValidation = validateName(lastName, 'last');
  if (!lastNameValidation.isValid) {
    return { isValid: false, error: `Last name: ${lastNameValidation.error}` };
  }

  const combinedLength = firstName.trim().length + lastName.trim().length + 1; // +1 for space
  if (combinedLength > NAME_CONSTRAINTS.FULL_NAME_MAX) {
    return { 
      isValid: false, 
      error: `Combined first and last name must be ${NAME_CONSTRAINTS.FULL_NAME_MAX} characters or less` 
    };
  }

  return { isValid: true };
}

/**
 * Formats a name by trimming and capitalizing properly
 */
export function formatName(name: string): string {
  return name
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Truncates text with ellipsis if it exceeds the specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Truncates display name for UI components
 */
export function truncateDisplayName(name: string, maxLength: number = 20): string {
  return truncateText(name, maxLength);
}

/**
 * Truncates email for UI components
 */
export function truncateEmail(email: string, maxLength: number = 25): string {
  if (!email || email.length <= maxLength) {
    return email;
  }

  const [localPart, domain] = email.split('@');
  if (!domain) return truncateText(email, maxLength);

  const maxLocalLength = maxLength - domain.length - 4; // -4 for "@" and "..."
  if (maxLocalLength > 0) {
    return `${localPart.slice(0, maxLocalLength)}...@${domain}`;
  }

  return truncateText(email, maxLength);
}

/**
 * Gets the character count display for input fields
 */
export function getCharacterCountDisplay(current: number, max: number): string {
  return `${current}/${max}`;
}

/**
 * Checks if character count is approaching limit (80% or more)
 */
export function isApproachingLimit(current: number, max: number): boolean {
  return current >= max * 0.8;
}

/**
 * Sanitizes name input by removing invalid characters
 */
export function sanitizeNameInput(input: string): string {
  return input
    .replace(/[^a-zA-Z\s\-']/g, '') // Remove invalid characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .slice(0, NAME_CONSTRAINTS.MAX_LENGTH); // Enforce max length
}

/**
 * Sanitizes full name input by removing invalid characters
 */
export function sanitizeFullNameInput(input: string): string {
  return input
    .replace(/[^a-zA-Z\s\-']/g, '') // Remove invalid characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .slice(0, NAME_CONSTRAINTS.FULL_NAME_MAX); // Enforce full name max length
}