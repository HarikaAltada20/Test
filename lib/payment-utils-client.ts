import { createClient } from '@/utils/supabase/client';

// Client-side version of updateTransactionStatus
export async function updateTransactionStatusClient(
  paymentIntentId: string,
  status: 'success' | 'failed',
  newDescription?: string,
  remarks?: string
): Promise<boolean> {
  try {
    console.log(`🚀 CLIENT UPDATE: Updating transaction for payment intent: ${paymentIntentId}`);
    
    const supabase = createClient();
    
    // Use optimized database function for lightning-fast updates
    const { data, error } = await supabase
      .rpc('update_transaction_status_by_payment_intent_fast', {
        p_payment_intent_id: paymentIntentId,
        p_new_status: status,
        p_new_description: newDescription,
        p_remarks: remarks
      });

    if (error) {
      console.error('❌ Error in client transaction update:', error);
      throw new Error(`Failed to update transaction status: ${error.message}`);
    }

    if (data === true) {
      console.log(`✅ CLIENT UPDATE SUCCESS: Transaction updated to ${status} for payment intent: ${paymentIntentId}`);
      return true;
    } else {
      console.log(`❌ No pending transaction found for payment intent: ${paymentIntentId}`);
      return false;
    }

  } catch (error) {
    console.error('❌ Error in client updateTransactionStatus:', error);
    throw error; // Re-throw to ensure failures are not silently ignored
  }
}

// Handle frontend payment failures (when Stripe fails immediately) - CLIENT VERSION
export async function handleFrontendPaymentFailure(
  paymentIntentId: string,
  errorMessage: string
): Promise<boolean> {
  try {
    console.log(`🔴 FRONTEND FAILURE: Handling immediate payment failure for: ${paymentIntentId}`);
    console.log(`🔴 Error: ${errorMessage}`);
    
    // Generate user-friendly remark based on error message
    const userFriendlyRemark = generateFailureRemark(errorMessage);
    
    const success = await updateTransactionStatusClient(
      paymentIntentId,
      'failed',
      `Payment failed immediately: ${errorMessage}`,
      userFriendlyRemark
    );
    
    console.log(`📝 Frontend failure update result: ${success ? 'SUCCESS' : 'FAILED'}`);
    return success;
  } catch (error) {
    console.error('❌ Error handling frontend payment failure:', error);
    return false;
  }
}

// Generate user-friendly failure remarks based on error messages
function generateFailureRemark(errorMessage: string): string {
  if (!errorMessage) return 'Payment could not be processed';
  
  const message = errorMessage.toLowerCase();
  
  // Card validation errors
  if (message.includes('card number') || message.includes('invalid number')) {
    return 'Please check your card number';
  }
  if (message.includes('expiry') || message.includes('expired')) {
    return 'Your card has expired';
  }
  if (message.includes('cvc') || message.includes('security code')) {
    return 'Please check your card security code';
  }
  if (message.includes('zip') || message.includes('postal')) {
    return 'Please check your billing address';
  }
  
  // Common Stripe errors
  if (message.includes('declined') || message.includes('card_declined')) {
    return 'Your card was declined by the bank';
  }
  if (message.includes('insufficient') || message.includes('funds')) {
    return 'Insufficient funds in your account';
  }
  if (message.includes('processing error')) {
    return 'Payment processing error - please try again';
  }
  if (message.includes('network') || message.includes('connection')) {
    return 'Network error - please check your connection';
  }
  if (message.includes('authentication') || message.includes('3d secure')) {
    return 'Card authentication failed';
  }
  
  // Generic fallback
  return 'Payment could not be processed';
} 