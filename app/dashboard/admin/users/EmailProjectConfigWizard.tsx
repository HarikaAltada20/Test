"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Globe,
  Link2,
  Loader2,
  Mail,
  Pencil,
  Send,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DnsRecord = { type: string; name: string; value: string; purpose: string };

type Props = {
  open: boolean;
  projectId: string | null;
  projectName?: string;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};

const STEPS = [
  {
    icon: Globe,
    title: "Connect your domain",
    desc: "We'll use a dedicated subdomain for safer deliverability.",
  },
  {
    icon: Link2,
    title: "Add DNS records",
    desc: "Copy the TXT, CNAME, MX and DMARC we generate for you.",
  },
  {
    icon: ShieldCheck,
    title: "Verify with SES",
    desc: "We'll check DKIM and enable sending for your subdomain.",
  },
  {
    icon: Send,
    title: "Start sending",
    desc: "Launch campaigns, track replies and performance automatically.",
  },
];

function activeStepIndex(phase: "form" | "dns" | "sender" | "verified") {
  if (phase === "form") return 0;
  if (phase === "dns") return 1;
  return 3;
}

export function EmailProjectConfigWizard({
  open,
  projectId,
  projectName,
  onOpenChange,
  onComplete,
}: Props) {
  const [phase, setPhase] = useState<"form" | "dns" | "sender" | "verified">(
    "form",
  );
  const [rootDomain, setRootDomain] = useState("gameofcreators.com");
  const [subdomainPrefix, setSubdomainPrefix] = useState("connect");
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [senderEmail, setSenderEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const reset = () => {
    setPhase("form");
    setDnsRecords([]);
    setSenderEmail("");
    setError(null);
    setVerified(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const saveEmailConfig = async () => {
    if (!projectId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/email-projects/${projectId}/email-config`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rootDomain, subdomainPrefix }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save domain");
        return;
      }
      setDnsRecords(data.project?.dns_records ?? []);
      setPhase("dns");
    } finally {
      setSubmitting(false);
    }
  };

  const checkVerification = async () => {
    if (!projectId) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/email-projects/${projectId}/verify-ses`,
        { method: "POST" },
      );
      const data = await res.json();
      setVerified(data.status === "verified");
      setPhase("sender");
    } finally {
      setSubmitting(false);
    }
  };

  const exportDnsJson = () => {
    const blob = new Blob([JSON.stringify(dnsRecords, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dns-records.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const addSender = async () => {
    if (!projectId || !senderEmail.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/email-projects/${projectId}/senders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: senderEmail.trim(), isDefault: true }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add sender");
        return;
      }
      onComplete();
      handleClose(false);
    } finally {
      setSubmitting(false);
    }
  };

  const fullDomain = `${subdomainPrefix}.${rootDomain}`;
  const currentStep = activeStepIndex(phase);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 gap-0 overflow-hidden bg-white text-gray-900 border-gray-200">
        <div className="border-b border-gray-200 bg-gradient-to-r from-white via-purple-50/60 to-blue-50/60 px-8 py-6">
          <div className="flex items-start gap-4 pr-8">
            <div className="h-11 w-11 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Email Configuration
              </h2>
              {projectName && (
                <p className="text-sm text-purple-600 font-medium mt-0.5">
                  {projectName}
                </p>
              )}
              <p className="text-sm text-gray-600 mt-1 max-w-2xl">
                Enter your root domain and choose a subdomain prefix. We will set
                up and verify the subdomain for sending and replies.
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-5 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-gray-100 bg-gray-50/50">
          {STEPS.map((s, i) => {
            const isActive = i === currentStep;
            const isComplete = i < currentStep;
            return (
              <div
                key={s.title}
                className={cn(
                  "rounded-xl p-4 text-xs border bg-white shadow-sm transition-colors",
                  isActive
                    ? "border-blue-500 ring-1 ring-blue-500/20"
                    : isComplete
                      ? "border-green-200 bg-green-50/40"
                      : "border-gray-200",
                )}
              >
                <s.icon
                  className={cn(
                    "h-4 w-4 mb-2",
                    isActive
                      ? "text-blue-600"
                      : isComplete
                        ? "text-green-600"
                        : "text-gray-400",
                  )}
                />
                <p className="font-semibold text-gray-900">{s.title}</p>
                <p className="text-gray-500 mt-1 leading-snug">{s.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="px-8 py-6 space-y-4 max-h-[55vh] overflow-y-auto bg-white">
          {phase === "form" && (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Pencil className="h-4 w-4 text-purple-600" />
                Email Configuration
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-700">
                    Root Domain <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={rootDomain}
                    onChange={(e) => setRootDomain(e.target.value)}
                    placeholder="example.com"
                    className="bg-white border-gray-300"
                  />
                  <p className="text-xs text-gray-500">
                    Your root domain (no http:// or www)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700">
                    Subdomain Prefix <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={subdomainPrefix}
                    onChange={(e) => setSubdomainPrefix(e.target.value)}
                    placeholder="connect"
                    className="bg-white border-gray-300"
                  />
                  <p className="text-xs text-gray-500">
                    Creates {fullDomain}
                  </p>
                </div>
              </div>
            </>
          )}

          {phase === "dns" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">
                  SES Subdomain Verification
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  onClick={exportDnsJson}
                >
                  Export DNS JSON
                </Button>
              </div>
              <div className="space-y-3 text-sm">
                {dnsRecords.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-gray-200 bg-white shadow-sm p-4"
                  >
                    <p className="font-semibold text-gray-900">
                      {r.purpose} ({r.type})
                    </p>
                    <p className="text-gray-500 break-all text-xs mt-1">
                      {r.name}
                    </p>
                    <p className="break-all text-xs mt-1 text-gray-700 font-mono bg-gray-50 rounded px-2 py-1">
                      {r.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === "sender" && (
            <div className="space-y-4">
              {verified ? (
                <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                  <p className="font-semibold text-green-800 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    SES Subdomain Verified Successfully!
                  </p>
                  <p className="text-sm text-green-700 mt-2">
                    Domain: {fullDomain} — add a default sender email below.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                  Verification pending. You can still add a sender — emails will
                  send once DNS propagates.
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-gray-700">Default sender email *</Label>
                <Input
                  placeholder={`announcements@${fullDomain}`}
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="bg-white border-gray-300"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="px-8 text-sm text-red-600 bg-red-50 py-2 border-t border-red-100">
            {error}
          </p>
        )}

        <DialogFooter className="px-8 py-5 border-t border-gray-200 bg-gray-50/80 flex-row justify-end gap-2">
          {phase === "form" && (
            <Button
              onClick={saveEmailConfig}
              disabled={submitting || !projectId}
              className="ml-auto bg-purple-600 hover:bg-purple-700 text-white"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Configuration
            </Button>
          )}
          {phase === "dns" && (
            <>
              <Button variant="outline" onClick={() => setPhase("form")}>
                Back
              </Button>
              <Button
                onClick={checkVerification}
                disabled={submitting}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Check Verification
              </Button>
            </>
          )}
          {phase === "sender" && (
            <>
              <Button variant="outline" onClick={() => setPhase("dns")}>
                Back
              </Button>
              <Button
                onClick={addSender}
                disabled={submitting || !senderEmail}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Finish
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
