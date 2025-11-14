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

      // Set the session first if provided
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

      // Wait a moment for the email change to propagate
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify the email was actually updated in auth
      let finalEmail = newEmail.trim();
      let retries = 5;
      let delay = 500;
      let emailUpdated = false;

      for (let i = 0; i < retries; i++) {
        const {
          data: { user },
          error: refreshError,
        } = await supabase.auth.getUser();

        if (refreshError) {
          console.error(`Error getting user (attempt ${i + 1}):`, refreshError);
          if (i === retries - 1) {
            throw new Error(
              refreshError.message ||
                "Failed to verify email change. Please try logging in with your new email."
            );
          }
        } else if (user?.email) {
          const userEmail = user.email.toLowerCase();
          const expectedEmail = newEmail.trim().toLowerCase();

          if (userEmail === expectedEmail) {
            finalEmail = user.email;
            emailUpdated = true;
            console.log("Email successfully updated in auth:", finalEmail);
            break;
          } else {
            console.log(
              `Email not yet updated (attempt ${i + 1}/${retries}):`,
              `Expected: ${expectedEmail}, Got: ${userEmail}`
            );
          }
        }

        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5; // Gradual backoff
        }
      }

      if (!emailUpdated) {
        throw new Error(
          "Email change verification timed out. The email may not have been updated. Please try logging in with your new email address, or contact support if the issue persists."
        );
      }

      // Update the users table to keep it in sync
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser?.id) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ email: finalEmail })
          .eq("id", currentUser.id);

        if (updateError) {
          console.error("Error updating users table:", updateError);
          // Don't throw here - the auth email is already updated, which is the critical part
          // The users table update is secondary and can be synced later
        }
      }

      toast({
        title: "Email Updated Successfully",
        description: `Your email has been successfully updated to ${finalEmail}. You can now log in with your new email address.`,
      });

      // Notify other components about the profile update
      window.dispatchEvent(new CustomEvent("profile-updated"));

      // Wait a moment before reloading to ensure all updates are complete
      await new Promise((resolve) => setTimeout(resolve, 500));

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
