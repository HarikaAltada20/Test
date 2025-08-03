import { SubmissionMetadata, SubmissionRejectionMetadata, SubmissionPaymentMetadata } from '@/types/supabase';

/**
 * Parse submission metadata from JSON string or object
 */
export function parseSubmissionMetadata(metadata: any): SubmissionMetadata | null {
  if (!metadata) return null;
  
  try {
    const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    
    // Validate metadata structure
    if (!parsedMetadata || typeof parsedMetadata !== 'object' || !parsedMetadata.type) {
      return null;
    }
    
    // Validate rejection metadata
    if (parsedMetadata.type === 'rejection') {
      if (!parsedMetadata.reason || !parsedMetadata.timestamp || !parsedMetadata.updatedBy) {
        return null;
      }
      return parsedMetadata as SubmissionRejectionMetadata;
    }
    
    // Validate payment metadata
    if (parsedMetadata.type === 'payment') {
      if (!parsedMetadata.timestamp || !parsedMetadata.updatedBy) {
        return null;
      }
      return parsedMetadata as SubmissionPaymentMetadata;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing submission metadata:', error);
    return null;
  }
}

/**
 * Get rejection reason from metadata
 */
export function getRejectionReason(metadata: any): string | null {
  const parsedMetadata = parseSubmissionMetadata(metadata);
  if (parsedMetadata?.type === 'rejection') {
    return parsedMetadata.reason;
  }
  return null;
}

/**
 * Get additional notes from rejection metadata
 */
export function getRejectionAdditionalNotes(metadata: any): string | null {
  const parsedMetadata = parseSubmissionMetadata(metadata);
  if (parsedMetadata?.type === 'rejection') {
    return parsedMetadata.additionalNotes || null;
  }
  return null;
}

/**
 * Get full rejection details (reason + additional notes)
 */
export function getFullRejectionDetails(metadata: any): { reason: string; additionalNotes?: string } | null {
  const parsedMetadata = parseSubmissionMetadata(metadata);
  if (parsedMetadata?.type === 'rejection') {
    return {
      reason: parsedMetadata.reason,
      additionalNotes: parsedMetadata.additionalNotes || undefined
    };
  }
  return null;
}

/**
 * Get payment details from metadata
 */
export function getPaymentDetails(metadata: any): { paymentProofUrl: string | null; paymentDescription: string | null } | null {
  const parsedMetadata = parseSubmissionMetadata(metadata);
  if (parsedMetadata?.type === 'payment') {
    return {
      paymentProofUrl: parsedMetadata.paymentProofUrl,
      paymentDescription: parsedMetadata.paymentDescription,
    };
  }
  return null;
}

/**
 * Check if metadata is legacy (old format)
 */
export function isLegacyMetadata(metadata: any): boolean {
  const parsedMetadata = parseSubmissionMetadata(metadata);
  return parsedMetadata?.type === 'rejection' && parsedMetadata.legacy === true;
}

/**
 * Format metadata timestamp for display
 */
export function formatMetadataTimestamp(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch (error) {
    return 'Unknown';
  }
} 