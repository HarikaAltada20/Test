"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  TOAST_DURATION_MEDIUM,
  TOAST_DURATION_LONG,
} from "@/constants/subscriptionPlans";
import {
  Mail,
  Loader2,
  Crown,
  Trophy,
  Star,
  Sparkles,
  Rocket,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc";
import Image from "next/image";
import logo from "@/public/images/gold_logo_horizontal.svg";
import { FaFacebookF, FaInstagram } from "react-icons/fa";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const supabase = createClient();

  // Handle email sign-up
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    try {
      // Check if email already exists
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Error checking existing user:", checkError);
        throw new Error("Unable to verify email. Please try again.");
      }

      if (existingUser) {
        setError(
          "An account with this email already exists. Please sign in instead."
        );
        toast({
          variant: "destructive",
          title: "Account Already Exists",
          description:
            "This email is already registered. Please sign in instead.",
          duration: TOAST_DURATION_MEDIUM,
        });
        setIsLoading(false);
        return;
      }

      // Send OTP for new user
      const { data, error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          // Don't use callback for email OTP - users will manually enter code
          shouldCreateUser: true,
        },
      });

      if (otpError) {
        throw otpError;
      }

      toast({
        title: "Quest Initiated! 🚀",
        description: `Verification code sent to ${email}. Check your inbox to continue your journey!`,
        duration: TOAST_DURATION_LONG,
      });

      // Store email for OTP verification page
      localStorage.setItem("auth-email", email.trim().toLowerCase());

      // Redirect to OTP verification
      window.location.href = "/auth/verify-otp";
    } catch (err: any) {
      console.error("Email sign-up error:", err);
      setError(err.message || "Failed to send verification email");
      toast({
        variant: "destructive",
        title: "Quest Failed",
        description:
          err.message || "Failed to send verification email. Please try again.",
        duration: TOAST_DURATION_MEDIUM,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google OAuth sign-up
  const handleGoogleSignUp = async () => {
    setError(null);
    setIsGoogleLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      // OAuth redirect will handle the rest
    } catch (err: any) {
      console.error("Google sign-up error:", err);
      setError(err.message || "Failed to sign up with Google");
      toast({
        variant: "destructive",
        title: "Google Quest Failed",
        description:
          err.message || "Failed to sign up with Google. Please try again.",
        duration: 5000,
      });
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen  bg-[#000825] overflow-hidden relative">
      {/* Floating Gaming Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg rotate-45 opacity-60 animate-pulse"></div>
        <div
          className="absolute top-40 right-20 w-6 h-6 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full opacity-60 animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute bottom-60 left-20 w-4 h-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full opacity-60 animate-pulse"
          style={{ animationDelay: "4s" }}
        ></div>
        <Trophy
          className="absolute top-32 right-10 h-6 w-6 text-yellow-400/60 animate-bounce"
          style={{ animationDelay: "1s" }}
        />
        <Star
          className="absolute bottom-40 right-40 h-5 w-5 text-pink-400/60 animate-pulse"
          style={{ animationDelay: "3s" }}
        />
        <Rocket
          className="absolute top-60 left-40 h-7 w-7 text-cyan-400/60 animate-bounce"
          style={{ animationDelay: "5s" }}
        />
        <Zap
          className="absolute bottom-20 right-20 h-6 w-6 text-violet-400/60 animate-pulse"
          style={{ animationDelay: "2.5s" }}
        />
      </div>

      <div className="relative z-20 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl">
          {/* Premium Logo */}
          <div className="text-center">
            <div className="relative group">
              <div className="absolute inset-0 transition-opacity duration-500"></div>
              <div className="relative  p-4 ">
                <Image
                  src={logo}
                  alt="Game of Creators"
                  width={200}
                  height={70}
                  className="mx-auto"
                />
              </div>
            </div>
          </div>

          {/* Enhanced Gaming Container */}
          <div className="relative group">
            {/* Gaming Glow Effect */}

            <div className="relative p-8">
              {/* Gaming Header */}
              <div className="mb-8 text-center">
                <h1 className="text-3xl md:text-4xl font-black text-white drop-shadow-2xl mb-4">
                  Join The Arena
                </h1>
                <p className="text-slate-300 text-lg leading-relaxed">
                  Start your creator journey and unlock epic opportunities
                </p>
              </div>

              <form onSubmit={handleEmailSignUp} className="space-y-10">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300 font-medium">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email to begin"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12  bg-[#000825] border-slate-600/50 placeholder:text-slate-400 text-white focus:border-amber-500 focus:ring-amber-500 rounded-xl"
                      required
                      disabled={isLoading || isGoogleLoading}
                    />
                  </div>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {/* Gaming Sign Up Button */}
                <Button
                  type="submit"
                  className="group relative w-full text-white font-bold px-8 py-6 text-lg rounded-3xl overflow-hidden"
                  style={{
                    background:
                      "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
                  }}
                  disabled={isLoading || isGoogleLoading}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      <span className="relative z-10">Initiating Quest...</span>
                    </>
                  ) : (
                    <>
                      <span className="relative z-10">Begin Adventure</span>
                    </>
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="flex items-center my-6">
                <hr className="flex-1 border-gray-600" />
                <span className="px-3 text-gray-400">Or Continue with</span>
                <hr className="flex-1 border-gray-600" />
              </div>
              <div className="flex justify-center gap-4">
                {/* Google Sign Up Button */}
                <button
                  onClick={handleGoogleSignUp}
                  className="flex items-center text-md justify-center gap-2 p-2 rounded-md bg-white w-full max-w-xs text-gray-700 hover:bg-gray-100 transition"
                  disabled={isLoading || isGoogleLoading}
                >
                  {isGoogleLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                     <FcGoogle size={20} className="mr-1"/> 
                     <span>Continue with Google</span>
                     
                    </>
                  )}
                </button>
                {/* <button className="flex items-center justify-center gap-2 p-2 rounded-md bg-blue-600 w-12 text-white hover:bg-blue-700 transition">
                  <FaFacebookF size={18} />
                </button>
                <button className="flex items-center justify-center gap-2 p-2 rounded-md bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 w-12 text-white hover:opacity-90 transition">
                  <FaInstagram size={18} />
                </button> */}
              </div>
              {/* Sign In Link */}
              <div className="mt-8 text-center">
                <p className="text-slate-400">
                  Already in the arena?{" "}
                  <Link
                    href="/auth/signin"
                    className="font-semibold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent hover:from-violet-300 hover:to-purple-300 transition-all"
                  >
                    Sign in here
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
