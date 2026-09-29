"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Crown,
  Trophy,
  Star,
  Sparkles,
  Key,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import Link from "next/link";
import logo from "@/public/images/Primary Logo white 1.png";
import { createClient } from "@/utils/supabase/client";
import {
  validatePassword,
  getPasswordErrorMessage,
} from "@/lib/password-utils";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) {
      // Potentially redirect or show an error if no hash is present,
      // as this page is typically accessed via a link with a token.
      // For now, we let it proceed, and Supabase will error if the session is invalid.
    }

    const handlePasswordReset = async () => {
      try {
        const { error: refreshError } = await supabase.auth.refreshSession(); // Only refresh if hash exists
        if (refreshError && hash) {
          // Only throw if hash was present, indicating an attempt to use a link
          throw new Error(
            "Invalid or expired reset link. Please request a new one."
          );
        }
        // If there's no hash and no error, user might be trying to access directly or session is already fine.
      } catch (err: any) {
        setError(err.message);
        toast({
          variant: "destructive",
          title: "Portal Link Error",
          description:
            err.message ||
            "Invalid or expired reset link. Please request a new one.",
          duration: 6000,
        });
      }
    };
    if (hash) {
      // Only attempt to handle password reset if there's a hash fragment from the URL
      handlePasswordReset();
    }
  }, [supabase, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      toast({
        variant: "destructive",
        title: "Passwords Don't Match",
        description: "Passwords do not match",
        duration: 5000,
      });
      setIsLoading(false);
      return;
    }

    // Validate password using comprehensive validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      const errorMessage = getPasswordErrorMessage(passwordValidation);
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Password Requirements Not Met",
        description: errorMessage,
        duration: 6000,
      });
      setIsLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      // Patch app_metadata.providers to include 'email' if missing
      const { data: user } = await supabase.auth.getUser();
      console.log(
        "Current user providers:",
        user?.user?.app_metadata?.providers
      );

      if (
        user &&
        user.user &&
        user.user.app_metadata &&
        !user.user.app_metadata.providers?.includes("email")
      ) {
        console.log("Attempting to patch providers to include email...");

        // Call the API route to patch providers (server-side operation)
        try {
          const response = await fetch("/api/patch-providers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: user.user.id,
              providers: [...(user.user.app_metadata.providers || []), "email"],
            }),
          });

          if (!response.ok) {
            const errorData = await response.text();
            console.error("Failed to patch providers via API:", errorData);
          } else {
            console.log("Successfully patched providers to include email");
          }
        } catch (patchError) {
          console.error("Error patching providers:", patchError);
        }
      } else {
        console.log(
          "Email provider already exists or user metadata not available"
        );
      }

      setIsSuccess(true);
      toast({
        title: "Access Restored! 🚀",
        description: "Your password has been updated. Welcome back, champion!",
        duration: 5000,
      });
      // Redirect to dashboard after successful password reset
      // Using replace to prevent back navigation and refresh to update auth state
      setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 3000);
    } catch (err: any) {
      let errorMessage = "Failed to reset password. Please try again.";
      if (
        err.message.includes(
          "New password should be different from the old password"
        )
      ) {
        errorMessage = "New password must be different from your old password.";
      } else if (err.message.includes("same as the old password")) {
        errorMessage = "New password cannot be the same as your old password.";
      }
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsLoading(false); // Ensure loading is stopped only if not successful and redirecting
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-black overflow-hidden relative">
      {/* Top Gray Shade */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-28 sm:h-48 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/60 to-transparent z-10" />
        <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.08)_35%,transparent_70%)]" />
      </div>

      {/* Enhanced Background Elements - Gamified */}



      <div className="relative z-20 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-2xl">
          {/* Premium Logo */}
          <div className="text-center">
            <div className="relative group">
              <div className="absolute inset-0 transition-opacity duration-500"></div>
              <div className="relative pt-6 pb-0">
                <Link href="/">
                  <Image
                    src={logo}
                    alt="Game of Creators"
                    width={260}
                    height={90}
                    className="mx-auto cursor-pointer"
                  />
                </Link>
              </div>
            </div>
          </div>

          {/* Enhanced Gaming Container */}
          <div className="relative group">
            {/* Gaming Glow Effect */}

            <div className="relative p-8">
              {/* Gaming Header */}
              <div className="mb-8 text-center">
                <h1 className="text-3xl md:text-4xl font-black bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent drop-shadow-2xl mb-4">
                  Forge New Password
                </h1>

                {!isSuccess && (
                  <p className="text-slate-300 text-lg leading-relaxed">
                    Create a powerful new password for your account
                  </p>
                )}
              </div>

              {isSuccess ? (
                <div className="text-center space-y-6">
                  {/* Success Icon */}
                  <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full blur-xl opacity-60 animate-pulse"></div>
                    <div className="relative w-full h-full bg-gradient-to-br from-emerald-600 to-cyan-600 rounded-full flex items-center justify-center border border-emerald-400/30 shadow-xl shadow-emerald-500/20">
                      <CheckCircle className="h-12 w-12 text-white" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-3xl font-bold bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent">
                      Access Restored!
                    </h3>
                    <p className="text-slate-300">
                      Your password has been successfully updated.
                      <br />
                      Welcome back!
                    </p>
                  </div>

                  <Button
                    className="group relative w-full bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 hover:from-emerald-500 hover:via-cyan-500 hover:to-blue-500 text-white font-bold px-8 py-4 text-lg rounded-xl shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-500/60 transition-all duration-300 hover:scale-105 border border-emerald-400/30 overflow-hidden"
                    onClick={() => {
                      router.replace("/dashboard");
                      router.refresh();
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                    <Shield className="mr-2 h-5 w-5" />
                    <span className="relative z-10">Enter Dashboard</span>
                    <Crown className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-10 mb-6">
                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="password"
                      className="text-white font-medium"
                    >
                      New Password
                    </Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create your new password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-12 h-12 bg-black border-white/20 placeholder:text-slate-500 text-white focus:border-white focus:ring-white focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-offset-0 rounded-xl"
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition-colors"
                        onClick={togglePasswordVisibility}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>

                    {/* Real-time Password Strength Meter */}
                    <PasswordStrengthMeter
                      password={password}
                      className="mt-3"
                      showRequirements={true}
                    />
                  </div>

                  {/* Confirm Password Field */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="confirmPassword"
                      className="text-white font-medium"
                    >
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-12 h-12 bg-black border-white/20 placeholder:text-slate-500 text-white focus:border-white focus:ring-white focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-offset-0 rounded-xl"
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition-colors"
                        onClick={toggleConfirmPasswordVisibility}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Gaming Reset Button */}
                  <Button
                    type="submit"
                    className="group relative w-full text-white font-bold px-8 py-6 text-lg rounded-xl border border-white/20 bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] hover:bg-white/10 transition-all duration-300 overflow-hidden"
                    disabled={isLoading || isSuccess}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        <span className="relative z-10">
                          Forging New Password...
                        </span>
                      </>
                    ) : (
                      <>
                       
                        <span className="relative z-10">
                          Forge New Password
                        </span>
                       
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
