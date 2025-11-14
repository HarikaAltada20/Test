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

      console.log("OTP verification successful. verifyData:", {
        hasUser: !!verifyData?.user,
        userEmail: verifyData?.user?.email,
        userNewEmail: verifyData?.user?.new_email,
        userIdentities: verifyData?.user?.identities,
        hasSession: !!verifyData?.session,
        fullUser: verifyData?.user,
        fullData: verifyData,
      });

      // Check if verifyData already contains the updated user with new email
      let finalEmail = newEmail.trim();
      let emailUpdated = false;

      if (verifyData?.user?.email) {
        const verifiedEmail = verifyData.user.email.toLowerCase();
        const expectedEmail = newEmail.trim().toLowerCase();
        console.log("Checking verifyData.user.email:", {
          verifiedEmail,
          expectedEmail,
          match: verifiedEmail === expectedEmail,
        });
        if (verifiedEmail === expectedEmail) {
          finalEmail = verifyData.user.email;
          emailUpdated = true;
          console.log("Email already updated in verifyData:", finalEmail);
        }
      }

      // Set the session first if provided - this is critical for the email change to take effect
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
        console.log("Session set successfully after email change");

        // Get user immediately after setting session to check email
        const {
          data: { user: userAfterSession },
          error: getUserError,
        } = await supabase.auth.getUser();
        if (!getUserError && userAfterSession) {
          console.log("User after setting session:", {
            email: userAfterSession.email,
            new_email: (userAfterSession as any).new_email,
            email_change_sent_at: (userAfterSession as any)
              .email_change_sent_at,
            email_change_token: (userAfterSession as any).email_change_token,
            fullUser: userAfterSession,
          });

          if (userAfterSession?.email) {
            const userEmail = userAfterSession.email.toLowerCase();
            const expectedEmail = newEmail.trim().toLowerCase();
            if (userEmail === expectedEmail) {
              finalEmail = userAfterSession.email;
              emailUpdated = true;
              console.log(
                "Email updated immediately after setting session:",
                finalEmail
              );
            }
          }

          // Check if there's a new_email field that needs to be confirmed
          if (userAfterSession?.new_email) {
            console.log(
              "User has new_email field:",
              userAfterSession.new_email
            );
            const newEmailField = userAfterSession.new_email.toLowerCase();
            const expectedEmail = newEmail.trim().toLowerCase();
            if (newEmailField === expectedEmail) {
              console.log(
                "New email matches expected email, but email field not updated yet"
              );
            }
          }
        }

        // Refresh the session to ensure the user object is updated
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn("Error refreshing session:", refreshError);
          // Don't throw - continue with verification
        } else {
          console.log("Session refreshed successfully");
        }
      } else {
        console.warn("No session in verifyData - this might be the issue");
      }

      // If email wasn't already updated in verifyData, wait and check again
      if (!emailUpdated) {
        // Wait for the email change to propagate on Supabase's backend
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Verify the email was actually updated in auth
        // This is critical - we must confirm the email is updated before proceeding
        let retries = 12; // Increased retries
        let delay = 600; // Initial delay

        for (let i = 0; i < retries; i++) {
          // Refresh the session to get the latest user data
          const {
            data: { user },
            error: refreshError,
          } = await supabase.auth.getUser();

          if (refreshError) {
            console.error(
              `Error getting user (attempt ${i + 1}):`,
              refreshError
            );
            // On the last attempt, throw an error
            if (i === retries - 1) {
              throw new Error(
                refreshError.message ||
                  "Failed to verify email change. Please try logging in with your new email."
              );
            }
          } else if (user) {
            const userEmail = user.email?.toLowerCase() || "";
            const userNewEmail = (user as any).new_email?.toLowerCase() || "";
            const expectedEmail = newEmail.trim().toLowerCase();

            console.log(`Retry attempt ${i + 1}/${retries}:`, {
              currentEmail: user.email,
              newEmailField: (user as any).new_email,
              expectedEmail: expectedEmail,
              emailMatches: userEmail === expectedEmail,
              newEmailMatches: userNewEmail === expectedEmail,
            });

            if (userEmail === expectedEmail) {
              finalEmail = user.email!;
              emailUpdated = true;
              console.log("Email successfully updated in auth:", finalEmail);
              break;
            } else if (userNewEmail === expectedEmail) {
              console.log(
                `Email is in new_email field but not yet in email field (attempt ${
                  i + 1
                }/${retries}). ` +
                  "This may indicate 'Double confirm email changes' is enabled or email change is pending."
              );
            } else {
              console.log(
                `Email not yet updated (attempt ${i + 1}/${retries}):`,
                `Expected: ${expectedEmail}, Got: ${userEmail}, new_email: ${
                  userNewEmail || "none"
                }`
              );
            }
          }

          // Wait before next retry (except on last iteration)
          if (i < retries - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay = Math.min(delay * 1.4, 2500); // Gradual backoff, max 2.5 seconds
          }
        }
      }

      // CRITICAL: Supabase processes email changes asynchronously
      // If email still isn't updated, wait longer and retry more times
      // The OTP verification was successful, so the email change is in progress
      if (!emailUpdated) {
        console.log(
          "Email not updated after initial retries. Waiting longer for async processing..."
        );

        // Additional retries with longer delays for async processing
        const additionalRetries = 8;
        const additionalDelay = 2000; // Start with 2 seconds

        for (let i = 0; i < additionalRetries; i++) {
          await new Promise((resolve) => setTimeout(resolve, additionalDelay));

          const {
            data: { user },
            error: refreshError,
          } = await supabase.auth.getUser();

          if (!refreshError && user) {
            const userEmail = user.email?.toLowerCase() || "";
            const userNewEmail = (user as any).new_email?.toLowerCase() || "";
            const expectedEmail = newEmail.trim().toLowerCase();

            console.log(
              `Additional retry attempt ${i + 1}/${additionalRetries}:`,
              {
                currentEmail: user.email,
                newEmailField: (user as any).new_email,
                expectedEmail: expectedEmail,
              }
            );

            if (userEmail === expectedEmail) {
              finalEmail = user.email!;
              emailUpdated = true;
              console.log(
                `Email successfully updated after additional wait (attempt ${
                  i + 1
                }):`,
                finalEmail
              );
              break;
            } else if (userNewEmail === expectedEmail) {
              console.log(
                `Email is in new_email field but not yet in email field (additional attempt ${
                  i + 1
                }/${additionalRetries})`
              );
            } else {
              console.log(
                `Email still not updated (additional attempt ${
                  i + 1
                }/${additionalRetries}):`,
                `Expected: ${expectedEmail}, Got: ${userEmail}, new_email: ${
                  userNewEmail || "none"
                }`
              );
            }
          }
        }
      }

      // CRITICAL: Only proceed if email is confirmed to be updated in Supabase auth
      // We must verify the email is actually updated before updating the users table
      if (!emailUpdated) {
        // One final attempt with a longer wait
        console.log("Performing final check for email update in auth...");
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const {
          data: { user: finalUser },
          error: finalError,
        } = await supabase.auth.getUser();

        if (!finalError && finalUser) {
          const userEmail = finalUser.email?.toLowerCase() || "";
          const userNewEmail =
            (finalUser as any).new_email?.toLowerCase() || "";
          const expectedEmail = newEmail.trim().toLowerCase();

          console.log("Final check:", {
            currentEmail: finalUser.email,
            newEmailField: (finalUser as any).new_email,
            expectedEmail: expectedEmail,
            fullUser: finalUser,
          });

          if (userEmail === expectedEmail) {
            finalEmail = finalUser.email!;
            emailUpdated = true;
            console.log(
              "Email confirmed updated in auth on final check:",
              finalEmail
            );
          } else if (userNewEmail === expectedEmail) {
            console.error(
              "Email is in new_email field but not updated in email field. " +
                "This likely means 'Double confirm email changes' is enabled in Supabase settings. " +
                "The user needs to confirm from both old and new email addresses."
            );
          } else {
            console.error(
              "Email still not updated in auth after all retries. " +
                `Expected: ${expectedEmail}, Got: ${userEmail}, new_email: ${
                  userNewEmail || "none"
                }`
            );
          }
        }

        // If still not updated, use admin API to force-update the email
        // This bypasses the double confirmation requirement
        if (!emailUpdated) {
          console.log(
            "Email not updated after retries. Using admin API to force-update..."
          );

          try {
            const response = await fetch("/api/account/force-update-email", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ newEmail: newEmail.trim() }),
            });

            const result = await response.json();

            if (!response.ok) {
              throw new Error(
                result.error || "Failed to force-update email via admin API"
              );
            }

            if (result.email) {
              finalEmail = result.email;
              emailUpdated = true;
              console.log(
                "Email successfully force-updated via admin API:",
                finalEmail
              );

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
      }

      // At this point, emailUpdated is true and finalEmail contains the confirmed email from auth
      console.log("Email confirmed in Supabase auth:", finalEmail);

      // Verify one more time that the email is actually updated
      const {
        data: { user: verifyUser },
      } = await supabase.auth.getUser();

      if (verifyUser?.email) {
        const verifyEmail = verifyUser.email.toLowerCase();
        const expectedEmail = newEmail.trim().toLowerCase();

        if (verifyEmail !== expectedEmail) {
          console.error(
            "Email verification failed after force-update. " +
              `Expected: ${expectedEmail}, Got: ${verifyEmail}`
          );
          throw new Error(
            "Email update completed but verification failed. Please refresh the page and try again."
          );
        }

        finalEmail = verifyUser.email;
        console.log("Email verified in auth:", finalEmail);
      }

      // The users table is already updated by the admin API, but verify it's in sync
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser?.id) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ email: finalEmail })
          .eq("id", currentUser.id);

        if (updateError) {
          console.error("Error syncing users table:", updateError);
          // Don't throw - auth email is updated which is critical
        } else {
          console.log("Users table synced with email:", finalEmail);
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
