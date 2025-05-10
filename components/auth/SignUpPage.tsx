"use client";
import { BrandLogo } from "@/components/brand-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignUpPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [user_type, Setuser_type] = useState<"advertiser" | "creator">(
    "creator"
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Basic validation
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Password must be at least 6 characters",
        duration: 5000,
      });
      setIsLoading(false);
      return;
    }

    try {
      const fullName = `${firstName} ${lastName}`.trim();
      const normalizedEmail = email.trim();

      // 1. Check if email already exists and if username is set
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id, username')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116: "No rows found"
        console.error("Error checking existing email:", checkError);
        setError("Could not verify email. Please try again later.");
        toast({ variant: "destructive", title: "Verification Error", description: "Could not verify your email. Please try again." });
        setIsLoading(false);
        return;
      }

      if (existingUser) {
        if (!existingUser.username) {
          // Email exists, but username is not set
          setError("Your email is verified, but username setup is pending.");
          toast({
            variant: "default",
            title: "Profile Incomplete",
            description: (
              <div className="flex flex-col items-start space-y-2">
                <span>Your email is verified, but username setup is pending.</span>
                <Button
                  variant="outline" // Or your preferred secondary style
                  size="sm"
                  className="mt-2 text-xs h-auto py-1 px-2 border-blue-500 text-blue-500 hover:bg-blue-50 hover:text-blue-600"
                  onClick={() => router.push('/auth/signin')}
                >
                  Sign in to complete profile
                </Button>
              </div>
            ),
            duration: 10000,
          });
        } else {
          // Email exists, and username is set (fully registered user)
          setError("An account with this email already exists.");
          toast({
            variant: "destructive",
            title: "Account Already Exists",
            description: (
              <div className="flex flex-col items-start space-y-2">
                <span>An account with this email already exists.</span>
                <Button
                  variant="secondary" // Using a common secondary variant for ShadCN UI
                  size="sm"
                  className="mt-2 text-xs h-auto py-1 px-2" // Adjust styling as needed
                  onClick={() => router.push('/auth/signin')}
                >
                  Sign in instead
                </Button>
              </div>
            ),
            duration: 8000,
          });
        }
        setIsLoading(false);
        return;
      }

      // 2. Validate referral code (if provided)
      const trimmedReferralCode = referralCode.trim();
      if (trimmedReferralCode) {
        // Assuming referral codes are stored in a column named 'referral_code' in the 'users' table
        // This implies that a user's referral code is unique or identifiable.
        const { data: referrerCheck, error: referrerError } = await supabase
          .from('users')
          .select('id')
          .eq('referral_code', trimmedReferralCode)
          .maybeSingle();

        if (referrerError) {
          console.error("Error checking referral code:", referrerError);
          setError("Could not verify referral code. Please try again later.");
          toast({ variant: "destructive", title: "Referral Error", description: "Could not verify the referral code." });
          setIsLoading(false);
          return;
        }

        if (!referrerCheck) {
          setError("Invalid referral code. Please check and try again.");
          toast({ variant: "destructive", title: "Invalid Referral", description: "The referral code entered is invalid." });
          setIsLoading(false);
          return;
        }
      }

      // Proceed with Supabase auth sign up
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            user_type: user_type,
            referral_code: trimmedReferralCode || undefined, // Pass validated code
          },
          emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`
        },
      });

      if (signUpError) {
        console.error("Supabase signUp error:", signUpError);
        let errorMessage = signUpError.message;
        if (signUpError.message.includes("User already registered") ||
          signUpError.message.includes("already exists") ||
          (signUpError.message.includes("violates unique constraint") && signUpError.message.includes("email"))) {
          errorMessage = "An account with this email already exists.";
          setError(errorMessage);
          toast({
            variant: "destructive",
            title: "Account Exists",
            description: (
              <div className="flex flex-col items-start space-y-2">
                <span>{errorMessage}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2 text-xs h-auto py-1 px-2"
                  onClick={() => router.push('/auth/signin')}
                >
                  Sign in
                </Button>
              </div>
            ),
            duration: 8000,
          });
        } else {
          setError(errorMessage);
          toast({
            variant: "destructive",
            title: "Sign up failed",
            description: errorMessage,
            duration: 8000,
          });
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // User object exists, email verification (OTP) is likely required.
        toast({
          title: "Verification code sent!",
          description:
            "We've sent a verification code to your email address. Please check your inbox.",
          duration: 5000,
        });
        // Redirect to OTP verification page with email
        router.push(`/verify-otp?email=${encodeURIComponent(normalizedEmail)}`);
        // No need to setIsLoading(false) here as we are navigating away.
      } else {
        // This case might indicate that email confirmation is disabled and the user is auto-verified,
        // or some other unexpected state where data.user is null after a successful call.
        // For an OTP flow, this is unexpected if no signUpError was thrown.
        console.warn("SignUpPage: supabase.auth.signUp call was successful but data.user is null. This is unexpected for an OTP flow.", data);
        setError("Sign up process did not complete as expected for OTP. Please try again.");
        toast({
          variant: "destructive",
          title: "Sign up Incomplete",
          description: "Could not initiate the OTP verification process. Please try again.",
          duration: 5000,
        });
        setIsLoading(false);
      }
    } catch (err: any) { // Catch for truly unexpected errors (e.g., network, programming errors in checks)
      console.error("SignUpPage handleSubmit unexpected error:", err);
      // Avoid setting error/toasting again if it was already handled by a specific check above
      if (!error) { // Only set error if it hasn't been set by a prior, more specific check
        setError(err.message || "An unexpected error occurred. Please try again.");
        toast({
          variant: "destructive",
          title: "Error",
          description: err.message || "An unexpected error occurred. Please try again.",
          duration: 5000,
        });
      }
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <BrandLogo centered showText={false} size="lg" />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              The best way to grow your business
            </h1>
            <p className="text-sm text-mute d-foreground mt-1">
              Already have an account?{" "}
              <Link
                href="/auth/signin"
                className="text-primary font-medium hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Tabs
              defaultValue="creator"
              onValueChange={(value) =>
                Setuser_type(value as "advertiser" | "creator")
              }
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="advertiser">I'm a Brand</TabsTrigger>
                <TabsTrigger value="creator">I'm a Creator</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="6+ characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pr-10"
                  autoComplete="new-password"
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

            <div className="space-y-2">
              <Label htmlFor="referralCode">Referral code (optional)</Label>
              <Input
                id="referralCode"
                type="text"
                placeholder="Enter referral code"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-rose-600 hover:bg-rose-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By signing up, I agree to the{" "}
              <Link
                href="/terms-of-service"
                className="text-primary hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy-policy"
                className="text-primary hover:underline"
              >
                Privacy Policy
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
