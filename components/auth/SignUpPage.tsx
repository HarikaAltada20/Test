"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import logo from "@/public/images/gold_logo_vertical.svg";


export default function SignUpPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [user_type, Setuser_type] = useState<"advertiser" | "creator">("creator");
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

      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id, username')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error("Error checking existing email:", checkError);
        setError("Could not verify email. Please try again later.");
        toast({ variant: "destructive", title: "Verification Error", description: "Could not verify your email. Please try again." });
        setIsLoading(false);
        return;
      }

      if (existingUser) {
        if (!existingUser.username) {
          setError("Your email is verified, but username setup is pending.");
          toast({
            variant: "default", // Keep default for info, but style button
            title: "Profile Incomplete",
            description: (
              <div className="flex flex-col items-start space-y-2">
                <span>Your email is verified, but username setup is pending.</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs h-auto py-1 px-2 border-amber-500 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                  onClick={() => router.push('/auth/signin')}
                >
                  Sign in to complete profile
                </Button>
              </div>
            ),
            duration: 10000,
          });
        } else {
          setError("An account with this email already exists.");
          toast({
            variant: "destructive",
            title: "Account Already Exists",
            description: (
              <div className="flex flex-col items-start space-y-2">
                <span>An account with this email already exists.</span>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2 text-xs h-auto py-1 px-2 text-amber-500 hover:text-amber-400"
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

      const trimmedReferralCode = referralCode.trim();
      if (trimmedReferralCode) {
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

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            user_type: user_type,
            referral_code: trimmedReferralCode || undefined,
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
                  variant="link"
                  size="sm"
                  className="mt-2 text-xs h-auto py-1 px-2 text-amber-500 hover:text-amber-400"
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
        toast({
          title: "Verification code sent!",
          description:
            "We\'ve sent a verification code to your email address. Please check your inbox.",
          duration: 5000,
        });
        router.push(`/verify-otp?email=${encodeURIComponent(normalizedEmail)}`);
      } else {
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
    } catch (err: any) {
      console.error("SignUpPage handleSubmit unexpected error:", err);
      if (!error) {
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
    <>
      <style jsx global>{`
        @keyframes border-flow {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        .animate-border-flow {
          background-image: linear-gradient(to right, #FBBF24, #F59E0B, #D97706, #F59E0B, #FBBF24);
          background-size: 300% auto;
          animation: border-flow 5s linear infinite;
        }
      `}</style>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-blue-950 dark:bg-gray-900 px-4 pt-4 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-10 flex flex-col items-center">
            <Image
              src={logo}
              alt="Game Of Creators Logo"
              priority
              width={150}
              height={150}
            />
          </div>

          <div className="p-[2.5px] rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 animate-border-flow shadow-2xl">
            <div className="bg-[#0B0F11] dark:bg-gray-800 rounded-lg p-8">
              <div className="mb-6 text-center">
                <h1 className="text-3xl font-bold text-white dark:text-white">
                  Create Account
                </h1>
                <p className="text-sm text-slate-400 mt-2">
                  Already have an account?{" "}
                  <Link
                    href="/auth/signin"
                    className="font-medium text-amber-500 hover:text-amber-400"
                  >
                    Sign In
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
                  value={user_type}
                  onValueChange={(value) =>
                    Setuser_type(value as "advertiser" | "creator")
                  }
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 bg-slate-800">
                    <TabsTrigger value="creator" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">Creator</TabsTrigger>
                    <TabsTrigger value="advertiser" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">Brand</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-slate-300">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="h-11 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500"
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-slate-300">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="h-11 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="h-11 pr-10 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                      onClick={togglePasswordVisibility}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Password must be at least 6 characters.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referralCode" className="text-slate-300">
                    Referral Code{" "}
                    <span className="text-slate-500">(Optional)</span>
                  </Label>
                  <Input
                    id="referralCode"
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    className="h-11 bg-slate-900 border-slate-700 placeholder:text-slate-500 text-white focus:border-amber-500 focus:ring-amber-500"
                    placeholder="Enter referral code"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
                <p className="text-xs text-center text-slate-500">
                  By signing up, I agree to the{" "}
                  <Link
                    href="/terms-of-service"
                    className="font-medium text-amber-500 hover:text-amber-400 underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy-policy"
                    className="font-medium text-amber-500 hover:text-amber-400 underline"
                  >
                    Privacy Policy
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
