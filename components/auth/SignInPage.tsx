"use client";

import { BrandLogo } from "@/components/brand-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function SignInForm({ verification }: { verification: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (verification === "pending") {
      toast({
        title: "Verification Email Sent",
        description:
          "Please check your email and verify your account before signing in.",
        duration: 6000, // 6 seconds
      });
    }
    setError(null);
    setIsLoading(true);

    try {
      const normalizedEmail = email.trim(); // Normalize email
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail, // Use normalized email
        password: password,
      });

      if (data.user) {
        // User successfully signed in with Supabase Auth.
        // Now, check their profile in the public users table.
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          // Fetch all fields needed by ChooseUsernamePage or for general session context
          .select('username, full_name, user_type, referred_by')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileError && profileError.code !== 'PGRST116') { // PGRST116 means no rows found
          console.error("SignInPage: Error fetching user profile:", profileError);
          setError("Failed to retrieve your profile. Please try again.");
          toast({ variant: "destructive", title: "Profile Error", description: "Could not retrieve your profile information.", duration: 5000 });
          setIsLoading(false);
          return;
        }

        // If userProfile is null here, it means the public.users row wasn't created at OTP/signup.
        // This would be an inconsistent state. For now, we'll proceed, and ChooseUsernamePage might catch it,
        // or they might get stuck if ChooseUsernamePage strictly expects a profile.
        // Ideally, the OTP verification step ALWAYS creates the public.users row.
        if (!userProfile) {
          console.warn(`SignInPage: No public.users profile found for authenticated user ${data.user.id}. This indicates an issue with profile creation at OTP/signup.`);
          // Fallback: proceed to choose-username with minimal data, or redirect to an error/support page.
          // For now, we'll attempt to let them set a username, but ChooseUsernamePage might need robust handling for missing profiles.
        }

        toast({
          title: "Success!",
          description: "You've been signed in successfully.",
          duration: 3000,
        });

        if (userProfile && userProfile.username) {
          // Username is set, redirect to dashboard
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 300);
        } else {
          // Username is NOT set (or profile was missing).
          // ChooseUsernamePage will fetch the necessary data based on the authenticated user.
          // No need to set sessionStorage here anymore.
          setTimeout(() => {
            router.push("/choose-username");
          }, 300);
        }

      } else if (signInError) { // Explicitly check if signInError is not null
        if (signInError.message.includes("Invalid login credentials")) {
          // Check if the email exists in the public users table
          const { data: userExistsCheck, error: checkError } = await supabase
            .from('users') // Your public users table
            .select('id')
            .eq('email', normalizedEmail) // Use normalized email for the check
            .maybeSingle();

          if (checkError && checkError.code !== 'PGRST116') { // PGRST116: No rows found
            console.error("Error checking if user exists:", checkError);
            // Fallback to a generic error if the check itself fails
            setError("Failed to sign in. Please try again later.");
            toast({ variant: "destructive", title: "Sign in Error", description: "An unexpected error occurred. Please try again.", duration: 5000 });
          } else if (!userExistsCheck) {
            setError("Account not found. Please register first.");
            toast({ variant: "destructive", title: "Account Not Found", description: "No account found with this email. Please register.", duration: 5000 });
          } else {
            setError("Incorrect password. Please try again.");
            toast({ variant: "destructive", title: "Incorrect Password", description: "The password you entered is incorrect.", duration: 5000 });
          }
        } else {
          // Handle other Supabase auth errors
          setError(signInError.message || "Failed to sign in");
          toast({
            variant: "destructive",
            title: "Sign in failed",
            description: signInError.message || "Failed to sign in. Please check your credentials.",
            duration: 5000,
          });
        }
        setIsLoading(false);
      } else {
        // Fallback for unexpected cases where there's no user and no error
        setError("An unexpected error occurred during sign in.");
        toast({ variant: "destructive", title: "Sign in failed", description: "An unexpected error occurred. Please try again.", duration: 5000 });
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to sign in",
        duration: 5000, // 5 seconds
      });
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          name="email"
          placeholder="name@example.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/auth/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-11 pr-10"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            onClick={togglePasswordVisibility}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-11 bg-rose-600 hover:bg-rose-700"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}

export default function SignInPage({ verification }: { verification: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <BrandLogo centered showText={false} size="lg" />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Sign In
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/signup"
                className="text-primary font-medium hover:underline"
              >
                Get started
              </Link>
            </p>
          </div>

          <SignInForm verification={verification} />
        </div>
      </div>
    </div>
  );
}
