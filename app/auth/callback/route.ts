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