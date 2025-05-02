"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createSupabaseClient } from "@/lib/supabase/client"
import { type User as SupabaseUser } from "@supabase/supabase-js"

interface User extends SupabaseUser {
  avatar_url?: string;
  full_name?: string;
  profile_picture_url?: string | null;
}

interface AuthContextValue {
  isLoading: boolean
  user: User | null
  error: string | null
  needsUsername: boolean
  signUp: (email: string, password: string, fullName?: string, user_type?: "advertiser" | "creator", referralCode?: string) => Promise<{ success: boolean, emailConfirmationRequired: boolean, error: string | null }>
  signIn: (email: string, password: string) => Promise<{ success: boolean, error: string | null }>
  signOut: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (password: string) => Promise<void>
  updateUsername: (username: string) => Promise<{ success: boolean, error: string | null }>
  refreshUserData: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [needsUsername, setNeedsUsername] = useState<boolean>(false)
  const router = useRouter()
  const supabase = createSupabaseClient()

  const fetchAndSetFullUserData = async (coreAuthUser: SupabaseUser): Promise<User | null> => {
    try {
      const { data: publicUserData, error: publicUserError } = await supabase
        .from('users')
        .select('full_name, profile_picture_url')
        .eq('id', coreAuthUser.id)
        .maybeSingle();

      if (publicUserError) {
        console.warn('AuthContext: Could not fetch details from users table during refresh/load:', publicUserError.message);
        // Fallback to core data
        return { ...coreAuthUser } as User;
      } else {
        // Merge
        return {
          ...coreAuthUser,
          full_name: publicUserData?.full_name,
          profile_picture_url: publicUserData?.profile_picture_url,
        } as User;
      }
    } catch (error) {
      console.error("AuthContext: Error in fetchAndSetFullUserData:", error);
      // Fallback to core data on unexpected errors
      return { ...coreAuthUser } as User;
    }
  };

