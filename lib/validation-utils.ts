import * as z from "zod"

export const ValidationMessages = {
  REQUIRED: "This field is required",
  EMAIL_INVALID: "Please enter a valid email address",
  PHONE_INVALID: "Please enter a valid phone number",
  PASSWORD_MIN: "Password must be at least 6 characters",
  USERNAME_MIN: "Username must be at least 3 characters",
  USERNAME_MAX: "Username cannot exceed 50 characters",
  NAME_MIN: "Name must be at least 2 characters",
  ADDRESS_MIN: "Address must be at least 10 characters",
  HOURS_POSITIVE: "Hours must be a positive number",
  RATE_POSITIVE: "Rate must be a positive number",
  DATE_FUTURE: "Date cannot be in the future",
  DATE_PAST: "Date cannot be before 1900",
} as const

// Phone number validation regex (supports international formats)
export const PHONE_REGEX = /^[+]?[1-9][\d]{0,15}$/

// Enhanced validation schemas
export const phoneSchema = z
  .string()
  .optional()
  .refine((val) => !val || val.length === 0 || PHONE_REGEX.test(val.replace(/[\s\-$$$$]/g, "")), {
    message: ValidationMessages.PHONE_INVALID,
  })

export const emailSchema = z.string().min(1, ValidationMessages.REQUIRED).email(ValidationMessages.EMAIL_INVALID)

export const usernameSchema = z
  .string()
  .min(3, ValidationMessages.USERNAME_MIN)
  .max(50, ValidationMessages.USERNAME_MAX)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, underscores, and hyphens")

export const passwordSchema = z
  .string()
  .min(6, ValidationMessages.PASSWORD_MIN)
  .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, "Password must contain at least one letter and one number")

export const hoursSchema = z
  .number({
    required_error: ValidationMessages.REQUIRED,
    invalid_type_error: "Hours must be a number",
  })
  .positive(ValidationMessages.HOURS_POSITIVE)
  .max(24, "Hours cannot exceed 24 per day")

export const rateSchema = z
  .number({
    required_error: ValidationMessages.REQUIRED,
    invalid_type_error: "Rate must be a number",
  })
  .min(0, "Rate cannot be negative")
  .max(10000, "Rate seems unusually high, please verify")

export const dateSchema = z
  .date({
    required_error: ValidationMessages.REQUIRED,
  })
  .refine((date) => date <= new Date(), {
    message: ValidationMessages.DATE_FUTURE,
  })
  .refine((date) => date >= new Date("1900-01-01"), {
    message: ValidationMessages.DATE_PAST,
  })

// Utility function to sanitize input
export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/\s+/g, " ")
}

// Utility function to validate file uploads
export const validateFileUpload = (file: File, maxSizeMB = 5, allowedTypes: string[] = []) => {
  const errors: string[] = []

  if (file.size > maxSizeMB * 1024 * 1024) {
    errors.push(`File size must be less than ${maxSizeMB}MB`)
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    errors.push(`File type must be one of: ${allowedTypes.join(", ")}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// Rate limiting utility for form submissions
export class FormSubmissionLimiter {
  private static submissions = new Map<string, number[]>()

  static canSubmit(formId: string, maxSubmissions = 5, windowMs = 60000): boolean {
    const now = Date.now()
    const submissions = this.submissions.get(formId) || []

    // Remove old submissions outside the window
    const recentSubmissions = submissions.filter((time) => now - time < windowMs)

    if (recentSubmissions.length >= maxSubmissions) {
      return false
    }

    // Add current submission
    recentSubmissions.push(now)
    this.submissions.set(formId, recentSubmissions)

    return true
  }

  static getRemainingTime(formId: string, windowMs = 60000): number {
    const submissions = this.submissions.get(formId) || []
    if (submissions.length === 0) return 0

    const oldestSubmission = Math.min(...submissions)
    const remainingTime = windowMs - (Date.now() - oldestSubmission)

    return Math.max(0, remainingTime)
  }
}
