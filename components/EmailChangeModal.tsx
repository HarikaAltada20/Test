"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EmailChangeForm } from "./EmailChangeForm";
import { EmailOtpVerificationForm } from "./EmailOtpVerificationForm";

interface EmailChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  currentEmail: string;
  onEmailUpdated: () => void;
}

const STORAGE_KEY = "emailChangeModalState";

export function EmailChangeModal({
  isOpen,
  onClose,
  isDark,
  currentEmail,
  onEmailUpdated,
}: EmailChangeModalProps) {
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  // Restore state from localStorage when modal opens
  useEffect(() => {
    if (isOpen) {
      const storedState = localStorage.getItem(STORAGE_KEY);
      if (storedState) {
        try {
          const parsed = JSON.parse(storedState);
          // Only restore if the current email matches (to prevent stale state)
          if (
            parsed.currentEmail === currentEmail &&
            parsed.newEmail &&
            parsed.showOtpStep
          ) {
            setNewEmail(parsed.newEmail);
            setShowOtpStep(true);
          } else {
            // Clear stale state
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch (e) {
          // Invalid stored state, clear it
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  }, [isOpen, currentEmail]);

  // Save state to localStorage when moving to step 2
  const handleEmailEntered = (email: string) => {
    setNewEmail(email);
    setShowOtpStep(true);
    // Persist state to localStorage
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currentEmail,
        newEmail: email,
        showOtpStep: true,
      })
    );
  };

  const handleClose = () => {
    // Don't clear state on close - keep it for next time
    onClose();
  };

  const handleVerified = () => {
    // Clear stored state on successful verification
    localStorage.removeItem(STORAGE_KEY);
    setShowOtpStep(false);
    setNewEmail("");
    onClose();
    onEmailUpdated();
  };

  const handleBack = () => {
    // Clear stored state when going back to step 1
    localStorage.removeItem(STORAGE_KEY);
    setShowOtpStep(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose} isdark={isDark}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className={cn(isDark ? "text-white" : "text-gray-900")}>
            {showOtpStep ? "Verify Email" : "Change Email"}
          </DialogTitle>
          <DialogDescription
            className={cn(isDark ? "text-gray-300" : "text-gray-600")}
          >
            {showOtpStep
              ? `Enter the 6-digit verification code sent to ${newEmail.trim()}`
              : "Choose a verification method to update your email"}
          </DialogDescription>
        </DialogHeader>

        {!showOtpStep ? (
          <EmailChangeForm
            isDark={isDark}
            currentEmail={currentEmail}
            onEmailEntered={handleEmailEntered}
            onCancel={handleClose}
          />
        ) : (
          <EmailOtpVerificationForm
            isDark={isDark}
            newEmail={newEmail}
            onVerified={handleVerified}
            onBack={handleBack}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
