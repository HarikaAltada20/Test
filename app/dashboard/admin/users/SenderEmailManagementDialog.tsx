"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { EmailModalSkeleton } from "./EmailSkeletons";

type SenderRow = {
  id: string;
  email: string;
  is_default: boolean;
  ses_verified: boolean;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type ProjectMeta = {
  name: string;
  full_domain: string | null;
  use_platform_sender: boolean;
  ses_verification_status: string;
};

type Props = {
  open: boolean;
  projectId: string | null;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

const emptyForm = () => ({
  emailLocal: "",
  emailFull: "",
  displayName: "",
  firstName: "",
  lastName: "",
});

export function SenderEmailManagementDialog({
  open,
  projectId,
  onOpenChange,
  onUpdated,
}: Props) {
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [senders, setSenders] = useState<SenderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const domain = project?.full_domain ?? null;
  const useDomainSuffix = !!domain && !project?.use_platform_sender;

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [projectRes, sendersRes] = await Promise.all([
        fetch(`/api/admin/email-projects/${projectId}`),
        fetch(`/api/admin/email-projects/${projectId}/senders`),
      ]);
      const projectData = await projectRes.json();
      const sendersData = await sendersRes.json();
      if (projectRes.ok) {
        const p = projectData.project;
        setProject({
          name: p.name,
          full_domain: p.full_domain,
          use_platform_sender: p.use_platform_sender,
          ses_verification_status: p.ses_verification_status,
        });
      }
      setSenders(sendersData.senders ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open && projectId) {
      setEditingId(null);
      setForm(emptyForm());
      load();
    }
  }, [open, projectId, load]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
  };

  const buildEmail = () => {
    if (useDomainSuffix) {
      const local = form.emailLocal.trim().toLowerCase();
      if (!local) return "";
      return `${local}@${domain}`;
    }
    return form.emailFull.trim().toLowerCase();
  };

  const startEdit = (sender: SenderRow) => {
    setEditingId(sender.id);
    const at = sender.email.indexOf("@");
    setForm({
      emailLocal: at > 0 ? sender.email.slice(0, at) : sender.email,
      emailFull: sender.email,
      displayName: sender.display_name ?? "",
      firstName: sender.first_name ?? "",
      lastName: sender.last_name ?? "",
    });
    setError(null);
  };

  const handleSubmit = async () => {
    if (!projectId) return;
    const email = buildEmail();
    if (!email || !email.includes("@")) {
      setError("Enter a valid email address");
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("First name and last name are required");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        email,
        displayName: form.displayName.trim() || undefined,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      };

      const res = editingId
        ? await fetch(
            `/api/admin/email-projects/${projectId}/senders/${editingId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          )
        : await fetch(`/api/admin/email-projects/${projectId}/senders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, isDefault: senders.length === 0 }),
          });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save sender");
        return;
      }

      resetForm();
      await load();
      onUpdated?.();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!projectId || !deleteId) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/email-projects/${projectId}/senders/${deleteId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete sender");
        return;
      }
      if (editingId === deleteId) resetForm();
      setDeleteId(null);
      await load();
      onUpdated?.();
    } finally {
      setSubmitting(false);
    }
  };

  const domainLabel = domain ?? "your verified domain";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white gap-0 p-0">
          <DialogHeader className="pt-2 pb-4 border-b border-gray-100">
            <DialogTitle className="text-xl font-bold text-gray-900">
              Sender Email Management
            </DialogTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Manage sender emails for{" "}
              <span className="font-medium text-gray-800">{domainLabel}</span>
            </p>
          </DialogHeader>

          <div className="py-5 space-y-6">
            <div className="rounded-xl border border-gray-200 p-5 space-y-4 bg-gray-50/40">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {editingId ? "Edit Sender Email" : "Add New Sender Email"}
                </h3>
                {useDomainSuffix && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Add a new email address from your verified domain:{" "}
                    <span className="font-medium text-gray-700">{domain}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Email Address *
                </Label>
                {useDomainSuffix ? (
                  <div className="flex items-center gap-0">
                    <Input
                      placeholder="partnerships"
                      value={form.emailLocal}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, emailLocal: e.target.value }))
                      }
                      className="rounded-r-none border-gray-300 bg-white"
                    />
                    <span className="h-10 px-3 flex items-center border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-sm text-gray-600 whitespace-nowrap">
                      @{domain}
                    </span>
                  </div>
                ) : (
                  <Input
                    placeholder="noreply@gameofcreators.com"
                    value={form.emailFull}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, emailFull: e.target.value }))
                    }
                    className="border-gray-300 bg-white"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">
                  Display Name
                </Label>
                <Input
                  placeholder="John Doe"
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, displayName: e.target.value }))
                  }
                  className="border-gray-300 bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    First Name *
                  </Label>
                  <Input
                    placeholder="John"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                    className="border-gray-300 bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Last Name *
                  </Label>
                  <Input
                    placeholder="Doe"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                    className="border-gray-300 bg-white"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2 pt-1">
                <Button
                  className="bg-[#662EBD] hover:bg-[#5524a8] text-white"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingId ? "Update Email" : "Add Email"}
                </Button>
                {(editingId || form.emailLocal || form.emailFull) && (
                  <Button
                    variant="outline"
                    className="border-[#662EBD] text-[#662EBD] hover:bg-purple-50"
                    onClick={resetForm}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">
                Sender Emails ({senders.length})
              </h3>

              {loading ? (
                <EmailModalSkeleton />
              ) : senders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
                  No sender emails yet. Add one above.
                </p>
              ) : (
                <div className="space-y-3">
                  {senders.map((sender) => {
                    const subtitle = [
                      sender.display_name,
                      [sender.first_name, sender.last_name]
                        .filter(Boolean)
                        .join(" "),
                    ]
                      .filter(Boolean)
                      .filter((v, i, arr) => arr.indexOf(v) === i)
                      .join(" · ");

                    return (
                      <div
                        key={sender.id}
                        className={cn(
                          "flex items-start gap-4 rounded-xl border border-gray-200 p-4 bg-white",
                          editingId === sender.id && "ring-2 ring-[#662EBD]/30",
                        )}
                      >
                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-[#662EBD]" />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-gray-900 break-all">
                              {sender.email}
                            </p>
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              Active
                            </Badge>
                            {sender.ses_verified ||
                            project?.ses_verification_status === "verified" ? (
                              <Badge
                                variant="outline"
                                className="border-green-500 text-green-700 gap-1"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-amber-400 text-amber-700"
                              >
                                Pending
                              </Badge>
                            )}
                            {sender.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                Default
                              </Badge>
                            )}
                          </div>
                          {subtitle && (
                            <p className="text-sm text-muted-foreground">
                              {subtitle}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 border-purple-200 text-[#662EBD] hover:bg-purple-50"
                            onClick={() => startEdit(sender)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteId(sender.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sender email?</AlertDialogTitle>
            <AlertDialogDescription>
              This sender will be removed from the project. Campaigns using this
              address may need to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {submitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
