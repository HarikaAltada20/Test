"use client";

import { useState } from "react";
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

export function EmailChangeModal({
  isOpen,
  onClose,
  isDark,
  currentEmail,
  onEmailUpdated,
}: EmailChangeModalProps) {
  const [showOtpStep, setShowOtpStep] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const handleClose = () => {
    setShowOtpStep(false);
    setNewEmail("");
    onClose();
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
            onEmailEntered={(email) => {
              setNewEmail(email);
              setShowOtpStep(true);
            }}
            onCancel={handleClose}
          />
        ) : (
          <EmailOtpVerificationForm
            isDark={isDark}
            newEmail={newEmail}
            onVerified={() => {
              handleClose();
              onEmailUpdated();
            }}
            onBack={() => setShowOtpStep(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
