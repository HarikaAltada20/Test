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
      // Capture the user's current email BEFORE we start the OTP verification flow.
      // This allows us to correctly log old_email -> new_email transitions even when
      // the standard Supabase OTP flow updates the email without hitting our admin API.
      const {
        data: { user: userBefore },
      } = await supabase.auth.getUser();
      const originalEmail = userBefore?.email || null;

      let usedForceUpdate = false;

      const { data: verifyData, error: verifyError } =
        await supabase.auth.verifyOtp({
          email: newEmail.trim(),
          token: otp,
          type: "email_change",
        });

      if (verifyError) {
        throw new Error(verifyError.message || "Invalid verification code");
      }

      let finalEmail = newEmail.trim();
      let emailUpdated = false;

      // Set the session if provided - this is critical for the email change to take effect
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

      // Check if email is already updated in verifyData
      if (verifyData?.user?.email) {
        const verifiedEmail = verifyData.user.email.toLowerCase();
        const expectedEmail = newEmail.trim().toLowerCase();
        if (verifiedEmail === expectedEmail) {
          finalEmail = verifyData.user.email;
          emailUpdated = true;
        }
      }

      // If not updated, check once more after setting session
      if (!emailUpdated) {
        const {
          data: { user },
          error: getUserError,
        } = await supabase.auth.getUser();

        if (!getUserError && user?.email) {
          const userEmail = user.email.toLowerCase();
          const expectedEmail = newEmail.trim().toLowerCase();
          if (userEmail === expectedEmail) {
            finalEmail = user.email;
            emailUpdated = true;
          }
        }
      }

      // If email still isn't updated, use admin API to force-update immediately
      // This is much faster than waiting for async processing
      if (!emailUpdated) {
        try {
          const response = await fetch("/api/account/update-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ newEmail: newEmail.trim() }),
          });

          const result = await response.json();

          if (!response.ok) {
            // Handle monthly limit error (429 status)
            if (response.status === 429) {
              throw new Error(
                result.error ||
                  "You can only change your email once per month. Please try again later."
              );
            }
            throw new Error(
              result.error || "Failed to force-update email via admin API"
            );
          }

          if (result.email) {
            finalEmail = result.email;
            emailUpdated = true;
            usedForceUpdate = true;

            // Refresh the session to get the updated user data
            await supabase.auth.refreshSession();
          } else {
            throw new Error("Admin API returned success but no email");
          }
        } catch (forceUpdateError: any) {
          console.error("Error force-updating email:", forceUpdateError);
          throw new Error(
            `Email change verification completed, but failed to update email: ${forceUpdateError.message}. ` +
              "Please try again or contact support if the issue persists."
          );
        }
      }

      // Verify the email is updated and sync users table
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser?.id) {
        // Update users table to keep it in sync
        const { error: updateError } = await supabase
          .from("users")
          .update({ email: finalEmail })
          .eq("id", currentUser.id);

        if (updateError) {
          console.error("Error syncing users table:", updateError);
          // Don't throw - auth email is updated which is critical
        }
      }

      // Best-effort logging of the email change for audit purposes.
      // If the force-update path was used, the API route already logged the change.
      // If the normal OTP flow handled the change, we call the API in log-only mode.
      try {
        if (
          !usedForceUpdate &&
          originalEmail &&
          finalEmail &&
          originalEmail.toLowerCase() !== finalEmail.toLowerCase()
        ) {
          await fetch("/api/account/update-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              newEmail: finalEmail,
              oldEmail: originalEmail,
              logOnly: true,
            }),
          });
        }
      } catch (logError) {
        console.error("Error logging email change:", logError);
        // Don't surface this to the user – email has already been updated.
      }

      toast({
        title: "Email Updated Successfully",
        description: `Your email has been successfully updated to ${finalEmail}. You can now log in with your new email address.`,
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
              ? "bg-[#06021d] border border-gray-600 text-white"
              : "bg-white text-black"
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
              isDark
                ? "border-gray-600 text-white hover:bg-[#2a0a5a]"
                : "text-black"
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
            "Resend"
          )}
        </Button>
      </div>
    </form>
  );
}
