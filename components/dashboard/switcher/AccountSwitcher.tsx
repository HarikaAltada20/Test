"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  Plus, 
  Loader2, 
  Check, 
  ChevronDown, 
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LinkedAccount {
  id: string;
  username: string;
  avatar_url?: string;
  user_type?: string;
}

export function AccountSwitcher({ 
  currentUserId, 
  currentUsername,
  isDark 
}: { 
  currentUserId: string;
  currentUsername: string;
  isDark: boolean;
}) {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/account-switch/list");
      const data = await res.json();
      if (data.accounts) {
        setAccounts(data.accounts);
      }
    } catch (err) {
      console.error("[AccountSwitcher] Fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSwitch = async (targetUserId: string) => {
    if (isSwitching) return;
    setIsSwitching(targetUserId);
    
    try {
      const res = await fetch("/api/account-switch/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({ 
          title: "Account Switched", 
          description: "Refreshing session data...",
        });
        // Force a full page reload to reset all client-side state/middleware
        window.location.href = "/dashboard";
      } else {
        throw new Error(data.error || "Failed to switch accounts");
      }
    } catch (err: any) {
      toast({ 
        title: "Switch Failed", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSwitching(null);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const res = await fetch("/api/account-switch/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({ 
          title: "Account Linked Successfully", 
          description: `You can now switch between these accounts.`,
        });
        setIsAddModalOpen(false);
        setEmail("");
        setPassword("");
        
        // Refresh to establish the new bi-directional link and session
        window.location.href = "/dashboard";
      } else {
        throw new Error(data.error || "Authentication failed");
      }
    } catch (err: any) {
      toast({ 
        title: "Connection Error", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-2 px-1">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
           <RefreshCw className={cn("h-4 w-4", isDark ? "text-violet-400" : "text-violet-600")} />
           <h3
             className={cn(
               "text-[11px] font-bold uppercase tracking-wider",
               isDark ? "text-slate-400" : "text-slate-500"
             )}
           >
             GoViral Account Switcher
           </h3>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2 text-violet-500 hover:text-violet-600 font-bold text-[10px]"
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Account
        </Button>
      </div>

      <div className="space-y-2">
        {/* Current Account (Read only in list) */}
        <div 
          className={cn(
            "w-full flex items-center justify-between p-2.5 rounded-xl border",
            isDark 
              ? "bg-violet-500/10 border-violet-500/30" 
              : "bg-violet-50 border-violet-200"
          )}
        >
          <div className="flex items-center gap-3">
             <div className="relative">
                <Avatar className="h-9 w-9 border-2 border-violet-500">
                  <AvatarFallback className="bg-violet-600 text-[10px] text-white font-bold">
                    {currentUsername.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full h-3.5 w-3.5 border-2 border-white dark:border-[#07031E] flex items-center justify-center">
                   <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                </div>
             </div>
             <div className="text-left">
                <p className={cn("text-xs font-bold", isDark ? "text-white" : "text-slate-900")}>
                   @{currentUsername}
                </p>
                <p className="text-[10px] text-violet-500 font-medium tracking-tight">Active Now</p>
             </div>
          </div>
          <Check className="h-4 w-4 text-violet-500" />
        </div>

        {/* Saved Accounts */}
        {accounts.map(acc => (
          <button
            key={acc.id}
            onClick={() => handleSwitch(acc.id)}
            disabled={!!isSwitching}
            className={cn(
               "w-full flex items-center justify-between p-2.5 rounded-xl border transition-all group",
               isDark 
                 ? "bg-slate-900/40 border-slate-800 hover:border-violet-500/40 hover:bg-violet-500/5" 
                 : "bg-white border-slate-200 hover:border-violet-300 hover:bg-slate-50"
            )}
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 grayscale-[0.5] group-hover:grayscale-0 transition-all border border-slate-200 dark:border-slate-800">
                <AvatarImage src={acc.avatar_url} />
                <AvatarFallback className="bg-slate-500 text-[10px] text-white">
                  {acc.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                 <p className={cn("text-xs font-semibold", isDark ? "text-slate-300 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900")}>
                    @{acc.username}
                 </p>
                 <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{acc.user_type}</p>
              </div>
            </div>
            {isSwitching === acc.id ? (
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            ) : (
              <RefreshCw className="h-3 w-3 text-slate-400 group-hover:text-violet-500 transition-colors opacity-0 group-hover:opacity-100" />
            )}
          </button>
        ))}

        {accounts.length === 0 && !isLoading && (
          <div className={cn(
            "flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-dashed",
             isDark ? "border-slate-800" : "border-slate-200"
          )}>
             <Users className="h-6 w-6 text-slate-500 mb-2 opacity-50" />
             <p className="text-[11px] text-slate-500 text-center italic">
                Link another GoViral account for easy switching.
             </p>
          </div>
        )}
        
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          </div>
        )}
      </div>

      <p className={cn(
        "mt-4 text-[10px] leading-relaxed",
        isDark ? "text-slate-500" : "text-slate-400"
      )}>
        Security Note: Saved sessions are encrypted and managed on GoViral's secure vault server.
      </p>

      {/* Add Account Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className={cn(
          "sm:max-w-[400px] rounded-3xl p-6", 
          isDark 
            ? "bg-[#07031E] border-slate-800 text-white shadow-2xl" 
            : "bg-white shadow-xl shadow-slate-200"
        )}>
          <DialogHeader>
            <div className="mx-auto bg-violet-500/10 p-4 rounded-full w-fit mb-2">
              <Users className="h-8 w-8 text-violet-500" />
            </div>
            <DialogTitle className="text-2xl text-center font-bold">Link New Account</DialogTitle>
            <DialogDescription className="text-center">
              Switching accounts becomes instant once linked. Enter credentials for the other GoViral account.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddAccount} className="space-y-4 pt-4">
             <div className="space-y-2">
               <Label htmlFor="s-email" className="text-sm font-semibold ml-1">Account Email</Label>
               <Input 
                 id="s-email" 
                 type="email" 
                 value={email} 
                 onChange={e => setEmail(e.target.value)} 
                 placeholder="your@email.com"
                 className={cn(
                   "h-11 rounded-xl px-4",
                   isDark 
                     ? "bg-white/[0.03] border-white/10 focus:ring-violet-500" 
                     : "bg-slate-50 border-slate-200 focus:ring-violet-400"
                 )}
                 required 
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="s-password" className="text-sm font-semibold ml-1">Password</Label>
               <Input 
                 id="s-password" 
                 type="password" 
                 value={password} 
                 onChange={e => setPassword(e.target.value)}
                 placeholder="••••••••"
                 className={cn(
                   "h-11 rounded-xl px-4",
                   isDark 
                     ? "bg-white/[0.03] border-white/10 focus:ring-violet-500" 
                     : "bg-slate-50 border-slate-200 focus:ring-violet-400"
                 )}
                 required 
               />
             </div>

             <div className={cn(
               "flex items-start gap-3 p-3 rounded-xl",
               isDark ? "bg-amber-950/20 text-amber-200/80" : "bg-amber-50 text-amber-700"
             )}>
               <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
               <p className="text-[11px] leading-tight">
                 For security, you may be asked to re-authenticate periodically if a session group is inactive.
               </p>
             </div>

             <DialogFooter className="pt-4 flex sm:justify-center gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading} 
                  className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-8 h-11 font-bold shadow-lg shadow-violet-500/20 active:scale-95 transition-all"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link and Switch"}
                </Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
