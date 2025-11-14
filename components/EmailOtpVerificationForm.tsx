"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailOtpVerificationFormProps {
  isDark: boolean;
  newEmail: string;
  onVerified: () => void;
  onBack: () => void;
}

export function EmailOtpVerificationForm({
  isDark,
  newEmail,
  onVerified,
  onBack,
}: EmailOtpVerificationFormProps) {
  const [otp, setOtp] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    if (!otp || otp.length !== 6) {
      setEmailError("Please enter the 6-digit verification code");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: verifyData, error: verifyError } =
        await supabase.auth.verifyOtp({
          email: newEmail.trim(),
          token: otp,
          type: "email_change",
        });

      if (verifyError) {
        throw new Error(verifyError.message || "Invalid verification code");
      }

      // Check if verifyData contains the updated user with new email
      let finalEmail = verifyData.user?.email || newEmail.trim();

      console.log("OTP verification response:", {
        verifyDataUser: verifyData.user?.email,
        verifyDataSession: !!verifyData.session,
        expectedEmail: newEmail.trim(),
      });

      if (verifyData?.session) {
        const { error: sessionError } = await supabase.auth.setSession(
          verifyData.session
        );
        if (sessionError) {
          throw new Error(
            sessionError.message ||
              "Failed to set new session after email change"
          );
        }
      }

      // Use the email from verifyData.user if available, as it's the most reliable
      if (verifyData.user?.email) {
        finalEmail = verifyData.user.email;
        console.log("Using email from verifyData.user:", finalEmail);
      } else {
        // If not in verifyData, wait and retry getting the user
        console.log("Email not in verifyData, waiting and retrying...");
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Retry getting user with exponential backoff
        let refreshedUser = null;
        let retries = 3;
        let delay = 500;

        for (let i = 0; i < retries; i++) {
          const {
            data: { user },
            error: refreshError,
          } = await supabase.auth.getUser();

          if (refreshError) {
            console.error(
              `Error refreshing user (attempt ${i + 1}):`,
              refreshError
            );
            if (i === retries - 1) {
              throw new Error(
                refreshError.message ||
                  "Failed to refresh user after email change"
              );
            }
          } else if (user) {
            refreshedUser = user;
            if (
              user.email &&
              user.email.toLowerCase() === newEmail.trim().toLowerCase()
            ) {
              finalEmail = user.email;
              console.log(
                "Email updated successfully after retry:",
                finalEmail
              );
              break;
            }
          }

          if (i < retries - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          }
        }

        if (!refreshedUser) {
          throw new Error("User session not found after email change");
        }

        // Final check - use refreshed user email if it matches, otherwise use what we have
        if (
          refreshedUser.email &&
          refreshedUser.email.toLowerCase() === newEmail.trim().toLowerCase()
        ) {
          finalEmail = refreshedUser.email;
        }
      }

      // Final validation - the email must match what was expected
      // If it doesn't match, this indicates the OTP was verified for a different email
      // This can happen if:
      // 1. Multiple email change requests were initiated
      // 2. The OTP code was used for a different email change
      // 3. There's a race condition with concurrent requests
      if (finalEmail.toLowerCase() !== newEmail.trim().toLowerCase()) {
        console.error("Email mismatch after OTP verification:", {
          expected: newEmail.trim(),
          got: finalEmail,
          verifyDataUserEmail: verifyData.user?.email,
          verifyDataSession: !!verifyData.session,
        });

        // This is a critical error - fail the verification
        throw new Error(
          `Email verification failed: The email in your account (${finalEmail}) does not match the email you're trying to change to (${newEmail.trim()}). This may happen if you have multiple email change requests in progress. Please cancel any other email change requests and try again with a fresh verification code sent to ${newEmail.trim()}.`
        );
      }

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser?.id) {
        const { error } = await supabase
          .from("users")
          .update({ email: finalEmail })
          .eq("id", currentUser.id);
        if (error) throw error;
      }

      toast({
        title: "Email Updated Successfully",
        description: "Your email has been successfully updated.",
      });

      // Notify other components about the profile update
      window.dispatchEvent(new CustomEvent("profile-updated"));

      // Refresh the page to ensure middleware sees the updated session
      window.location.reload();
    } catch (error: any) {
      setEmailError(error.message || "Failed to verify code");
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description:
          error.message || "Invalid verification code. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setEmailError(null);
    setIsSendingOtp(true);
    try {
      const { error: otpError } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });

      if (otpError) {
        throw new Error(
          otpError.message || "Failed to resend verification code"
        );
      }

      toast({
        title: "Code Resent",
        description: `A new 6-digit verification code has been sent to ${newEmail.trim()}.`,
      });
    } catch (error: any) {
      setEmailError(error.message || "Failed to resend code");
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to resend verification code.",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  return (
    <form onSubmit={handleVerifyOtp} className="space-y-4">
      {/* OTP Field */}
      <div className="space-y-2">
        <Label
          htmlFor="otp"
          className={cn(isDark ? "text-white" : "text-gray-900")}
        >
          Verification Code
        </Label>
        <Input
          id="otp"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "");
            if (value.length <= 6) {
              setOtp(value);
            }
          }}
          placeholder="000000"
          className={cn(
            "text-center text-2xl tracking-widest",
            isDark
              ? "bg-[#180438] border border-gray-600 text-white"
              : "bg-white"
          )}
          required
        />
        <p
          className={cn(
            "text-xs text-center",
            isDark ? "text-gray-400" : "text-gray-500"
          )}
        >
          Enter the 6-digit code sent to {newEmail.trim()}
        </p>
      </div>

      {/* Error Message */}
      {emailError && <div className="text-sm text-red-500">{emailError}</div>}

      {/* Buttons */}
      <div className="flex flex-col gap-2 pt-4">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting}
            className={cn(
              isDark ? "border-gray-600 text-white hover:bg-[#2a0a5a]" : ""
            )}
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              isDark
                ? "bg-[#7F39EC] hover:bg-[#6B2FC7] text-white"
                : "bg-[#7F39EC] hover:bg-[#6B2FC7] text-white"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Update"
            )}
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={handleResendOtp}
          disabled={isSendingOtp || isSubmitting}
          className={cn(
            "text-sm",
            isDark ? "text-gray-400 hover:text-white" : "text-gray-600"
          )}
        >
          {isSendingOtp ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Resending...
            </>
          ) : (
            "Resend Code"
          )}
        </Button>
      </div>
    </form>
  );
}
