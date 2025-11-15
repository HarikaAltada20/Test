"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailChangeFormProps {
  isDark: boolean;
  currentEmail: string;
  onEmailEntered: (email: string) => void;
  onCancel: () => void;
}

export function EmailChangeForm({
  isDark,
  currentEmail,
  onEmailEntered,
  onCancel,
}: EmailChangeFormProps) {
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentEmailOtp, setCurrentEmailOtp] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [isSendingNewEmailOtp, setIsSendingNewEmailOtp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<
    "password" | "otp"
  >("password");
  const [currentEmailOtpVerified, setCurrentEmailOtpVerified] = useState(false);
  const [tempEmailUsed, setTempEmailUsed] = useState<string | null>(null);
  const [hasOtpBeenSent, setHasOtpBeenSent] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  const handleSendCurrentEmailOtp = async () => {
    setEmailError(null);
    setIsSendingOtp(true);
    try {
      // Use updateUser to trigger the email_change template
      // This will send an OTP code using the "Email Change" template
      // We use a temporary email first, then immediately update back to current email
      // This triggers the email_change flow which uses the correct template
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const tempEmail = `temp-${timestamp}-${randomStr}@temp-verify.com`;

      console.log(
        "Initiating email change flow to trigger email_change template..."
      );

      // Store temp email for verification
      setTempEmailUsed(tempEmail);

      // First, update to a temporary email to initiate email_change flow
      const { error: tempError } = await supabase.auth.updateUser({
        email: tempEmail,
      });

      if (tempError) {
        console.error("Error updating to temp email:", tempError);
        setTempEmailUsed(null);
        throw new Error(
          tempError.message || "Failed to initiate email change flow"
        );
      }

      // Small delay to ensure the first update is processed
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Immediately update back to current email to trigger email_change OTP
      // This sends the OTP to the current email using the email_change template
      console.log("Reverting to current email to trigger OTP...");
      const { error: revertError } = await supabase.auth.updateUser({
        email: currentEmail,
      });

      if (revertError) {
        console.error("Error reverting to current email:", revertError);
        setTempEmailUsed(null);
        throw new Error(
          revertError.message || "Failed to send verification code"
        );
      }

      console.log("Email change OTP sent successfully to:", currentEmail);
      console.log("Temp email used:", tempEmail);

      setHasOtpBeenSent(true);

      toast({
        title: "Verification Code Sent",
        description: `A 6-digit verification code has been sent to ${currentEmail} using the email change template. Please check your inbox.`,
      });
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      setEmailError(error.message || "Failed to send verification code");
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.message ||
          "Failed to send verification code. Please try again.",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyCurrentEmailOtp = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    if (!currentEmailOtp || currentEmailOtp.length !== 6) {
      setEmailError("Please enter the 6-digit verification code");
      return;
    }

    setIsSubmitting(true);
    try {
      // Verify OTP using "email_change" type
      // The OTP was sent to currentEmail when we reverted from tempEmail
      // So we verify with currentEmail as the target email
      console.log("Verifying OTP for email change...");
      console.log("Current email:", currentEmail);
      console.log("OTP token:", currentEmailOtp);

      const { data: verifyData, error: verifyError } =
        await supabase.auth.verifyOtp({
          email: currentEmail, // The email that received the OTP
          token: currentEmailOtp,
          type: "email_change",
        });

      if (verifyError) {
        console.error("OTP verification error:", verifyError);
        // Try alternative: verify with temp email if it was used
        if (tempEmailUsed) {
          console.log("Trying verification with temp email...");
          const { data: altVerifyData, error: altVerifyError } =
            await supabase.auth.verifyOtp({
              email: tempEmailUsed,
              token: currentEmailOtp,
              type: "email_change",
            });

          if (altVerifyError) {
            console.error(
              "Alternative verification also failed:",
              altVerifyError
            );
            throw new Error(verifyError.message || "Invalid verification code");
          } else {
            // Alternative verification succeeded
            console.log("Alternative verification succeeded");
            // Update session if needed
            if (altVerifyData?.session) {
              await supabase.auth.setSession(altVerifyData.session);
              // Revert back to current email
              await supabase.auth.updateUser({ email: currentEmail });
            }
          }
        } else {
          throw new Error(verifyError.message || "Invalid verification code");
        }
      } else {
        // Standard verification succeeded
        console.log("OTP verification succeeded");

        // Handle session if returned
        if (verifyData?.session) {
          // Check if we need to update the session
          const currentSession = await supabase.auth.getSession();
          if (
            !currentSession.data.session ||
            verifyData.user?.email !== currentEmail
          ) {
            // Update session to ensure email is correct
            await supabase.auth.setSession(verifyData.session);
            // Ensure email is set to current email
            if (verifyData.user?.email !== currentEmail) {
              await supabase.auth.updateUser({ email: currentEmail });
            }
          }
        }
      }

      // Clear temp email after successful verification
      setTempEmailUsed(null);
      setCurrentEmailOtpVerified(true);
      setEmailError(null);
      toast({
        title: "Email Verified",
        description:
          "Your current email has been verified. You can now proceed to change your email.",
      });
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
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

  const handleResendCurrentEmailOtp = async () => {
    setEmailError(null);
    setIsResendingOtp(true);
    try {
      // Resend OTP using updateUser to trigger email_change template
      // Use the same approach as handleSendCurrentEmailOtp
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const tempEmail = `temp-${timestamp}-${randomStr}@temp-verify.com`;

      console.log("Resending email change OTP...");

      // Store temp email for verification
      setTempEmailUsed(tempEmail);

      const { error: tempError } = await supabase.auth.updateUser({
        email: tempEmail,
      });

      if (tempError) {
        console.error("Error updating to temp email:", tempError);
        setTempEmailUsed(null);
        throw new Error(
          tempError.message || "Failed to resend verification code"
        );
      }

      // Small delay to ensure the first update is processed
      await new Promise((resolve) => setTimeout(resolve, 200));

      const { error: revertError } = await supabase.auth.updateUser({
        email: currentEmail,
      });

      if (revertError) {
        console.error("Error reverting to current email:", revertError);
        setTempEmailUsed(null);
        throw new Error(
          revertError.message || "Failed to resend verification code"
        );
      }

      console.log("Email change OTP resent successfully to:", currentEmail);
      console.log("Temp email used:", tempEmail);

      toast({
        title: "Code Resent",
        description: `A new 6-digit verification code has been sent to ${currentEmail} using the email change template.`,
      });
    } catch (error: any) {
      console.error("Error resending OTP:", error);
      setEmailError(error.message || "Failed to resend code");
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to resend verification code.",
      });
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleSaveEmailWithOtp = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    if (!currentEmailOtpVerified) {
      setEmailError("Please verify your current email first");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setEmailError("Enter a valid email address");
      return;
    }

    if (newEmail.trim() === currentEmail) {
      setEmailError("New email must be different from current email");
      return;
    }

    if (newEmail.trim() !== confirmEmail.trim()) {
      setEmailError("Email addresses do not match");
      return;
    }

    setIsSendingNewEmailOtp(true);
    try {
      // Validate that new email is actually different from current email
      const trimmedNewEmail = newEmail.trim();
      if (trimmedNewEmail === currentEmail) {
        throw new Error("New email must be different from current email");
      }

      // Send OTP to the NEW email address (not the current one)
      // updateUser with a different email triggers email_change OTP flow
      // which sends OTP codes to the new email address
      console.log("Current email:", currentEmail);
      console.log("Sending OTP to NEW email:", trimmedNewEmail);
      const { error: otpError } = await supabase.auth.updateUser({
        email: trimmedNewEmail,
      });

      if (otpError) {
        console.error("Error sending OTP to new email:", otpError);
        throw new Error(otpError.message || "Failed to send verification code");
      }

      // OTP has been sent to the new email address
      // Note: If Supabase "Secure Email Change" is enabled, you might receive
      // OTPs to both emails, but use the code sent to the NEW email address
      console.log("OTP sent successfully to:", trimmedNewEmail);
      onEmailEntered(trimmedNewEmail);
      setEmailError(null);
      toast({
        title: "Verification Code Sent",
        description: `A 6-digit verification code has been sent to ${trimmedNewEmail}. Please check the inbox of your NEW email address (${trimmedNewEmail}), not your current email.`,
      });
    } catch (error: any) {
      console.error("Error in handleSaveEmailWithOtp:", error);
      setEmailError(error.message || "Failed to send verification code");
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.message ||
          "Failed to send verification code. Please try again.",
      });
    } finally {
      setIsSendingNewEmailOtp(false);
    }
  };

  const handleSaveEmail = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    if (!emailPassword) {
      setEmailError("Password is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setEmailError("Enter a valid email address");
      return;
    }

    if (newEmail.trim() === currentEmail) {
      setEmailError("New email must be different from current email");
      return;
    }

    if (newEmail.trim() !== confirmEmail.trim()) {
      setEmailError("Email addresses do not match");
      return;
    }

    setIsSendingNewEmailOtp(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: emailPassword,
      });

      if (signInError) {
        throw new Error("Incorrect password");
      }

      // Send OTP to the NEW email address (not the current one)
      const trimmedNewEmail = newEmail.trim();
      console.log("Current email:", currentEmail);
      console.log("Sending OTP to NEW email:", trimmedNewEmail);
      const { error: otpError } = await supabase.auth.updateUser({
        email: trimmedNewEmail,
      });

      if (otpError) {
        console.error("Error sending OTP to new email:", otpError);
        throw new Error(otpError.message || "Failed to send verification code");
      }

      console.log("OTP sent successfully to:", trimmedNewEmail);
      onEmailEntered(trimmedNewEmail);
      setEmailError(null);
      toast({
        title: "Verification Code Sent",
        description: `A 6-digit verification code has been sent to ${trimmedNewEmail}. Please check the inbox of your NEW email address (${trimmedNewEmail}), not your current email.`,
      });
    } catch (error: any) {
      setEmailError(error.message || "Failed to send verification code");
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.message ||
          "Failed to send verification code. Please try again.",
      });
    } finally {
      setIsSendingNewEmailOtp(false);
    }
  };

  return (
    <form
      onSubmit={
        verificationMethod === "password"
          ? handleSaveEmail
          : currentEmailOtpVerified
          ? handleSaveEmailWithOtp
          : handleVerifyCurrentEmailOtp
      }
      className="space-y-4"
    >
      {/* Verification Method Selection */}
      <div className="space-y-2">
        {/* <Label className={cn(isDark ? "text-white" : "text-gray-900")}>
          Verify Current Email
        </Label> */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <Label
            className={cn(
              "text-sm font-medium flex-shrink-0",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            {verificationMethod === "password"
              ? "Enter current password"
              : "Enter verification code"}
          </Label>
          <div className="flex justify-end">
            <div
              className={cn(
                "inline-flex items-center gap-0.5 sm:gap-1 rounded-lg sm:rounded-xl p-0.5 overflow-x-auto whitespace-nowrap shadow-inner flex-shrink-0",
                isDark
                  ? "border border-gray-600 bg-transparent"
                  : "border-2 border-gray-200 bg-white"
              )}
            >
              <Button
                type="button"
                size="sm"
                variant={
                  verificationMethod === "password" ? "default" : "ghost"
                }
                className={
                  verificationMethod === "password"
                    ? "shadow-lg hover:shadow-xl transition-all duration-300 font-bold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-xs sm:text-sm px-1.5 sm:px-3 py-1 flex-shrink-0"
                    : cn(
                        "transition-all duration-300 font-semibold text-xs sm:text-sm px-1.5 sm:px-3 py-1 sm:py-1 flex-shrink-0",
                        isDark
                          ? "text-gray-200 hover:text-violet-300 hover:bg-violet-900/20"
                          : "text-gray-600 hover:text-violet-600 hover:bg-violet-50/50"
                      )
                }
                onClick={() => setVerificationMethod("password")}
              >
                Password
              </Button>
              <Button
                type="button"
                size="sm"
                variant={verificationMethod === "otp" ? "default" : "ghost"}
                className={
                  verificationMethod === "otp"
                    ? "bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-purple-700/30 font-bold text-xs sm:text-sm px-1.5 sm:px-3 py-1 flex-shrink-0"
                    : cn(
                        "transition-all duration-300 font-semibold text-xs sm:text-sm px-1.5 sm:px-3 py-1 sm:py-1 flex-shrink-0",
                        isDark
                          ? "text-pink-300 hover:text-pink-200 hover:bg-pink-900/20"
                          : "text-pink-600 hover:text-pink-700 hover:bg-pink-50"
                      )
                }
                onClick={() => setVerificationMethod("otp")}
              >
                OTP
              </Button>
            </div>
          </div>
        </div>

        {/* Password Input */}
        {verificationMethod === "password" && (
          <div className="relative mt-2">
            <Input
              id="email-password"
              type={showEmailPassword ? "text" : "password"}
              autoComplete="current-password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="Enter current password"
              className={cn(
                "pr-10",
                isDark
                  ? "bg-[#06021d] border border-gray-600 text-white"
                  : "bg-white text-black"
              )}
              required
            />
            <button
              type="button"
              onClick={() => setShowEmailPassword(!showEmailPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showEmailPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        )}

        {/* OTP Input */}
        {verificationMethod === "otp" && (
          <div className="mt-2">
            {!currentEmailOtpVerified ? (
              <div className="space-y-2">
                <p
                  className={cn(
                    "text-xs mb-2",
                    isDark ? "text-gray-400" : "text-gray-600"
                  )}
                >
                  We'll send a code to: {currentEmail}
                </p>
                <div className="flex gap-2 w-full items-center">
                  <Input
                    id="current-email-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={currentEmailOtp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length <= 6) {
                        setCurrentEmailOtp(value);
                      }
                    }}
                    placeholder="000000"
                    className={cn(
                      "text-center text-xl tracking-widest flex-1",
                      isDark
                        ? "bg-[#06021d] border border-gray-600 text-white"
                        : "bg-white text-black"
                    )}
                    required
                  />
                  <Button
                    type="button"
                    onClick={handleSendCurrentEmailOtp}
                    disabled={isSendingOtp}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "whitespace-nowrap",
                      isDark
                        ? "bg-green-600 hover:bg-green-700 border-green-600 text-white"
                        : "bg-green-600 hover:bg-green-700 border-green-600 text-white"
                    )}
                  >
                    {isSendingOtp ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Sending...
                      </>
                    ) : hasOtpBeenSent ? (
                      "Resend"
                    ) : (
                      "OTP"
                    )}
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      !currentEmailOtp ||
                      currentEmailOtp.length !== 6
                    }
                    size="sm"
                    className={cn(
                      "text-xs sm:text-sm whitespace-nowrap",
                      isDark
                        ? "bg-[#7F39EC] hover:bg-[#6B2FC7] text-white"
                        : "bg-[#7F39EC] hover:bg-[#6B2FC7] text-white"
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </div>
                <p
                  className={cn(
                    "text-xs text-center mt-2",
                    isDark ? "text-gray-400" : "text-gray-500"
                  )}
                >
                  Enter the 6-digit code sent to {currentEmail}
                </p>
              </div>
            ) : (
              <div
                className={cn(
                  "rounded-lg p-2 border",
                  isDark
                    ? "bg-green-900/20 border-green-800"
                    : "bg-green-50 border-green-200"
                )}
              >
                <p
                  className={cn(
                    "text-xs",
                    isDark ? "text-green-300" : "text-green-700"
                  )}
                >
                  ✓ Current email verified
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Email Field */}
      <div className="space-y-2">
        <Label
          htmlFor="new-email"
          className={cn(isDark ? "text-white" : "text-gray-900")}
        >
          New Email
        </Label>
        <Input
          id="new-email"
          type="email"
          autoComplete="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="example@email.com"
          disabled={verificationMethod === "otp" && !currentEmailOtpVerified}
          className={cn(
            isDark
              ? "bg-[#06021d] border border-gray-600 text-white"
              : "bg-white text-black"
          )}
          required
        />
      </div>

      {/* Confirm Email Field */}
      <div className="space-y-2">
        <Label
          htmlFor="confirm-email"
          className={cn(isDark ? "text-white" : "text-gray-900")}
        >
          Confirm Email
        </Label>
        <Input
          id="confirm-email"
          type="email"
          autoComplete="email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          placeholder="example@email.com"
          disabled={verificationMethod === "otp" && !currentEmailOtpVerified}
          className={cn(
            isDark
              ? "bg-[#06021d] border border-gray-600 text-white"
              : "bg-white text-black"
          )}
          required
        />
      </div>

      {/* Error Message */}
      {emailError && <div className="text-sm text-red-500">{emailError}</div>}

      {/* Buttons */}
      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={
            isSendingOtp ||
            isResendingOtp ||
            isSendingNewEmailOtp ||
            isSubmitting
          }
          className={cn(
            isDark ? "border-gray-600 text-white hover:bg-[#2a0a5a]" : "text-black"
          )}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            isSendingNewEmailOtp ||
            isSubmitting ||
            (verificationMethod === "password" && !emailPassword) ||
            (verificationMethod === "otp" && !currentEmailOtpVerified)
          }
          className={cn(
            isDark
              ? "bg-[#7F39EC] hover:bg-[#6B2FC7] text-white"
              : "bg-[#7F39EC] hover:bg-[#6B2FC7] text-white"
          )}
        >
          {isSendingNewEmailOtp ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending Code...
            </>
          ) : (
            "Verify Email"
          )}
        </Button>
      </div>
    </form>
  );
}
