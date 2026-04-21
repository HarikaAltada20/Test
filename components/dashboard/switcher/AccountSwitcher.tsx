"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  Plus, 
  Loader2, 
  Check, 
  ChevronDown, 
  RefreshCw,
  AlertCircle,
  Pencil,
  Eye,
  EyeOff
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
  isDark,
  userType
}: { 
  currentUserId: string;
  currentUsername: string;
  isDark: boolean;
  userType: string;
}) {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    
    // Check if user is allowed to switch accounts
    if (userType !== "creator") {
      toast({ 
        title: "Access Denied", 
        description: "Only creator accounts can switch between accounts", 
        variant: "destructive" 
      });
      return;
    }
    
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
    
    // Check if user is allowed to add accounts
    if (userType !== "creator") {
      toast({ 
        title: "Access Denied", 
        description: "Only creator accounts can add linked accounts", 
        variant: "destructive" 
      });
      return;
    }
    
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
      {/* Quick Action - Account Switcher */}
      <button
        onClick={() => {
          if (userType === "creator") {
            setIsSwitchModalOpen(true);
          } else {
            toast({ 
              title: "Access Denied", 
              description: "Only creator accounts can switch between accounts", 
              variant: "destructive" 
            });
          }
        }}
        className={cn(
          "flex justify-between items-center border rounded-lg px-4 py-3 w-full transition-all group",
          userType === "creator"
            ? (isDark 
              ? "border-[#7F39EC] bg-[#D9C0FF26] hover:bg-[#D9C0FF40]" 
              : "border-[#7F39EC] bg-[#D9C0FF26] hover:bg-[#D9C0FF40]")
            : (isDark 
              ? "border-slate-700 bg-slate-800/50 cursor-not-allowed opacity-60" 
              : "border-slate-300 bg-slate-100 cursor-not-allowed opacity-60")
        )}
      >
        <div className="flex items-center">
          <div
            className={cn(
              "flex rounded-full p-3 items-center mr-2.5",
              userType === "creator"
                ? (isDark
                  ? "bg-[#FFFFFF42] text-white"
                  : "bg-[#D8C3FF] text-purple-600")
                : (isDark
                  ? "bg-slate-700 text-slate-400"
                  : "bg-slate-300 text-slate-500")
            )}
          >
            <Users className="h-5 w-5" />
          </div>
          <div className="flex-1 text-left">
            <div
              className={cn(
                "font-medium text-md",
                userType === "creator"
                  ? (isDark ? "text-white" : "text-black")
                  : (isDark ? "text-slate-400" : "text-slate-600")
              )}
            >
              Switch Account
              {userType !== "creator" && (
                <span className="block text-xs font-normal mt-1">
                  Creator only feature
                </span>
              )}
            </div>
          </div>
        </div>
        <div
          className={cn(
            "h-3 w-3 transition-all",
            userType === "creator" 
              ? "group-hover:translate-x-0.5"
              : "",
            userType === "creator"
              ? (isDark ? "text-white" : "text-purple-600")
              : (isDark ? "text-slate-500" : "text-slate-400")
          )}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </button>

      {/* Account Switch Modal */}
      <Dialog open={isSwitchModalOpen} onOpenChange={setIsSwitchModalOpen} isdark={isDark}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[600px] rounded-3xl p-6 overflow-y-auto" >
          <DialogHeader>
            <div className="mx-auto bg-violet-500/10 p-4 rounded-full w-fit mb-2">
              <Users className="h-8 w-8 text-violet-500" />
            </div>
            <DialogTitle className="text-2xl text-center font-bold">Account Switcher</DialogTitle>
            <DialogDescription className="text-center">
              Switch between your linked accounts instantly.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 pt-4">
            {/* Current Account (Read only in list) */}
            <div 
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-xl border",
                isDark 
                  ? "bg-violet-500/10 border-violet-500/30" 
                  : "bg-violet-50 border-violet-200"
              )}
            >
              <div className="flex items-center gap-3">
                 <div className="relative">
                    <Avatar className="h-10 w-10 border-2 border-violet-500">
                      <AvatarFallback className="bg-violet-600 text-[10px] text-white font-bold">
                        {currentUsername.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full h-3.5 w-3.5 border-2 border-white dark:border-[#07031E] flex items-center justify-center">
                       <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    </div>
                 </div>
                 <div className="text-left">
                    <p className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                       @{currentUsername}
                    </p>
                    <p className="text-xs text-violet-500 font-medium tracking-tight">Active Now</p>
                 </div>
              </div>
              <Check className="h-5 w-5 text-violet-500" />
            </div>

            {/* Saved Accounts */}
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => handleSwitch(acc.id)}
                disabled={!!isSwitching}
                className={cn(
                   "w-full flex items-center justify-between p-3 rounded-xl border transition-all group",
                   isDark 
                     ? "bg-slate-900/40 border-slate-800 hover:border-violet-500/40 hover:bg-violet-500/5" 
                     : "bg-white border-slate-200 hover:border-violet-300 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 grayscale-[0.5] group-hover:grayscale-0 transition-all border border-slate-200 dark:border-slate-800">
                    <AvatarImage src={acc.avatar_url} />
                    <AvatarFallback className="bg-slate-500 text-[10px] text-white">
                      {acc.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                     <p className={cn("text-sm font-semibold", isDark ? "text-slate-300 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900")}>
                        @{acc.username}
                     </p>
                     <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">{acc.user_type}</p>
                  </div>
                </div>
                {isSwitching === acc.id ? (
                  <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                ) : (
                  <RefreshCw className="h-4 w-4 text-slate-400 group-hover:text-violet-500 transition-colors opacity-0 group-hover:opacity-100" />
                )}
              </button>
            ))}

            {accounts.length === 0 && !isLoading && (
              <div className={cn(
                "flex flex-col items-center justify-center py-8 px-4 rounded-xl border border-dashed",
                 isDark ? "border-slate-800" : "border-slate-200"
              )}>
                 <Users className="h-8 w-8 text-slate-500 mb-3 opacity-50" />
                 <p className="text-sm text-slate-500 text-center italic">
                    No linked accounts yet. Add your first account below.
                 </p>
              </div>
            )}

            {accounts.length >= 5 && (
              <div className={cn(
                "flex flex-col items-center justify-center py-6 px-4 rounded-xl border",
                 isDark ? "bg-red-950/20 border-red-800/30" : "bg-red-50 border-red-200"
              )}>
                 <AlertCircle className="h-6 w-6 text-red-500 mb-2" />
                 <p className="text-sm text-red-600 text-center font-medium">
                    Maximum account limit reached (5/5)
                 </p>
                 {/* <p className="text-xs text-red-500 text-center mt-1">
                    Remove an existing account to add a new one.
                 </p> */}
              </div>
            )}
            
            {isLoading && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              </div>
            )}
          </div>

          {/* Add Account Button - Only show if under limit */}
          {accounts.length < 5 && (
            <div className="pt-4">
              <Button 
                onClick={() => {
                  setIsSwitchModalOpen(false);
                  setIsAddModalOpen(true);
                }}
                variant="outline" 
                className={cn(
                  "w-full h-11 rounded-xl font-semibold transition-all",
                  isDark 
                    ? "border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300" 
                    : "border-violet-200 text-violet-600 hover:bg-violet-50 hover:text-violet-700"
                )}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Account
              </Button>
            </div>
          )}
          
          {/* Account counter - Always show */}
          {/* <div className="pt-2">
            <p className={cn(
              "text-xs text-center",
              isDark ? "text-slate-400" : "text-slate-500"
            )}>
              {accounts.length}/5 accounts linked
            </p>
          </div> */}

        </DialogContent>
      </Dialog>

      {/* Add Account Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen} isdark={isDark}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px] max-h-[600px] rounded-3xl p-6 overflow-y-auto">
          <DialogHeader>
            <div className="mx-auto bg-violet-500/10 p-4 rounded-full w-fit mb-2">
              <Users className="h-8 w-8 text-violet-500" />
            </div>
            <DialogTitle className="text-2xl text-center font-bold">Link New Account</DialogTitle>
            <DialogDescription className="text-center">
              Switching accounts becomes instant once linked. Enter credentials for the other account.
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
               <div className="relative">
                 <Input 
                   id="s-password" 
                   type={showPassword ? "text" : "password"} 
                   value={password} 
                   onChange={e => setPassword(e.target.value)}
                   placeholder="••••••••"
                   className={cn(
                     "h-11 rounded-xl px-4 pr-12",
                     isDark 
                       ? "bg-white/[0.03] border-white/10 focus:ring-violet-500" 
                       : "bg-slate-50 border-slate-200 focus:ring-violet-400"
                   )}
                   required 
                 />
                 <button
                   type="button"
                   onClick={() => setShowPassword(!showPassword)}
                   className={cn(
                     "absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-md transition-colors",
                     isDark 
                       ? "hover:bg-white/10 text-slate-400 hover:text-slate-300" 
                       : "hover:bg-slate-100 text-slate-500 hover:text-slate-600"
                   )}
                 >
                   {showPassword ? (
                     <EyeOff className="h-4 w-4" />
                   ) : (
                     <Eye className="h-4 w-4" />
                   )}
                 </button>
               </div>
             </div>

             {/* <div className={cn(
               "flex items-start gap-3 p-3 rounded-xl",
               isDark ? "bg-amber-950/20 text-amber-200/80" : "bg-amber-50 text-amber-700"
             )}>
               <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
               <p className="text-[11px] leading-tight">
                 For security, you may be asked to re-authenticate periodically if a session group is inactive.
               </p>
             </div> */}

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
