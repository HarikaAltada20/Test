# TikTok API Setup Guide

This guide will walk you through obtaining TikTok API credentials and setting up OAuth integration for your application.

## 📋 Prerequisites

- TikTok for Business account
- Developer account access
- Your application's domain (for redirect URIs)

## 🔑 Step 1: Apply for TikTok Developer Access

1. **Visit TikTok Developer Portal**
   - Go to [https://developers.tiktok.com/](https://developers.tiktok.com/)
   - Click "Get Started" or "Sign In"

2. **Create Developer Account**
   - Sign in with your TikTok account
   - Fill out the developer registration form
   - Provide business information and use case details
   - Wait for approval (usually 1-3 business days)

## 📱 Step 2: Create a TikTok App

1. **Navigate to Dashboard**
   - Once approved, go to your Developer Dashboard
   - Click "Create App" or "Manage Apps"

2. **Choose App Type**
   - **For Web Applications**: Select "Web App" or "Server App"
   - **For Mobile**: Select "Mobile App" (requires different setup)
   - **Important**: Choose "Web App" for browser-based OAuth

3. **Fill App Details**
   ```
   App Name: Your App Name
   App Description: Brief description of your app
   App Category: Select appropriate category
   Website: https://yourdomain.com
   Privacy Policy: https://yourdomain.com/privacy
   Terms of Service: https://yourdomain.com/terms
   ```

## 🔐 Step 3: Configure OAuth Settings

1. **Go to OAuth Configuration**
   - In your app dashboard → "API & Products" → "OAuth"

2. **Set Redirect URIs**
   ```
   Development: http://localhost:3000/api/tiktok/callback
   Production:  https://yourdomain.com/api/tiktok/callback
   ```
   - **Important**: Must exactly match your callback URL
   - No trailing slashes
   - Use HTTPS for production

3. **Configure Scopes**
   Request these permissions:
   ```
   user.info.basic     - Basic user information
   user.info.profile   - Profile details and bio
   user.info.stats     - Follower/following counts
   ```

## 🔑 Step 4: Get Your API Credentials

1. **Navigate to Keys & Secrets**
   - In app dashboard → "Keys and Secrets" or "App Credentials"

2. **Copy Your Credentials**
   ```
   Client Key: awdbpg9ovlhez970 (example)
   Client Secret: lvltzgsc0cUg1A78GY0L5dmsVpPDAbMX (example)
   ```

## ⚙️ Step 5: Configure Your Application

### Environment Variables
Add these to your `.env` file:

```bash
# TikTok OAuth Configuration
NEXT_PUBLIC_TIKTOK_CLIENT_ID="your_client_key_here"
TIKTOK_CLIENT_SECRET="your_client_secret_here"
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # Development
# NEXT_PUBLIC_APP_URL="https://yourdomain.com"  # Production
```

### Required Scopes
Your application should request:
- `user.info.basic`
- `user.info.profile`
- `user.info.stats`

## 🚨 Common Issues & Solutions

### Issue 1: "unauthorized_client" Error
**Cause**: App type mismatch or incorrect redirect URI
**Solution**:
- Ensure app type is "Web App" (not "Mobile App")
- Verify redirect URI exactly matches in TikTok dashboard
- Check app is approved for OAuth

### Issue 2: "code_challenge" Error
**Cause**: Missing PKCE implementation
**Solution**: Our code already implements PKCE correctly

### Issue 3: "redirect_uri_mismatch" Error
**Cause**: Redirect URI doesn't match dashboard configuration
**Solution**:
- Add exact URI to TikTok dashboard
- No trailing slashes
- Use HTTPS in production

### Issue 4: App Not Approved
**Cause**: TikTok hasn't approved your app yet
**Solution**:
- Check app status in dashboard
- Submit for review if needed
- Contact TikTok support

## 🧪 Step 6: Test Your Integration

1. **Start Your Development Server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. **Test OAuth Flow**
   - Navigate to your settings page
   - Click "Connect TikTok"
   - Follow the OAuth flow
   - Verify successful connection

## 📊 Step 7: Monitor Usage

1. **Check API Usage**
   - In TikTok dashboard → "Analytics"
   - Monitor API calls and rate limits
   - Set up alerts for usage limits

2. **Review App Performance**
   - Track connection success rates
   - Monitor token refresh failures
   - Log authentication errors

## 🔧 Advanced Configuration

### Custom Scopes
For additional permissions, request:
```
video.list        - List user's videos
user.info.settings - User account settings
```

### Webhook Setup
For real-time updates:
1. Configure webhook endpoint in TikTok dashboard
2. Handle webhook events in your application
3. Verify webhook signatures

### Rate Limiting
- Respect TikTok API rate limits
- Implement exponential backoff
- Cache user data when possible

## 📞 Support & Resources

### Official Documentation
- [TikTok for Developers](https://developers.tiktok.com/)
- [OAuth 2.0 Documentation](https://developers.tiktok.com/doc/login-kit-web/)
- [API Reference](https://developers.tiktok.com/doc/)

### Common Issues
- Check app status regularly
- Monitor API changes
- Keep credentials secure

### Community Support
- TikTok Developer Community
- Stack Overflow tags: `tiktok-api`, `tiktok-oauth`

## 🔄 Maintenance

### Regular Tasks
- Rotate client secrets periodically
- Update redirect URIs when changing domains
- Monitor app approval status
- Keep documentation updated

### Security Best Practices
- Never expose client secrets in frontend
- Use HTTPS in production
- Implement proper session management
- Log authentication events

## 📝 Checklist

- [ ] Developer account approved
- [ ] App created with correct type
- [ ] OAuth redirect URIs configured
- [ ] Required scopes requested
- [ ] Client key and secret obtained
- [ ] Environment variables set
- [ ] PKCE implementation working
- [ ] Test connection successful
- [ ] Error handling implemented
- [ ] Monitoring setup complete

---

## 🎯 Quick Start Commands

```bash
# 1. Set environment variables
echo "NEXT_PUBLIC_TIKTOK_CLIENT_ID=your_client_key" >> .env
echo "TIKTOK_CLIENT_SECRET=your_client_secret" >> .env
echo "NEXT_PUBLIC_APP_URL=http://localhost:3000" >> .env

# 2. Restart development server
npm run dev

# 3. Test integration
# Navigate to http://localhost:3000/dashboard/settings
# Click "Connect TikTok"
```

## 🆘 Troubleshooting

If you encounter issues:

1. **Check console logs** for detailed error messages
2. **Verify redirect URI** matches exactly in TikTok dashboard
3. **Ensure app type** is set to "Web App"
4. **Confirm app status** is "Approved"
5. **Contact TikTok support** for account-specific issues

---

*Last Updated: March 2026*
*Version: 1.0*
