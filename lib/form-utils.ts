/**
 * Form utility functions for handling submissions and preventing double-clicks
 */

import { useState, useCallback } from 'react';

/**
 * Custom hook for handling form submission with loading states and redirect prevention
 */
export function useFormSubmission() {
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const submitWithRedirect = useCallback(async (
    submitFn: () => Promise<void>,
    redirectFn: () => void,
    onError?: (error: Error) => void
  ) => {
    if (isLoading || isRedirecting) return; // Prevent double submissions

    setIsLoading(true);
    try {
      await submitFn();
      setIsRedirecting(true);
      redirectFn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('An unexpected error occurred');
      if (onError) {
        onError(err);
      }
      setIsLoading(false); // Only reset loading on error
    }
    // Note: We don't reset loading/redirecting on success to prevent button re-enabling
  }, [isLoading, isRedirecting]);

  const reset = useCallback(() => {
    setIsLoading(false);
    setIsRedirecting(false);
  }, []);

  return {
    isLoading,
    isRedirecting,
    isSubmitting: isLoading || isRedirecting,
    submitWithRedirect,
    reset
  };
}

/**
 * Utility function to create button props with proper disabled states
 */
export function getSubmitButtonProps(
  isSubmitting: boolean,
  additionalDisabledConditions: boolean = false
) {
  return {
    disabled: isSubmitting || additionalDisabledConditions,
    type: 'submit' as const,
  };
}

/**
 * Utility function to get loading text based on state
 */
export function getLoadingText(
  isLoading: boolean,
  isRedirecting: boolean,
  loadingText: string = 'Processing...',
  redirectingText: string = 'Redirecting...'
): string {
  if (isRedirecting) return redirectingText;
  if (isLoading) return loadingText;
  return '';
}

/**
 * Debounced form submission to prevent rapid clicks
 */
export function debounceSubmit<T extends any[]>(
  fn: (...args: T) => Promise<void>,
  delay: number = 1000
) {
  let timeoutId: NodeJS.Timeout | null = null;
  let isExecuting = false;

  return async (...args: T) => {
    if (isExecuting) return; // Prevent execution if already running

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(async () => {
      if (isExecuting) return;
      
      isExecuting = true;
      try {
        await fn(...args);
      } finally {
        isExecuting = false;
      }
    }, delay);
  };
}

/**
 * Form validation helper that prevents submission if validation fails
 */
export function withValidation<T extends any[]>(
  submitFn: (...args: T) => Promise<void>,
  validationFn: (...args: T) => boolean | string,
  onValidationError?: (error: string) => void
) {
  return async (...args: T) => {
    const validation = validationFn(...args);
    
    if (validation === false) {
      if (onValidationError) {
        onValidationError('Validation failed');
      }
      return;
    }
    
    if (typeof validation === 'string') {
      if (onValidationError) {
        onValidationError(validation);
      }
      return;
    }

    await submitFn(...args);
  };
}