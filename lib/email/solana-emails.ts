/**
 * Solana Payment Email Notifications
 * Uses Resend to send payment confirmation and notification emails
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@gameofcreators.com';
const APP_NAME = 'Game of Creators';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gameofcreators.com';

// =====================================================
// EMAIL TEMPLATES
// =====================================================

interface PaymentConfirmationParams {
  to: string;
  username: string;
  amount: number; // Amount in dollars
  tokenType: 'USDC' | 'USDT';
  transactionSignature: string;
  referenceId: string;
  newBalance: number; // New balance in dollars
}

/**
 * Send payment confirmation email
 */
export async function sendSolanaPaymentConfirmationEmail(
  params: PaymentConfirmationParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      to,
      username,
      amount,
      tokenType,
      transactionSignature,
      referenceId,
      newBalance,
    } = params;

    const solscanUrl =
      process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta'
        ? `https://solscan.io/tx/${transactionSignature}`
        : `https://solscan.io/tx/${transactionSignature}?cluster=devnet`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #ffffff;
      border-radius: 10px;
      padding: 40px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #7F39EC;
      margin: 0;
      font-size: 28px;
    }
    .success-icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      background-color: #10B981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      color: white;
    }
    .content {
      margin: 30px 0;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
    }
    .info-box {
      background-color: #F3F4F6;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 12px 0;
      padding: 8px 0;
      border-bottom: 1px solid #E5E7EB;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      font-weight: 600;
      color: #6B7280;
    }
    .info-value {
      color: #111827;
      font-weight: 500;
    }
    .amount-highlight {
      font-size: 32px;
      font-weight: bold;
      color: #7F39EC;
      text-align: center;
      margin: 20px 0;
    }
    .balance-box {
      background: linear-gradient(135deg, #7F39EC 0%, #4A00BE 100%);
      color: white;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
    }
    .balance-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    .balance-amount {
      font-size: 28px;
      font-weight: bold;
    }
    .button {
      display: inline-block;
      background-color: #7F39EC;
      color: white !important;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .transaction-link {
      word-break: break-all;
      color: #7F39EC;
      text-decoration: none;
      font-size: 12px;
      display: block;
      margin-top: 10px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
      color: #6B7280;
      font-size: 14px;
    }
    .footer a {
      color: #7F39EC;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="success-icon">✓</div>
      <h1>Payment Confirmed!</h1>
    </div>

    <div class="content">
      <p class="greeting">Hi ${username},</p>
      
      <p>Great news! Your Solana payment has been confirmed and your wallet balance has been updated.</p>

      <div class="amount-highlight">
        +$${amount.toFixed(2)} ${tokenType}
      </div>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Transaction ID:</span>
          <span class="info-value" style="font-size: 11px; word-break: break-all;">${transactionSignature.substring(0, 20)}...</span>
        </div>
        <div class="info-row">
          <span class="info-label">Reference ID:</span>
          <span class="info-value">${referenceId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Token Type:</span>
          <span class="info-value">${tokenType}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Amount Received:</span>
          <span class="info-value">$${amount.toFixed(2)}</span>
        </div>
      </div>

      <div class="balance-box">
        <div class="balance-label">Your New Balance</div>
        <div class="balance-amount">$${newBalance.toFixed(2)}</div>
      </div>

      <div style="text-align: center;">
        <a href="${APP_URL}/dashboard/billing" class="button">
          View Balance
        </a>
      </div>

      <p style="margin-top: 30px;">
        You can now use this balance to launch contests and work with amazing creators!
      </p>

      <p style="font-size: 12px; color: #6B7280; margin-top: 20px;">
        <strong>Verify on blockchain:</strong><br>
        <a href="${solscanUrl}" class="transaction-link" target="_blank">
          View transaction on Solscan
        </a>
      </p>
    </div>

    <div class="footer">
      <p>
        Questions? Contact us at <a href="mailto:support@gameofcreators.com">support@gameofcreators.com</a>
      </p>
      <p style="margin-top: 10px;">
        <a href="${APP_URL}">Visit ${APP_NAME}</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Payment Confirmed!

Hi ${username},

Great news! Your Solana payment has been confirmed and your wallet balance has been updated.

Amount Received: $${amount.toFixed(2)} ${tokenType}
Reference ID: ${referenceId}
Transaction: ${transactionSignature}

Your New Balance: $${newBalance.toFixed(2)}

You can now use this balance to launch contests and work with amazing creators!

Verify on blockchain: ${solscanUrl}

Questions? Contact us at support@gameofcreators.com

Visit ${APP_NAME}: ${APP_URL}
    `;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `✅ Payment Confirmed - $${amount.toFixed(2)} ${tokenType} Received`,
      html: htmlContent,
      text: textContent,
    });

    console.log('📧 Email sent successfully:', result);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// PAYMENT REQUEST EMAIL
// =====================================================

interface PaymentRequestParams {
  to: string;
  username: string;
  amount: number; // Amount in dollars
  tokenType: 'USDC' | 'USDT';
  referenceId: string;
  walletAddress: string;
  memo: string;
  expiresAt: string;
}

/**
 * Send payment request instructions email
 */
export async function sendSolanaPaymentRequestEmail(
  params: PaymentRequestParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      to,
      username,
      amount,
      tokenType,
      referenceId,
      walletAddress,
      memo,
      expiresAt,
    } = params;

    const expiryDate = new Date(expiresAt).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Instructions</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #ffffff;
      border-radius: 10px;
      padding: 40px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #7F39EC;
      margin: 0;
      font-size: 28px;
    }
    .amount-box {
      background: linear-gradient(135deg, #7F39EC 0%, #4A00BE 100%);
      color: white;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
    }
    .amount-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    .amount-value {
      font-size: 36px;
      font-weight: bold;
    }
    .instructions {
      background-color: #F3F4F6;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .step {
      margin: 15px 0;
      padding-left: 30px;
      position: relative;
    }
    .step-number {
      position: absolute;
      left: 0;
      top: 0;
      background-color: #7F39EC;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
    }
    .copy-box {
      background-color: white;
      border: 2px dashed #7F39EC;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
      word-break: break-all;
      font-family: 'Courier New', monospace;
      font-size: 13px;
    }
    .label {
      font-weight: 600;
      color: #6B7280;
      font-size: 12px;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .warning {
      background-color: #FEF3C7;
      border-left: 4px solid #F59E0B;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning-title {
      font-weight: bold;
      color: #D97706;
      margin-bottom: 5px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
      color: #6B7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 Payment Instructions</h1>
    </div>

    <p>Hi ${username},</p>
    
    <p>You've requested to top-up your wallet balance with Solana ${tokenType}. Follow the instructions below to complete your payment.</p>

    <div class="amount-box">
      <div class="amount-label">Amount to Send</div>
      <div class="amount-value">$${amount.toFixed(2)} ${tokenType}</div>
    </div>

    <div class="instructions">
      <h3 style="margin-top: 0;">How to Pay:</h3>
      
      <div class="step">
        <div class="step-number">1</div>
        <strong>Open Phantom Wallet</strong><br>
        <span style="color: #6B7280;">Open your Phantom Wallet app on your mobile device or browser extension.</span>
      </div>

      <div class="step">
        <div class="step-number">2</div>
        <strong>Send ${tokenType}</strong><br>
        <span style="color: #6B7280;">Send exactly <strong>$${amount.toFixed(2)} ${tokenType}</strong> to:</span>
        
        <div class="copy-box">
          <div class="label">Recipient Wallet Address:</div>
          ${walletAddress}
        </div>
      </div>

      <div class="step">
        <div class="step-number">3</div>
        <strong>Add Memo (Important!)</strong><br>
        <span style="color: #6B7280;">Include this exact memo in your transaction:</span>
        
        <div class="copy-box">
          <div class="label">Memo (Copy exactly as shown):</div>
          ${memo}
        </div>
        
        <div style="margin-top: 10px; padding: 10px; background-color: #EFF6FF; border-left: 3px solid #3B82F6; border-radius: 4px;">
          <strong style="color: #1E40AF;">💡 Finding the Memo Field:</strong><br>
          <span style="color: #1E40AF; font-size: 12px;">
            • <strong>Mobile:</strong> Scroll down in Phantom → tap "Add Memo" or ⚙️<br>
            • <strong>Desktop:</strong> Click "Memo (optional)" to expand the field
          </span>
        </div>
      </div>

      <div class="step">
        <div class="step-number">4</div>
        <strong>Confirm Transaction</strong><br>
        <span style="color: #6B7280;">Review the details and confirm the transaction in your wallet.</span>
      </div>
    </div>

    <div class="warning">
      <div class="warning-title">⚠️ Important Notes:</div>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>Send the <strong>exact amount</strong> shown above</li>
        <li>Include the <strong>memo exactly as shown</strong> (case-sensitive)</li>
        <li>Use <strong>${tokenType} on Solana network</strong> only</li>
        <li>Your balance will be updated within 1-2 minutes after confirmation</li>
      </ul>
    </div>

    <p style="background-color: #EFF6FF; padding: 15px; border-radius: 8px; border-left: 4px solid #3B82F6;">
      <strong>📅 Payment Request Expires:</strong><br>
      ${expiryDate}
    </p>

    <p style="margin-top: 30px;">
      If you have any questions or issues, please contact our support team.
    </p>

    <div class="footer">
      <p>
        Questions? Contact us at <a href="mailto:support@gameofcreators.com" style="color: #7F39EC; text-decoration: none;">support@gameofcreators.com</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Payment Instructions

Hi ${username},

You've requested to top-up your wallet balance with Solana ${tokenType}.

Amount to Send: $${amount.toFixed(2)} ${tokenType}

How to Pay:

1. Open Phantom Wallet
   Open your Phantom Wallet app on your mobile device or browser extension.

2. Send ${tokenType}
   Send exactly $${amount.toFixed(2)} ${tokenType} to:
   ${walletAddress}

3. Add Memo (Important!)
   Include this exact memo in your transaction:
   ${memo}

4. Confirm Transaction
   Review the details and confirm the transaction in your wallet.

IMPORTANT NOTES:
- Send the exact amount shown above
- Include the memo exactly as shown (case-sensitive)
- Use ${tokenType} on Solana network only
- Your balance will be updated within 1-2 minutes after confirmation

Payment Request Expires: ${expiryDate}

Questions? Contact us at support@gameofcreators.com
    `;

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `💳 Payment Instructions - $${amount.toFixed(2)} ${tokenType}`,
      html: htmlContent,
      text: textContent,
    });

    console.log('📧 Payment instructions email sent successfully:', result);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