  // --- Reverted useEffect Structure for Initial Load --- 
  useEffect(() => {
    let isMounted = true;
    console.log("AuthContext: useEffect START (initial load check)");
    setIsLoading(true);

    // Check initial user status directly
    supabase.auth.getUser().then(async ({ data: { user: coreAuthUser }, error: coreAuthError }) => {
      console.log("AuthContext: Initial getUser() completed.", { coreAuthUser: !!coreAuthUser, coreAuthError: coreAuthError?.message });
      if (!isMounted) return; // Check mount status after async

      if (coreAuthError) {
        if (coreAuthError.message !== 'Auth session missing!') {
          console.error("AuthContext Initial Load: Error getting core user:", coreAuthError.message);
        }
        setUser(null);
      } else if (coreAuthUser) {
        // If core user exists initially, fetch full data
        console.log("AuthContext Initial Load: Core user found, fetching full data...");
        const fullUserData = await fetchAndSetFullUserData(coreAuthUser);
        if (isMounted) setUser(fullUserData);
        console.log("AuthContext Initial Load: Full user data set.");
      } else {
        setUser(null);
      }
    }).catch(error => {
      console.error("AuthContext Initial Load: Uncaught error during initial getUser/fetch:", error);
      if (isMounted) setUser(null);
    }).finally(() => {
      console.log("AuthContext Initial Load: FINALLY block, setting isLoading=false");
      if (isMounted) setIsLoading(false);
    });

    // Setup listener for SUBSEQUENT changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // No need to check isLoading here anymore, as this only handles subsequent events
        if (!isMounted) return;

        console.log("Auth State Change Event (Listener):", event);
        let userToSet: User | null = null;

        try {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            const { data: { user: coreAuthUser }, error: coreAuthError } = await supabase.auth.getUser();
            if (coreAuthError || !coreAuthUser) {
              if (coreAuthError) console.error('AuthContext Listener: Error getting core user:', coreAuthError.message);
              userToSet = null;
            } else {
              // Fetch full data on subsequent events too
              console.log(`AuthContext Listener: Fetching full data for user ${coreAuthUser.id}, event: ${event}`);
              userToSet = await fetchAndSetFullUserData(coreAuthUser);
            }
          } else if (event === 'SIGNED_OUT') {
            userToSet = null;
          } else {
            return; // Ignore other events like PASSWORD_RECOVERY
          }

          // Set state only if truly different
          if (user?.id !== userToSet?.id ||
            (user as User | null)?.full_name !== userToSet?.full_name ||
            (user as User | null)?.profile_picture_url !== userToSet?.profile_picture_url) {
            console.log("AuthContext Listener: Updating user state.");
            setUser(userToSet);
          }

        } catch (error) {
          console.error("AuthContext: Unexpected error processing auth event:", event, error);
        }
      }
    );

    // Cleanup
    return () => {
      isMounted = false;
      console.log("AuthContext: useEffect END (unmounting listener)");
      authListener?.subscription.unsubscribe();
    };
  }, [supabase.auth]);

  // --- Username Check Effect --- 
  useEffect(() => {
    // Check if user needs to set a username
    const checkUsername = async () => {
      if (user && !isLoading) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .maybeSingle();  // Use maybeSingle instead of single to avoid the error

          if (error) {
            console.warn('Error checking username:', error.message);
            // Don't update state on error during hot reload
            if (!error.message.includes('JWT') && !error.message.includes('auth')) {
              setNeedsUsername(false);
            }
            return;
          }

          setNeedsUsername(!data?.username);
        } catch (err) {
          console.warn('Unexpected error checking username:', err);
          // Don't change state on unexpected errors during hot reload
        }
      }
    };

    checkUsername();
  }, [user, isLoading]);

  const signUp = async (email: string, password: string, fullName?: string, user_type?: "advertiser" | "creator", referralCode?: string) => {
    setIsLoading(true)
    setError(null)
    try {
      // Check if user already exists
      const { data: existingUserCheck, error: checkError } = await supabase
        .from('users') // Assuming your public users table is named 'users'
        .select('id')
        .eq('email', email.toLowerCase().trim()) // Ensure consistent email format
        .maybeSingle(); // Use maybeSingle to handle no user found gracefully

      // Handle potential errors during the check itself
      if (checkError && checkError.code !== 'PGRST116') { // Ignore 'PGRST116' (No rows found)
        console.error("Error checking existing email:", checkError);
        throw new Error("Could not verify email. Please try again later.");
      }

      // If a user was found, throw the specific error
      if (existingUserCheck) {
        throw new Error("An account with this email already exists. Please sign in instead.");
      }

      // If referral code was provided, store it in sessionStorage
      if (referralCode) {
        // Check if the referral code exists using maybeSingle()
        const { data: referrerCheck, error: referrerError } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', referralCode)
          .maybeSingle(); // <-- Changed to maybeSingle()

        // Handle error checking referrer (ignoring null data)
        if (referrerError) {
          console.error("Error checking referral code:", referrerError);
          // Optionally, decide if this error should prevent signup or just log
          // For now, let's throw a generic error, but you might adjust this
          throw new Error("Could not verify referral code. Please try again later.");
        }

        // If referrerCheck is null, the code is invalid
        if (!referrerCheck) {
          throw new Error("Invalid referral code. Please check and try again.");
        }

        // Store the referral code in sessionStorage
        sessionStorage.setItem('referralCode', referralCode);
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            user_type: user_type || 'creator',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) throw error

      // Redirect to OTP verification page
      window.location.href = `/verify-otp?email=${encodeURIComponent(email)}`;

      return {
        success: true,
        emailConfirmationRequired: true,
        error: null
      };
    } catch (error: any) {
      let errorMessage = error.message;

      // Make the error message more user-friendly
      if (errorMessage.includes("violates unique constraint") && errorMessage.includes("users_email_key")) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
      } else if (errorMessage.includes("User already registered")) {
        errorMessage = "An account with this email already exists. Please sign in instead.";
      } else if (errorMessage === "An account with this email already exists. Please sign in instead.") {
        // Keep the message as is
      }

      setError(errorMessage);
      return {
        success: false,
        emailConfirmationRequired: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      // 1. Check if user exists first
      const { data: userCheck, error: userCheckError } = await supabase
        .from('users') // Ensure this is your public users table name
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      // Handle potential errors during the check itself (excluding not found)
      if (userCheckError && userCheckError.code !== 'PGRST116') { // PGRST116 means no rows found, which is expected if user doesn't exist
        console.error("Error checking user existence during sign in:", userCheckError);
        throw new Error("Could not verify your account information. Please try again later.");
      }

      // 2. If user doesn't exist, throw specific error
      if (!userCheck) {
        throw new Error("Account not found. Please register first.");
      }

      // 3. User exists, now attempt sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        // Handle specific sign-in errors
        let errorMessage = signInError.message;
        if (signInError.message.includes("Invalid login credentials")) {
          // Since we know the user exists, this must mean the password is wrong
          errorMessage = "The password that you've entered is incorrect.";
        } else if (signInError.message.includes("Email not confirmed")) {
          errorMessage = "Please confirm your email address before signing in.";
        }
        // Add more specific Supabase error checks here if needed

        throw new Error(errorMessage);
      }

      return { success: true, error: null };
    } catch (error: any) {
      setError(error.message)
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // First clear user state
      setUser(null)

      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error("Sign out error:", error)
        throw error
      }

      // Redirect to login page using Next.js router
      console.log("AuthContext: Signing out, redirecting to login page.");
      router.push('/auth/signin')
    } catch (error: any) {
      console.error("Sign out failed:", error)
      setError(error.message)
      // Even if there's an error, we should redirect to login page
      router.push('/auth/signin') // Use router here too
    } finally {
      setIsLoading(false)
    }
  }

  const forgotPassword = async (email: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const resetPassword = async (password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })
      if (error) throw error

      // Redirect to sign in page
      console.log("AuthContext: Reset password successful, redirecting to sign in page.");
      router.push('/auth/signin')
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const updateUsername = async (username: string) => {
    setIsLoading(true)
    setError(null)
    try {
      // Check if username is already taken
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (existingUser) {
        throw new Error("This username is already taken. Please choose another one.");
      }

      // Update the username
      const { error } = await supabase
        .from('users')
        .update({ username })
        .eq('id', user?.id);

      if (error) throw error

      // Update the local state
      setNeedsUsername(false)

      return { success: true, error: null };
    } catch (error: any) {
      setError(error.message)
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false)
    }
  }

  // --- Implement refreshUserData --- 
  const refreshUserData = async () => {
    console.log("AuthContext: Manual refreshUserData triggered.");
    const { data: { user: coreAuthUser }, error: coreAuthError } = await supabase.auth.getUser();
    if (coreAuthError || !coreAuthUser) {
      if (coreAuthError) console.error('AuthContext: Error getting core user during refresh:', coreAuthError.message);
      // Decide if you want to set user to null if refresh fails while logged in
      // Maybe only update if fetch is successful?
      return;
    }
    // Fetch full data and update state
    const freshUserData = await fetchAndSetFullUserData(coreAuthUser);
    if (JSON.stringify(user) !== JSON.stringify(freshUserData)) {
      console.log("AuthContext: Updating user state via manual refresh.");
      setUser(freshUserData);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        user,
        error,
        needsUsername,
        signUp,
        signIn,
        signOut,
        forgotPassword,
        resetPassword,
        updateUsername,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

