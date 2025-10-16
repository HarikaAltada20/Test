"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Instagram, Youtube, Twitter, Linkedin, MessageCircle, MessagesSquare } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { SOCIAL_LINKS } from "@/constants/socialLinks";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface DiscordOnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    discordInviteUrl?: string;
}

export function DiscordOnboardingModal({ isOpen, onClose, discordInviteUrl }: DiscordOnboardingModalProps) {
    const inviteUrl: string = (discordInviteUrl || process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || SOCIAL_LINKS.discord || "#") as string;
    const [mode, setMode] = useState<"light" | "dark">("light");

    // Read mode from data attribute
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setMode(currentMode);
        }
      }
    };

    checkMode();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

  const isDark = mode === "dark";
  
    const handleJoinDiscord = () => {
        if (inviteUrl && inviteUrl !== "#") {
            window.open(inviteUrl, "_blank", "noopener,noreferrer");
        }
        try {
            if (typeof window !== "undefined") {
                localStorage.setItem("discordOnboardingShown", "1");
            }
        } catch { }
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle
                     className={cn(
                        "flex items-center text-xl gap-2",
                        isDark ? "text-white" : "text-gray-900"
                      )}>
                        Stay connected with us
                    </DialogTitle>
                    <DialogDescription
                     className={cn(
                        "text-sm text-muted-foreground",
                        isDark ? "text-gray-300" : "text-gray-700"
                      )}>
                        Join our Creator Community on Discord to get updates, support, and a $0.10 bonus credited to your withdrawable balance.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Link href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" 
                        className={cn(
                            "flex items-center justify-center gap-2 py-2 rounded-md border transition-colors",
                            isDark ? "text-white border border-gray-600" : "text-[#4A00BE] border-[#4A00BE] hover:bg-[#4A00BE] hover:text-white"
                          )}>
                            <Instagram className="h-4 w-4" /> <span className="text-md">Instagram</span>
                        </Link>
                        <Link href={SOCIAL_LINKS.youtube} target="_blank" rel="noopener noreferrer"   
                         className={cn(
                            "flex items-center justify-center gap-2 py-2 rounded-md border transition-colors",
                            isDark ? "text-white border border-gray-600" : "text-[#4A00BE] border-[#4A00BE] hover:bg-[#4A00BE] hover:text-white"
                          )}>
                            <Youtube className="h-4 w-4" /> <span className="text-md">YouTube</span>
                        </Link>
                        <Link href={SOCIAL_LINKS.twitter} target="_blank" rel="noopener noreferrer" 
                        className={cn(
                            "flex items-center justify-center gap-2 py-2 rounded-md border transition-colors",
                            isDark ? "text-white border border-gray-600" : "text-[#4A00BE] border-[#4A00BE] hover:bg-[#4A00BE] hover:text-white"
                          )}>
                            <Twitter className="h-4 w-4" /> <span className="text-md">Twitter</span>
                        </Link>
                        <Link href={SOCIAL_LINKS.linkedin} target="_blank" rel="noopener noreferrer" 
                        className={cn(
                            "flex items-center justify-center gap-2 py-2 rounded-md border transition-colors",
                            isDark ? "text-white border border-gray-600" : "text-[#4A00BE] border-[#4A00BE] hover:bg-[#4A00BE] hover:text-white"
                          )}>
                            <Linkedin className="h-4 w-4" /> <span className="text-md">LinkedIn</span>
                        </Link>
                    </div>

                    <div className={cn(
                        "p-5 rounded-lg border transition-colors",
                        isDark ? "bg-[#D9C0FF26] border-[#7F39EC] dark:to-purple-900/20" : "bg-[#D9C0FF26] border-[#7F39EC] dark:to-purple-900/20"
                      )}>
                        <div className="flex items-start gap-4">
                            <div>
                                <MessagesSquare className="h-5 w-5 text-[#7F39EC]" />
                            </div>
                            <div className="flex-1">
                                <p className={cn(
                                    "text-sm mb-2",
                                    isDark ? "text-gray-300" : "text-gray-700"
                                  )}>
                                    <span className="font-semibold">Join our Discord</span> and grab your $0.10 bonus code right from the welcome channel. It will be added to your withdrawable balance after redeeming.
                                </p>
                                <Button className="w-full" onClick={handleJoinDiscord}>
                                    <ExternalLink className="h-4 w-4 mr-2" /> Join Discord
                                </Button>
                                <p className="text-xs text-muted-foreground mt-3">
                                    Copy the code and redeem it in Dashboard → Earnings → Redeem a Code to credit $0.10 to your withdrawable balance.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}


