"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export type EmailTemplateItem = {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at?: string;
};

import {
  BULK_EMAIL_MERGE_TAG_DEFAULTS,
  BULK_EMAIL_MERGE_VARIABLES,
  mergeTag,
} from "@/lib/admin-notifications/template";

type Props = {
  open: boolean;
  onClose: () => void;
  onInsert: (subject: string, body: string) => void;
};

export function EmailTemplatePickerModal({ open, onClose, onInsert }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"browse" | "create">("browse");
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplateItem | null>(
    null,
  );

  const [genLoading, setGenLoading] = useState(false);
  const [genName, setGenName] = useState("");
  const [genSubject, setGenSubject] = useState("");
  const [genBody, setGenBody] = useState("");
  const [genDirty, setGenDirty] = useState(false);
  const [savingGenerated, setSavingGenerated] = useState(false);
  const [genForm, setGenForm] = useState({
    templateType: "cold_outreach",
    tone: "professional",
    targetAudience: "",
    industryFocus: "",
    calendlyUrl: "",
  });
  const [selectedVars, setSelectedVars] = useState<string[]>([
    ...BULK_EMAIL_MERGE_TAG_DEFAULTS,
  ]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email-templates");
      const data = await res.json();
      if (res.ok) {
        const list = (data.templates ?? []) as EmailTemplateItem[];
        setTemplates(list);
        if (list.length > 0 && !selectedId) {
          setSelectedId(list[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadTemplates();
      setMode("browse");
    }
  }, [open]);

  const filtered = templates.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q)
    );
  });

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  const handleGenerate = async () => {
    setGenLoading(true);
    try {
      const res = await fetch("/api/admin/email-templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateType: genForm.templateType,
          tone: genForm.tone,
          targetAudience: genForm.targetAudience,
          industryFocus: genForm.industryFocus,
          selectedVariables: selectedVars,
          calendlyUrl: genForm.calendlyUrl || null,
          templateName: genName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast({
          title: "Generation failed",
          description: data.error || "Could not generate template",
          variant: "destructive",
        });
        return;
      }
      setGenSubject(data.data.subject ?? "");
      setGenBody(data.data.body ?? "");
      if (!genName.trim() && data.data.subject) {
        setGenName(data.data.subject.slice(0, 60));
      }
      setGenDirty(true);
      toast({ title: "Template generated" });
    } finally {
      setGenLoading(false);
    }
  };

  const handleSaveGenerated = async () => {
    if (!genSubject.trim() || !genBody.trim()) return;
    setSavingGenerated(true);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: genName.trim() || genSubject.trim(),
          subject: genSubject.trim(),
          body: genBody.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Save failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Template saved" });
      setGenDirty(false);
      await loadTemplates();
      if (data.template?.id) {
        setSelectedId(data.template.id);
        setMode("browse");
      }
    } finally {
      setSavingGenerated(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      const res = await fetch(
        `/api/admin/email-templates/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        toast({
          title: "Delete failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      if (selectedId === deleteTarget.id) {
        setSelectedId(null);
      }
      toast({ title: "Template deleted" });
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  const handleClose = () => {
    if (mode === "create" && genDirty && (genSubject || genBody)) {
      if (
        !window.confirm(
          "Discard the generated template? Unsaved changes will be lost.",
        )
      ) {
        return;
      }
    }
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col gap-0 p-0 bg-white">
          <DialogHeader className="px-5 py-4 border-b shrink-0">
            <DialogTitle>Choose Template</DialogTitle>
          </DialogHeader>

          <div className="px-5 py-2 border-b bg-gray-50 shrink-0">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMode("browse")}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  mode === "browse"
                    ? "bg-white text-[#662EBD] border border-purple-200 shadow-sm"
                    : "text-gray-600 hover:text-gray-900",
                )}
              >
                Browse
              </button>
              <button
                type="button"
                onClick={() => setMode("create")}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5",
                  mode === "create"
                    ? "bg-white text-[#662EBD] border border-purple-200 shadow-sm"
                    : "text-gray-600 hover:text-gray-900",
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                New Template (AI)
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
            {mode === "browse" ? (
              <>
                <div className="w-full md:w-[35%] border-r p-4 overflow-y-auto space-y-3">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="bg-white"
                  />
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      No templates found. Use New Template (AI) to create one.
                    </p>
                  ) : (
                    filtered.map((t) => (
                      <div
                        key={t.id}
                        className={cn(
                          "flex items-start gap-1 rounded-md border",
                          selectedId === t.id
                            ? "border-purple-300 bg-purple-50"
                            : "border-gray-200",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          className="flex-1 p-3 text-left min-w-0"
                        >
                          <p className="font-medium text-sm text-gray-900 line-clamp-2">
                            {t.name || t.subject}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {t.subject}
                          </p>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(t)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex-1 p-5 overflow-y-auto">
                  {!selected ? (
                    <p className="text-sm text-muted-foreground">
                      Select a template to preview
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="border-b pb-3">
                        <p className="text-sm text-muted-foreground">Subject</p>
                        <p className="font-medium">{selected.subject}</p>
                      </div>
                      <div
                        className="prose prose-sm max-w-none border rounded-md p-4 bg-white"
                        dangerouslySetInnerHTML={{ __html: selected.body }}
                      />
                      <div className="flex justify-end">
                        <Button
                          className="bg-[#662EBD] hover:bg-[#5524a8]"
                          onClick={() => {
                            onInsert(selected.subject, selected.body);
                            onClose();
                          }}
                        >
                          Insert into editor
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col md:flex-row flex-1 min-h-0 w-full">
                <div className="w-full md:w-[40%] border-r p-4 overflow-y-auto space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Template Name</Label>
                    <Input
                      value={genName}
                      onChange={(e) => setGenName(e.target.value)}
                      placeholder="e.g. Fitness outreach"
                      className="bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Type</Label>
                      <select
                        value={genForm.templateType}
                        onChange={(e) =>
                          setGenForm({ ...genForm, templateType: e.target.value })
                        }
                        className="w-full h-9 rounded-md border border-gray-300 px-2 text-sm bg-white"
                      >
                        <option value="cold_outreach">Cold Outreach</option>
                        <option value="follow_up">Follow Up</option>
                        <option value="newsletter">Newsletter</option>
                        <option value="promotional">Promotional</option>
                        <option value="welcome">Welcome</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tone</Label>
                      <select
                        value={genForm.tone}
                        onChange={(e) =>
                          setGenForm({ ...genForm, tone: e.target.value })
                        }
                        className="w-full h-9 rounded-md border border-gray-300 px-2 text-sm bg-white"
                      >
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="casual">Casual</option>
                        <option value="formal">Formal</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Target Audience</Label>
                    <Input
                      value={genForm.targetAudience}
                      onChange={(e) =>
                        setGenForm({ ...genForm, targetAudience: e.target.value })
                      }
                      placeholder="e.g. Startup founders"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Industry Focus</Label>
                    <Input
                      value={genForm.industryFocus}
                      onChange={(e) =>
                        setGenForm({ ...genForm, industryFocus: e.target.value })
                      }
                      placeholder="e.g. Fitness"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Booking Link (optional)</Label>
                    <Input
                      value={genForm.calendlyUrl}
                      onChange={(e) =>
                        setGenForm({ ...genForm, calendlyUrl: e.target.value })
                      }
                      placeholder="https://calendly.com/..."
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Variables</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {BULK_EMAIL_MERGE_VARIABLES.map((v) => (
                        <label
                          key={v.key}
                          className="flex items-center gap-2 text-xs cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedVars.includes(v.key)}
                            onCheckedChange={(checked) => {
                              setSelectedVars((prev) =>
                                checked
                                  ? [...prev, v.key]
                                  : prev.filter((x) => x !== v.key),
                              );
                            }}
                          />
                          {v.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button
                    className="w-full bg-[#662EBD] hover:bg-[#5524a8]"
                    onClick={handleGenerate}
                    disabled={genLoading}
                  >
                    {genLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate 
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex-1 p-5 overflow-y-auto">
                  {genLoading ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[280px] gap-4">
                      <Loader2 className="h-10 w-10 animate-spin text-[#662EBD]" />
                      <p className="text-sm text-muted-foreground">
                        Generating your email template...
                      </p>
                    </div>
                  ) : genSubject || genBody ? (
                    <div className="space-y-4">
                      <div className="border-b pb-3">
                        <p className="text-sm text-muted-foreground">Subject</p>
                        <p className="font-medium">{genSubject || "—"}</p>
                      </div>
                      <div
                        className="prose prose-sm max-w-none border rounded-md p-4 bg-white min-h-[200px]"
                        dangerouslySetInnerHTML={{ __html: genBody || "" }}
                      />
                      <div className="flex flex-wrap gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={handleSaveGenerated}
                          disabled={savingGenerated || !genSubject || !genBody}
                        >
                          {savingGenerated ? "Saving..." : "Save Template"}
                        </Button>
                        <Button
                          className="bg-[#662EBD] hover:bg-[#5524a8]"
                          onClick={() => {
                            onInsert(genSubject, genBody);
                            onClose();
                          }}
                          disabled={!genSubject || !genBody}
                        >
                          Insert into editor
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Fill in the form and click Generate with Gemini to create a
                      template.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-5 py-3 border-t shrink-0">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingId}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deletingId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
