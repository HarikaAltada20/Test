# Phantom Wallet Payout Integration

## Overview

This document describes the integration of Phantom Wallet as a payout method for creators on the GoViral platform. Creators can now receive their earnings directly in USDC or USDT tokens to their Phantom Wallet.

## Features

### ✅ **What's Implemented**

1. **Payout Method Types**
   - Added `phantom` to `PayoutMethodType`
   - Created `PhantomPayoutDetails` interface
   - Support for USDC and USDT tokens

2. **Solana Utilities**
   - Wallet address validation
   - Associated token account management
   - Payout processing functions
   - Network support (devnet/mainnet)

3. **UI Components**
   - `PhantomPayoutForm` component
   - Wallet address validation
   - Token preference selection
   - Network selection

4. **API Endpoints**
   - `/api/solana/process-payout` - Process payouts
   - Integration with existing withdrawal system

## Technical Details

### **Payout Method Details**

```typescript
interface PhantomPayoutDetails {
  wallet_address: string;        // Phantom wallet address
  preferred_token: 'USDC' | 'USDT';  // Token preference
  network: 'devnet' | 'mainnet';     // Solana network
  memo?: string;                     // Optional memo
}
```

### **Supported Tokens**

| Token | Devnet Mint | Mainnet Mint | Decimals |
|-------|-------------|--------------|----------|
| USDC | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 6 |
| USDT | `Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr` | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | 6 |

### **Minimum Requirements**

- **Minimum Payout**: $1.00 (100 cents)
- **Network Fee**: ~$0.000005 SOL per transaction
- **Token Decimals**: 6 (USDC/USDT standard)

## Usage

### **For Creators**

1. **Add Phantom Wallet**
   - Go to Earnings page
   - Click "Add Payout Method"
   - Select "Phantom Wallet"
   - Enter wallet address and preferences
   - Validate address

2. **Request Withdrawal**
   - Select Phantom Wallet as payout method
   - Choose USDC or USDT
   - Enter amount (minimum $1.00)
   - Submit withdrawal request

3. **Receive Payout**
   - Payouts are processed by admin
   - Tokens sent directly to your wallet
   - Transaction visible in Phantom Wallet

### **For Admins**

1. **Process Withdrawals**
   - View pending Phantom Wallet withdrawals
   - Verify wallet address and amount
   - Process payout via API
   - Update withdrawal status

2. **Monitor Transactions**
   - Track payout status
   - View transaction signatures
   - Handle failed payouts

## API Reference

### **Process Payout**

```typescript
POST /api/solana/process-payout
{
  "withdrawalRequestId": "uuid",
  "recipientWallet": "8qhgYTV4wJFsEEwiZqTwzuJisFrimUXQG9MLsHGkkWU8",
  "amountInCents": 5000,
  "tokenType": "USDC",
  "memo": "optional memo",
  "adminNotes": "admin notes"
}
```

### **Response**

```typescript
{
  "success": true,
  "message": "Payout processed successfully",
  "transactionSignature": "abc123...",
  "amount": 5000,
  "tokenType": "USDC",
  "recipientWallet": "8qhgYTV4wJFsEEwiZqTwzuJisFrimUXQG9MLsHGkkWU8"
}
```

## Security Considerations

1. **Wallet Validation**
   - Address format validation
   - Associated token account verification
   - Network compatibility checks

2. **Transaction Security**
   - Admin approval required
   - Transaction logging
   - Error handling and rollback

3. **Privacy**
   - Wallet addresses stored securely
   - No private keys stored
   - Encrypted communication

## Future Enhancements

### **Planned Features**

1. **Automated Payouts**
   - Scheduled payout processing
   - Batch payout optimization
   - Real-time status updates

2. **Enhanced UI**
   - Payout history tracking
   - Transaction explorer integration
   - Mobile-optimized forms

3. **Advanced Features**
   - Multi-signature support
   - Custom token support
   - Cross-chain compatibility

## Troubleshooting

### **Common Issues**

1. **Invalid Wallet Address**
   - Ensure address is valid Solana format
   - Check for typos or extra characters
   - Verify network compatibility

2. **Token Account Issues**
   - Associated token account may not exist
   - System will create it automatically
   - Check network connectivity

3. **Payout Failures**
   - Insufficient balance for network fees
   - Network congestion
   - Invalid token type

### **Support**

For technical support or questions:
- Check transaction status in admin panel
- Review error logs for details
- Contact development team for assistance

## Development Notes

### **File Structure**

```
lib/
  solana-payout-utils.ts     # Payout processing utilities
  solana-utils.ts            # Existing Solana utilities
  payment-utils.ts           # Payment logging functions

components/
  PhantomPayoutForm.tsx      # Payout method form

app/api/solana/
  process-payout/route.ts    # Payout processing API

types/
  earnings.ts                # Type definitions
```

### **Dependencies**

- `@solana/web3.js` - Solana blockchain interaction
- `@solana/spl-token` - Token operations
- `@supabase/supabase-js` - Database operations

### **Environment Variables**

```env
NEXT_PUBLIC_SOLANA_NETWORK=devnet
PHANTOM_WALLET_ADDRESS=your_receiving_wallet
SOLANA_WEBHOOK_API_KEY=your_webhook_key
```

## Conclusion

The Phantom Wallet payout integration provides creators with a modern, efficient way to receive their earnings directly in cryptocurrency. The system is designed to be secure, user-friendly, and scalable for future enhancements.

For questions or support, please refer to the troubleshooting section or contact the development team.
