import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const error = searchParams.get('error')

  if (error) {
    console.error('OAuth error:', error)
    return NextResponse.redirect(`${origin}/auth/signin?error=oauth_error&message=${encodeURIComponent(error)}`)
  }

  if (code) {
    const supabase = await createClient()
    
    try {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('Code exchange error:', exchangeError)
        return NextResponse.redirect(`${origin}/auth/signin?error=auth_code_error&message=${encodeURIComponent(exchangeError.message)}`)
      }

      if (!data.user) {
        console.error('No user data after successful code exchange')
        return NextResponse.redirect(`${origin}/auth/signin?error=no_user_data`)
      }

      const user = data.user
      console.log('OAuth callback - User authenticated:', user.id, user.email)

      // Check if user profile exists in our users table
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (profileCheckError && profileCheckError.code !== 'PGRST116') {
        console.error('Error checking user profile:', profileCheckError)
        return NextResponse.redirect(`${origin}/auth/signin?error=profile_check_error`)
      }

      let userProfile = existingProfile

      // Handle Google OAuth logic:
      // - If profile exists: Sign in existing user → dashboard
      // - If no profile: Create new account → choose-username for setup
      if (!userProfile) {
        console.log('Google OAuth: Creating new user profile for first-time user:', user.id)
        
        // Create basic profile for new Google user
        const newProfileData = {
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
          profile_picture_url: user.user_metadata?.avatar_url || null,
          user_type: 'creator' as 'creator' | 'advertiser', // Default, can be changed in choose-username
          is_active: true,
          email_confirmed_at: new Date().toISOString(),
          total_other_earnings: 0, // Initialize to 0
        }

        const { data: newProfile, error: insertError } = await supabase
          .from('users')
          .insert(newProfileData)
          .select()
          .single()

        if (insertError) {
          console.error('Error creating user profile for Google user:', insertError)
          return NextResponse.redirect(`${origin}/auth/signin?error=profile_creation_error&message=${encodeURIComponent(insertError.message)}`)
        }

        userProfile = newProfile
        console.log('Google OAuth: New user profile created, redirecting to choose-username')
      } else {
        console.log('Google OAuth: Existing user found, will redirect to dashboard')
      }

      // After userProfile is set (either found or created), update login_history
      const xff = request.headers.get('x-forwarded-for');
      let ip = xff ? xff.split(',')[0].trim() : null;
      if (!ip) {
        // @ts-ignore
        ip = request.ip || request.socket?.remoteAddress || null;
      }
      const userAgent = request.headers.get('user-agent') || '';

      // Simple user agent parser for browser and OS
      function parseUserAgent(ua: string) {
        let browser_name = 'Unknown', browser_version = '', os_name = 'Unknown', os_version = '';
        // Browser
        if (/Chrome\/(\d+\.\d+)/.test(ua)) {
          browser_name = 'Chrome';
          browser_version = ua.match(/Chrome\/(\d+\.\d+)/)![1];
        } else if (/Firefox\/(\d+\.\d+)/.test(ua)) {
          browser_name = 'Firefox';
          browser_version = ua.match(/Firefox\/(\d+\.\d+)/)![1];
        } else if (/Safari\/(\d+\.\d+)/.test(ua) && /Version\/(\d+\.\d+)/.test(ua)) {
          browser_name = 'Safari';
          browser_version = ua.match(/Version\/(\d+\.\d+)/)![1];
        } else if (/Edg\/(\d+\.\d+)/.test(ua)) {
          browser_name = 'Edge';
          browser_version = ua.match(/Edg\/(\d+\.\d+)/)![1];
        }
        // OS
        if (/Windows NT ([\d\.]+)/.test(ua)) {
          os_name = 'Windows';
          os_version = ua.match(/Windows NT ([\d\.]+)/)![1];
        } else if (/Mac OS X ([\d_]+)/.test(ua)) {
          os_name = 'Mac OS X';
          os_version = ua.match(/Mac OS X ([\d_]+)/)![1].replace(/_/g, '.');
        } else if (/Android ([\d\.]+)/.test(ua)) {
          os_name = 'Android';
          os_version = ua.match(/Android ([\d\.]+)/)![1];
        } else if (/iPhone OS ([\d_]+)/.test(ua)) {
          os_name = 'iOS';
          os_version = ua.match(/iPhone OS ([\d_]+)/)![1].replace(/_/g, '.');
        }
        return { browser_name, browser_version, os_name, os_version, user_agent: ua };
      }
      const uaInfo = parseUserAgent(userAgent);
      // Fetch current login_history
      let history = userProfile?.login_history || [];
      history.unshift({ ip_address: ip, timestamp: new Date().toISOString(), ...uaInfo });
      if (history.length > 10) history = history.slice(0, 10);
      await supabase
        .from('users')
        .update({ login_history: history })
        .eq('id', user.id);

      // Determine where to redirect based on profile completeness
      let redirectPath = '/dashboard'

      if (!userProfile || !userProfile.username) {
        // User needs to set up their username (and potentially other profile info)
        redirectPath = '/choose-username'
      }

      console.log('Redirecting OAuth user to:', redirectPath)
      return NextResponse.redirect(`${origin}${redirectPath}`)

    } catch (error: any) {
      console.error('OAuth callback error:', error)
      return NextResponse.redirect(`${origin}/auth/signin?error=callback_error&message=${encodeURIComponent(error.message)}`)
    }
  }

  // No code parameter, redirect to sign in
  return NextResponse.redirect(`${origin}/auth/signin?error=no_auth_code`)
} 