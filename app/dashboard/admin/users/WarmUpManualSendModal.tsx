"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail,
  Users,
  FileText,
  Clock,
  Send,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  UserCheck,
  ExternalLink,
} from "lucide-react";
import { EmailModalSkeleton } from "./EmailSkeletons";
import { useToast } from "@/hooks/use-toast";
import type { WarmUpAccountListItem } from "@/lib/admin-email/warm-up";
import type {
  WarmUpRecipientRow,
  WarmUpTemplateRow,
} from "@/lib/admin-email/warm-up-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SenderRow = {
  id: string;
  email: string;
  display_name: string | null;
  ses_verified: boolean;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  user_type: string | null;
};

// ---------------------------------------------------------------------------
// User Picker Dialog (inner)
// ---------------------------------------------------------------------------

function UserPickerDialog({
  open,
  onClose,
  onConfirm,
  alreadySelected,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (emails: string[]) => void;
  alreadySelected: string[];
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set(alreadySelected));
  const [typeFilter, setTypeFilter] = useState<
    "all" | "creator" | "advertiser"
  >("all");

  useEffect(() => {
    if (!open) return;
    setPicked(new Set(alreadySelected));
    setSearch("");
    setTypeFilter("all");
  }, [open, alreadySelected]);

  useEffect(() => {
    if (!open || users.length > 0) return;
    setLoading(true);
    fetch("/api/admin/users?all=1")
      .then((r) => r.json())
      .then((d) => setUsers((d.items ?? []) as UserRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, users.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (typeFilter !== "all" && u.user_type !== typeFilter) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, search, typeFilter]);

  const toggleAll = () => {
    if (filtered.every((u) => picked.has(u.email))) {
      const next = new Set(picked);
      filtered.forEach((u) => next.delete(u.email));
      setPicked(next);
    } else {
      const next = new Set(picked);
      filtered.forEach((u) => next.add(u.email));
      setPicked(next);
    }
  };

  const allFilteredChecked =
    filtered.length > 0 && filtered.every((u) => picked.has(u.email));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <UserCheck className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                Select Recipients from Users
              </h3>
              <p className="text-xs text-slate-500">
                {picked.size > 0
                  ? `${picked.size} user${picked.size !== 1 ? "s" : ""} selected`
                  : "Search and select users to add as recipients"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-slate-100 shrink-0 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs shrink-0">
            {(["all", "creator", "advertiser"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-md font-medium transition-all capitalize ${
                  typeFilter === t
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-md bg-muted animate-pulse"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-slate-500 py-12">
              No users match your search.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-10 px-4 py-2.5 text-left">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded text-indigo-600"
                      checked={allFilteredChecked}
                      onChange={toggleAll}
                      title="Select / deselect all visible"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600">
                    Email
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600">
                    Name
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-600">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.id}
                    className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                      picked.has(user.email) ? "bg-indigo-50/60" : ""
                    }`}
                    onClick={() => {
                      const next = new Set(picked);
                      if (next.has(user.email)) next.delete(user.email);
                      else next.add(user.email);
                      setPicked(next);
                    }}
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-indigo-600 pointer-events-none"
                        checked={picked.has(user.email)}
                        readOnly
                      />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-700">
                      {user.email}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {user.full_name ?? (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        className={
                          user.user_type === "creator"
                            ? "bg-purple-100 text-purple-700 text-xs"
                            : user.user_type === "advertiser"
                              ? "bg-blue-100 text-blue-700 text-xs"
                              : "bg-slate-100 text-slate-600 text-xs"
                        }
                      >
                        {user.user_type ?? "—"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {picked.size > 0 ? (
              <span>
                <span className="font-semibold text-indigo-600">
                  {picked.size}
                </span>{" "}
                user{picked.size !== 1 ? "s" : ""} selected
              </span>
            ) : (
              "No users selected"
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={picked.size === 0}
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => {
                onConfirm(Array.from(picked));
                onClose();
              }}
            >
              <UserCheck className="w-4 h-4 mr-1.5" />
              Add {picked.size > 0 ? picked.size : ""} Recipient
              {picked.size !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type Props = {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projects: { id: string; name: string }[];
  onSuccess: () => void;
  prefillEmails?: string[];
  prefillAccountId?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WarmUpManualSendModal({
  isOpen,
  onClose,
  projectId,
  projects,
  onSuccess,
  prefillEmails = [],
  prefillAccountId = "",
}: Props) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [templates, setTemplates] = useState<WarmUpTemplateRow[]>([]);
  const [recipients, setRecipients] = useState<WarmUpRecipientRow[]>([]);
  const [senders, setSenders] = useState<SenderRow[]>([]);
  const [modalAccounts, setModalAccounts] = useState<WarmUpAccountListItem[]>(
    [],
  );

  // Form state
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [fromEmailMode, setFromEmailMode] = useState<
    "account" | "sender" | "custom"
  >("sender");
  const [selectedSenderId, setSelectedSenderId] = useState("");
  const [customFromEmail, setCustomFromEmail] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [sendImmediately, setSendImmediately] = useState(true);
  const [scheduledTime, setScheduledTime] = useState("");

  const activeAccounts = modalAccounts.filter(
    (a) =>
      a.warm_up_status === "active" ||
      a.warm_up_status === "paused" ||
      a.warm_up_status === "pending",
  );

  const loadData = useCallback(async (pId: string) => {
    if (!pId) return;
    setLoading(true);
    try {
      const [tRes, rRes, sRes, aRes] = await Promise.all([
        fetch(`/api/admin/warm-up/templates?project_id=${pId}`),
        fetch(`/api/admin/warm-up/recipients?project_id=${pId}`),
        fetch(`/api/admin/email-projects/${pId}/senders`),
        fetch(`/api/admin/warm-up/emails?project_id=${pId}`),
      ]);
      if (tRes.ok) {
        const d = await tRes.json();
        setTemplates(d.templates ?? []);
      }
      if (rRes.ok) {
        const d = await rRes.json();
        setRecipients(d.recipients ?? []);
      }
      if (sRes.ok) {
        const d = await sRes.json();
        const loadedSenders = (d.senders ?? []) as SenderRow[];
        setSenders(loadedSenders);
        const firstVerified = loadedSenders.find((s) => s.ses_verified);
        if (firstVerified) {
          setSelectedSenderId(firstVerified.id);
        } else if (loadedSenders.length > 0) {
          setSelectedSenderId(loadedSenders[0].id);
        }
      }
      if (aRes.ok) {
        const d = await aRes.json();
        setModalAccounts((d.accounts ?? []) as WarmUpAccountListItem[]);
      }
    } catch (err) {
      console.error("Failed to load modal data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const activeProjId =
      projectId || (projects.length > 0 ? projects[0].id : "");
    setSelectedProjectId(activeProjId);
    setSelectedAccountId("");
    void loadData(activeProjId);

    setSelectedTemplateId("");
    setCustomSubject("");
    setCustomBody("");
    setFromEmailMode("sender");
    setSelectedSenderId("");
    setCustomFromEmail("");
    setSendImmediately(true);
    setScheduledTime("");
  }, [isOpen, projectId, projects, loadData]);

  useEffect(() => {
    if (!isOpen) return;
    if (prefillEmails.length === 0) {
      setSelectedRecipients([]);
    }
  }, [isOpen, prefillEmails]);

  useEffect(() => {
    if (!isOpen || modalAccounts.length === 0) return;

    const currentValid =
      !!selectedAccountId &&
      modalAccounts.some((a) => a.id === selectedAccountId);
    if (currentValid) return;

    const active = modalAccounts.filter(
      (a) =>
        a.warm_up_status === "active" ||
        a.warm_up_status === "paused" ||
        a.warm_up_status === "pending",
    );

    let nextId = "";
    if (
      prefillAccountId &&
      modalAccounts.some((a) => a.id === prefillAccountId)
    ) {
      nextId = prefillAccountId;
    } else {
      nextId = active[0]?.id ?? modalAccounts[0]?.id ?? "";
    }

    if (nextId !== selectedAccountId) {
      setSelectedAccountId(nextId);
    }
  }, [modalAccounts, isOpen, prefillAccountId, selectedAccountId]);

  const handleProjectChange = useCallback(
    async (val: string) => {
      setSelectedProjectId(val);
      void loadData(val);
      setSelectedAccountId("");
      setSelectedTemplateId("");
      setCustomSubject("");
      setCustomBody("");
      setFromEmailMode("sender");
      setSelectedSenderId("");
      setCustomFromEmail("");
    },
    [loadData],
  );

  const selectedAccount = modalAccounts.find((a) => a.id === selectedAccountId);
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const remainingToday = useMemo((): number | null => {
    if (loading || !selectedAccount) return null;
    return Math.max(
      0,
      selectedAccount.daily_limit - selectedAccount.emails_sent_today,
    );
  }, [loading, selectedAccount]);

  const notifyRecipientLimit = useCallback(
    (attempted: number, kept: number) => {
      if (attempted <= kept || remainingToday == null) return;
      toast({
        title: "Daily send limit reached",
        description: `This account can send ${remainingToday} more warm-up email${remainingToday !== 1 ? "s" : ""} today (${selectedAccount?.emails_sent_today ?? 0} of ${selectedAccount?.daily_limit ?? 0} used). Only ${kept} recipient${kept !== 1 ? "s" : ""} were kept.`,
        variant: "destructive",
      });
    },
    [remainingToday, selectedAccount, toast],
  );

  const capRecipients = useCallback(
    (emails: string[]): string[] => {
      const unique = Array.from(
        new Set(
          emails
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e.includes("@")),
        ),
      );
      if (remainingToday == null) {
        return unique;
      }
      if (remainingToday <= 0) {
        if (unique.length > 0 && selectedAccount) {
          toast({
            title: "Daily limit reached",
            description: `This account has already sent ${selectedAccount.emails_sent_today} of ${selectedAccount.daily_limit} warm-up emails today.`,
            variant: "destructive",
          });
        }
        return [];
      }
      const capped = unique.slice(0, remainingToday);
      notifyRecipientLimit(unique.length, capped.length);
      return capped;
    },
    [remainingToday, selectedAccount, notifyRecipientLimit, toast],
  );

  const tryAddRecipient = useCallback(
    (email: string, current: string[]): string[] | null => {
      const normalized = email.trim().toLowerCase();
      if (!normalized.includes("@")) return current;
      if (current.includes(normalized)) return current;
      if (remainingToday == null) return [...current, normalized];
      if (current.length >= remainingToday) {
        toast({
          title: "Daily send limit reached",
          description: `You can select up to ${remainingToday} recipient${remainingToday !== 1 ? "s" : ""} today (${selectedAccount?.emails_sent_today ?? 0} of ${selectedAccount?.daily_limit ?? 0} warm-up emails sent).`,
          variant: "destructive",
        });
        return null;
      }
      return [...current, normalized];
    },
    [remainingToday, selectedAccount, toast],
  );

  const enterSelectMode = useCallback(() => {
    if (typeof window === "undefined") return;
    if (loading || remainingToday == null) return;
    if (!selectedAccount) {
      toast({
        title: "No warm-up account",
        description:
          "Add a sender in the Warm-Up tab before selecting recipients.",
        variant: "destructive",
      });
      return;
    }
    if (remainingToday <= 0) {
      toast({
        title: "Daily limit reached",
        description: `This account cannot send more warm-up emails today (${selectedAccount.emails_sent_today}/${selectedAccount.daily_limit}).`,
        variant: "destructive",
      });
      return;
    }
    sessionStorage.setItem("wu_mode", "1");
    sessionStorage.setItem("wu_project_id", selectedProjectId);
    sessionStorage.setItem("wu_account_id", selectedAccountId);
    sessionStorage.setItem("wu_max_recipients", String(remainingToday));
    window.dispatchEvent(new CustomEvent("wu:enter-select-mode"));
  }, [
    loading,
    selectedProjectId,
    selectedAccountId,
    remainingToday,
    selectedAccount,
    toast,
  ]);

  useEffect(() => {
    if (!isOpen || prefillEmails.length === 0 || !selectedAccount) return;
    setSelectedRecipients(capRecipients(prefillEmails));
  }, [isOpen, prefillEmails, selectedAccount, capRecipients]);

  useEffect(() => {
    const handler = (e: Event) => {
      const emails: string[] = (e as CustomEvent<string[]>).detail ?? [];
      if (emails.length === 0 || !isOpen || !selectedAccount) return;
      setSelectedRecipients((prev) => capRecipients([...prev, ...emails]));
    };
    window.addEventListener("wu:users-selected", handler);
    return () => window.removeEventListener("wu:users-selected", handler);
  }, [isOpen, selectedAccount, capRecipients]);

  useEffect(() => {
    if (!selectedAccount || remainingToday == null) return;
    setSelectedRecipients((prev) => {
      if (prev.length <= remainingToday) return prev;
      const capped = prev.slice(0, remainingToday);
      notifyRecipientLimit(prev.length, capped.length);
      return capped;
    });
  }, [
    selectedAccountId,
    remainingToday,
    selectedAccount,
    notifyRecipientLimit,
  ]);

  // Keep warm-up account in sync with selected sender
  useEffect(() => {
    const sender = senders.find((s) => s.id === selectedSenderId);
    if (!sender) return;
    const account = modalAccounts.find((a) => a.email === sender.email);
    if (account && account.id !== selectedAccountId) {
      setSelectedAccountId(account.id);
    }
  }, [selectedSenderId, senders, modalAccounts, selectedAccountId]);

  const resolvedFromEmail =
    fromEmailMode === "account"
      ? (selectedAccount?.email ?? "")
      : fromEmailMode === "sender"
        ? (senders.find((s) => s.id === selectedSenderId)?.email ?? "")
        : customFromEmail.trim();

  const recipientCount = selectedRecipients.length;

  const canSend =
    !!selectedAccountId &&
    !!selectedTemplateId &&
    !!resolvedFromEmail &&
    recipientCount > 0 &&
    remainingToday != null &&
    remainingToday > 0;

  const handleSend = async () => {
    if (!canSend) return;

    const recipientEmails = capRecipients(selectedRecipients);

    if (recipientEmails.length === 0) {
      toast({
        title: "Daily limit reached",
        description: "No warm-up emails remaining for this account today.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const res = await fetch(
        `/api/admin/warm-up/emails/${selectedAccountId}/send-manual`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: selectedTemplateId,
            recipients: recipientEmails,
            custom_subject: customSubject || undefined,
            custom_body: customBody || undefined,
            from_email:
              resolvedFromEmail !== selectedAccount?.email
                ? resolvedFromEmail
                : undefined,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Send failed",
          description: data.error ?? "Unknown error",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Emails sent",
        description: `Successfully sent ${data.emails_sent ?? data.sent ?? 0} warm-up emails. ${data.remaining_today ?? 0} remaining today.`,
      });
      onSuccess();
      onClose();
    } catch (err) {
      toast({
        title: "Send failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="relative w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shrink-0">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Send Manual Warm-Up Emails
                  </h2>
                  <p className="text-slate-600 text-sm mt-0.5">
                    Send warm-up emails manually with custom templates and
                    recipients
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 p-6">
            {loading ? (
              <EmailModalSkeleton />
            ) : (
              <div className="space-y-5">
                {/* Sender account */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Mail className="w-4 h-4" />
                      Email Project
                    </CardTitle>
                    <CardDescription>
                      Select the email project for these emails
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">
                        Email Project *
                      </Label>
                      <Select
                        value={selectedProjectId}
                        onValueChange={handleProjectChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedAccount && (
                      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                        <span className="font-medium">
                          {selectedAccount.email}
                        </span>
                        <span className="text-blue-700">
                          {" "}
                          — {remainingToday} of {selectedAccount.daily_limit}{" "}
                          warm-up emails remaining today (
                          {selectedAccount.emails_sent_today} sent)
                        </span>
                      </div>
                    )}

                    {activeAccounts.length === 0 && (
                      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                        No active/paused warm-up accounts found for this
                        project. Add senders in the Warm-Up tab first.
                      </p>
                    )}

                    {selectedAccount &&
                      selectedAccount.warm_up_status !== "active" && (
                        <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800">
                            This account is{" "}
                            <strong>{selectedAccount.warm_up_status}</strong>.
                            Sending will still work but start the warm-up for
                            better deliverability.
                          </p>
                        </div>
                      )}
                  </CardContent>
                </Card>

                {/* From email */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Mail className="w-4 h-4" />
                      From Email (Sender)
                    </CardTitle>
                    <CardDescription>
                      Select the verified email address that will appear as the
                      sender
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={selectedSenderId}
                      onValueChange={setSelectedSenderId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select verified sender" />
                      </SelectTrigger>
                      <SelectContent>
                        {senders.length === 0 ? (
                          <SelectItem value="_none" disabled>
                            No verified senders found for this project
                          </SelectItem>
                        ) : (
                          senders.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <span>{s.email}</span>
                              {s.ses_verified && (
                                <Badge className="ml-2 bg-green-100 text-green-800 text-xs">
                                  Verified
                                </Badge>
                              )}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                {/* Template */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="w-4 h-4" />
                      Select Template
                    </CardTitle>
                    <CardDescription>
                      Choose an email template for your warm-up emails
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm font-semibold">
                        Email Template *
                      </Label>
                      <Select
                        value={selectedTemplateId}
                        onValueChange={setSelectedTemplateId}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <span className="font-medium">{t.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                — {t.subject.slice(0, 40)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedTemplate && (
                      <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-2">
                        <p className="font-medium text-slate-700">Preview</p>
                        <p>
                          <span className="font-medium">Subject:</span>{" "}
                          {selectedTemplate.subject}
                        </p>
                        <div className="text-slate-600 whitespace-pre-wrap max-h-28 overflow-y-auto text-xs leading-relaxed border-t pt-2 mt-2">
                          {selectedTemplate.body}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recipients */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="w-4 h-4" />
                      Select Recipients
                    </CardTitle>
                    <CardDescription>
                      Choose recipients from your database
                      {selectedAccount && remainingToday != null && (
                        <span className="block mt-1 text-blue-700 font-medium">
                          You can select up to {remainingToday} recipient
                          {remainingToday !== 1 ? "s" : ""} for this account
                          today.
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        {recipients.length > 0
                          ? `${recipients.length} warm-up recipient${recipients.length !== 1 ? "s" : ""} in DB`
                          : "No warm-up recipients in DB"}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                        disabled={remainingToday != null && remainingToday <= 0}
                        onClick={enterSelectMode}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Select from Users
                      </Button>
                    </div>

                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
                      {recipients.length === 0 &&
                      selectedRecipients.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
                          <Users className="w-8 h-8 text-slate-300" />
                          <div>
                            <p className="text-sm font-medium text-slate-600">
                              No warm-up recipients yet
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              Use "Select from Users" above to pick
                              recipients from your user base.
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 mt-1"
                            disabled={remainingToday != null && remainingToday <= 0}
                            onClick={enterSelectMode}
                          >
                            <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                            Go to Users Table
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {recipients.map((r) => (
                            <label
                              key={r.id}
                              className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5"
                            >
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-blue-600"
                                checked={selectedRecipients.includes(r.email)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const next = tryAddRecipient(
                                      r.email,
                                      selectedRecipients,
                                    );
                                    if (next) setSelectedRecipients(next);
                                  } else {
                                    setSelectedRecipients((prev) =>
                                      prev.filter((x) => x !== r.email),
                                    );
                                  }
                                }}
                              />
                              <span className="text-sm">{r.email}</span>
                              {r.first_name && (
                                <span className="text-xs text-slate-400">
                                  ({r.first_name} {r.last_name ?? ""})
                                </span>
                              )}
                            </label>
                          ))}
                          {selectedRecipients
                            .filter(
                              (e) => !recipients.some((r) => r.email === e),
                            )
                            .map((email) => (
                              <label
                                key={email}
                                className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5"
                              >
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded text-indigo-600"
                                  checked
                                  onChange={() =>
                                    setSelectedRecipients((prev) =>
                                      prev.filter((x) => x !== email),
                                    )
                                  }
                                />
                                <span className="text-sm">{email}</span>
                                <Badge className="bg-indigo-100 text-indigo-700 text-xs">
                                  from users
                                </Badge>
                              </label>
                            ))}
                        </div>
                      )}
                    </div>

                    {selectedRecipients.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-blue-100 text-blue-800">
                          {selectedRecipients.length} recipient
                          {selectedRecipients.length !== 1 ? "s" : ""} selected
                        </Badge>
                        <button
                          type="button"
                          onClick={() => setSelectedRecipients([])}
                          className="text-xs text-slate-400 hover:text-red-500 underline"
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Custom content (optional) */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="w-4 h-4" />
                      Custom Content{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Override the template subject or body for this send
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-sm font-semibold">
                        Custom Subject
                      </Label>
                      <Input
                        placeholder="Leave empty to use template subject"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">
                        Custom Body
                      </Label>
                      <Textarea
                        placeholder="Leave empty to use template body"
                        value={customBody}
                        onChange={(e) => setCustomBody(e.target.value)}
                        className="mt-1.5 min-h-[100px]"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Timing */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="w-4 h-4" />
                      Sending Options
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-blue-600"
                        checked={sendImmediately}
                        onChange={(e) => setSendImmediately(e.target.checked)}
                      />
                      <span className="text-sm">
                        Send immediately (emails staggered 2–4 s apart)
                      </span>
                    </label>
                    {!sendImmediately && (
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold">
                          Scheduled Time
                        </Label>
                        <Input
                          type="datetime-local"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Summary */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                      <h4 className="font-semibold text-blue-900 text-sm">
                        Send Summary
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                      <span className="text-slate-600">Account:</span>
                      <span className="font-medium">
                        {selectedAccount?.email ?? "Not selected"}
                      </span>
                      <span className="text-slate-600">From:</span>
                      <span className="font-medium">
                        {resolvedFromEmail || "Not set"}
                      </span>
                      <span className="text-slate-600">Template:</span>
                      <span className="font-medium">
                        {selectedTemplate?.name ?? "Not selected"}
                      </span>
                      <span className="text-slate-600">Recipients:</span>
                      <span className="font-medium">
                        {recipientCount} email{recipientCount !== 1 ? "s" : ""}
                        {selectedAccount && (
                          <span className="text-slate-500 font-normal">
                            {" "}
                            (max {remainingToday} today)
                          </span>
                        )}
                      </span>
                      <span className="text-slate-600">Send time:</span>
                      <span className="font-medium">
                        {sendImmediately
                          ? "Immediately (staggered)"
                          : scheduledTime || "Not set"}
                      </span>
                      {(customSubject || customBody) && (
                        <>
                          <span className="text-slate-600">
                            Custom content:
                          </span>
                          <span className="font-medium">Yes</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200 bg-slate-50 shrink-0">
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose} disabled={sending}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || !canSend || loading}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Warm-Up Emails
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
