"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_PROJECT_DESCRIPTION_LENGTH } from "@/lib/admin-email/project-options";

type Props = {
  isDark?: boolean;
  onCancel: () => void;
  onCreated: (projectId: string, needsEmailConfig: boolean) => void;
};

export function CreateEmailProjectForm({
  isDark,
  onCancel,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/email-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          websiteUrl: websiteUrl.trim() || null,
          targetAudience: targetAudience.trim() || null,
          description: description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create project");
        return;
      }
      onCreated(data.project.id, true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      className={cn(
        "rounded-xl shadow border",
        isDark ? "bg-[#170337] border-purple-900/40" : "bg-white",
      )}
    >
      <CardHeader className="pb-4">
        <CardTitle
          className={cn("text-xl", isDark ? "text-white" : "text-gray-900")}
        >
          Create New Project
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="project-name">
                Project Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="project-name"
                placeholder="Enter project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={isDark ? "bg-[#22044a] border-purple-800" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website-url">Website URL</Label>
              <Input
                id="website-url"
                type="url"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className={isDark ? "bg-[#22044a] border-purple-800" : ""}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="target-audience">Target Audience</Label>
              <Input
                id="target-audience"
                placeholder="e.g., Small business owners aged 25-45"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className={isDark ? "bg-[#22044a] border-purple-800" : ""}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">
                Description ({description.length}/{MAX_PROJECT_DESCRIPTION_LENGTH}{" "}
                characters)
              </Label>
              <Textarea
                id="description"
                rows={5}
                placeholder="Describe your project goals and objectives..."
                value={description}
                maxLength={MAX_PROJECT_DESCRIPTION_LENGTH}
                onChange={(e) => setDescription(e.target.value)}
                className={cn(
                  "resize-none",
                  isDark ? "bg-[#22044a] border-purple-800" : "",
                )}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-purple-600 hover:bg-purple-700 min-w-[140px]"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
