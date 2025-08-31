"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Instagram, Youtube, Twitter, Linkedin, MessageCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { SOCIAL_LINKS } from "@/constants/socialLinks";

interface DiscordOnboardingModalProps {
    isOpen: boolean;
    onClose: () => void;
    discordInviteUrl?: string;
}

export function DiscordOnboardingModal({ isOpen, onClose, discordInviteUrl }: DiscordOnboardingModalProps) {
    const inviteUrl: string = (discordInviteUrl || process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || SOCIAL_LINKS.discord || "#") as string;

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
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Stay connected with us
                    </DialogTitle>
                    <DialogDescription>
                        Join our Creator Community on Discord to get updates, support, and a $0.10 bonus credited to your withdrawable balance.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Link href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-2 rounded-md border hover:bg-accent/40 transition-colors">
                            <Instagram className="h-4 w-4" /> <span className="text-sm">Instagram</span>
                        </Link>
                        <Link href={SOCIAL_LINKS.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-2 rounded-md border hover:bg-accent/40 transition-colors">
                            <Youtube className="h-4 w-4" /> <span className="text-sm">YouTube</span>
                        </Link>
                        <Link href={SOCIAL_LINKS.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-2 rounded-md border hover:bg-accent/40 transition-colors">
                            <Twitter className="h-4 w-4" /> <span className="text-sm">Twitter</span>
                        </Link>
                        <Link href={SOCIAL_LINKS.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-2 rounded-md border hover:bg-accent/40 transition-colors">
                            <Linkedin className="h-4 w-4" /> <span className="text-sm">LinkedIn</span>
                        </Link>
                    </div>

                    <div className="p-5 rounded-lg border bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-md bg-white dark:bg-slate-800 border">
                                <MessageCircle className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm mb-2">
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


