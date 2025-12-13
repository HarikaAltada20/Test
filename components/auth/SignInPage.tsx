"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  TOAST_DURATION_SHORT,
  TOAST_DURATION_MEDIUM,
} from "@/constants/subscriptionPlans";
import {
  Mail,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Crown,
  Trophy,
  Star,
  Sparkles,
  Shield,
  Gamepad2,
} from "lucide-react";
import Link from "next/link";
import { FcGoogle } from "react-icons/fc";
import { useRouter } from "next/navigation";
import Image from "next/image";
import logo from "@/public/images/gold_logo_horizontal.svg";
import { FaFacebookF, FaInstagram } from "react-icons/fa";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();

  // Handle email/password sign-in
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email || !password) {
      setError("Please enter both email and password");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password,
        });

      if (signInError) {
        throw signInError;
      }

      if (!data.user) {
        throw new Error("Sign in failed - no user data returned");
      }

      // Record login IP
      try {
        const userAgent =
          typeof window !== "undefined" ? navigator.userAgent : "";
        await fetch("/api/login-ip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: data.user.id,
            user_agent: userAgent,
          }),
        });
      } catch (err) {
        console.warn("Failed to record login IP:", err);
      }

      toast({
        title: `Welcome back, ${
          data.user?.user_metadata?.full_name || "User"
        }!`,
        description: "You have successfully signed in.",
        duration: TOAST_DURATION_SHORT,
      });

      // Navigate to dashboard and refresh to update layout with new auth state
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      console.error("Email sign-in error:", err);
      let errorMessage = "Failed to sign in. Please try again.";

      if (err.message?.includes("Invalid login credentials")) {
        errorMessage =
          "Invalid email or password. Please check your credentials.";
      } else if (err.message?.includes("Email not confirmed")) {
        errorMessage = "Please verify your email address before signing in.";
      }

      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: errorMessage,
        duration: TOAST_DURATION_MEDIUM,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google OAuth sign-in
  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);

    try {
      // Detect if running in mobile app WebView
      const isMobile = /GameOfCreators-Mobile/i.test(navigator.userAgent);

      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: isMobile
            ? `${window.location.origin}/mobile/auth/callback`
            : `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (signInError) {
        throw signInError;
      }

      // OAuth redirect will handle the rest
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      setError(err.message || "Failed to sign in with Google");
      toast({
        variant: "destructive",
        title: "Google Access Failed",
        description:
          err.message || "Failed to sign in with Google. Please try again.",
        duration: TOAST_DURATION_MEDIUM,
      });
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000825] overflow-hidden relative">
      {/* Enhanced Background Elements - Gamified */}

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
        <Shield
          className="absolute top-60 left-40 h-7 w-7 text-cyan-400/60 animate-bounce"
          style={{ animationDelay: "5s" }}
        />
        <Gamepad2
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
            <div className="absolute inset-0 transition-opacity duration-500"></div>

            <div className="relative p-8">
              {/* Gaming Header */}
              <div className="mb-8 text-center">
                <h1 className="text-3xl md:text-4xl font-black text-white drop-shadow-2xl mb-4">
                  Welcome Back Champion
                </h1>
                <p className="text-slate-300 text-md leading-relaxed">
                  Enter your credentials to access the Game Of Creators arena
                </p>
              </div>

              <form onSubmit={handleEmailSignIn} className="space-y-6">
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
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 bg-[#000825] border-slate-600/50 placeholder:text-slate-400 text-white focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                      required
                      disabled={isLoading || isGoogleLoading}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-slate-300 font-medium"
                  >
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-12 h-12 bg-[#000825]  border-slate-600/50 placeholder:text-slate-400 text-white focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                      required
                      disabled={isLoading || isGoogleLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div className="flex justify-end">
                  <Link
                    href="/auth/forgot-password"
                    className="text-md text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {/* Gaming Sign In Button */}
                <Button
                  type="submit"
                  className="group relative w-full text-white font-bold px-8 py-6 text-lg rounded-3xl transition-all duration-300 overflow-hidden"
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
                      <span className="relative z-10">Accessing Arena...</span>
                    </>
                  ) : (
                    <>
                      <span className="relative z-10">Enter Arena</span>
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
                {/* Google Sign In Button */}
                <button
                  onClick={handleGoogleSignIn}
                  aria-label="Continue with Google"
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
                      <FcGoogle size={20} className="mr-1" />
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
              {/* Sign Up Link */}
              <div className="mt-8 text-center">
                <p className="text-slate-400">
                  New to the arena?{" "}
                  <Link
                    href="/auth/signup"
                    className="font-semibold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent hover:from-violet-300 hover:to-purple-300 transition-all"
                  >
                    Join the game
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
