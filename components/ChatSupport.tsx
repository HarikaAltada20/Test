"use client";
import React, { useEffect, useState } from "react";
import { X, MessageSquare, ExternalLink, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SOCIAL_LINKS } from "@/constants/socialLinks";
import { cn } from "@/lib/utils";
interface ChatProps {
  onClose: () => void;
  email: string; // 👈 pass logged-in user's email
  userType?: "creator" | "advertiser" | "admin"; //show creator-only CTA
}

const ChatSupport: React.FC<ChatProps> = ({ onClose, email, userType }) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const getInitialMode = (): "light" | "dark" => {
    if (typeof document === "undefined") return "light";
    const dataMode = document
      .querySelector("[data-mode]")
      ?.getAttribute("data-mode");
    if (dataMode === "dark" || dataMode === "light") {
      return dataMode;
    }
    if (document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  };

  const [mode, setMode] = useState<"light" | "dark">(getInitialMode);
  // Read mode from data attribute and html class, respond to changes
  useEffect(() => {
    const readMode = (): "light" | "dark" => {
      const el = document.querySelector("[data-mode]");
      const attr = el?.getAttribute("data-mode");
      if (attr === "dark" || attr === "light") return attr;
      return document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
    };

    // Set immediately on mount to avoid any flicker
    setMode(readMode());

    // Watch for changes on either data-mode or html class
    const observer = new MutationObserver(() => {
      setMode(readMode());
    });
    const dataModeTarget = document.querySelector("[data-mode]");
    if (dataModeTarget) {
      observer.observe(dataModeTarget, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);
  const isDark = mode === "dark";

  const handleSubmit = async () => {
    if (!query.trim()) {
      toast({
        title: "Missing Query",
        description: "Please enter your query before submitting.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, query_text: query }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to save query");

      toast({
        title: "Success 🎉",
        description: "Your query has been submitted successfully!",
      });

      setQuery("");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong!",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 bg-opacity-65 flex items-center justify-center p-2 sm:p-4 z-50",
        isDark ? "bg-[#100A33]" : "bg-black"
      )}
    >
      <div
        className={cn(
          "fixed right-2 sm:right-6 bottom-20 w-[calc(100vw-1rem)] max-w-[380px] sm:w-[380px] max-h-[85vh] shadow-2xl rounded-lg z-50 flex flex-col overflow-hidden",
          isDark ? "bg-[#06021D]" : "bg-white"
        )}
      >
        {/* Header Section */}
        <div
          className={cn(
            "text-white rounded-t-lg p-4 sm:p-6 flex justify-between items-start",
            isDark
              ? "bg-[#7F39EC] border-[#7F39EC]"
              : "bg-purple-500 border-purple-500"
          )}
        >
          <h2 className="text-base sm:text-xl">Get Touch with Us!</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition ml-2 flex-shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Form Section */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto">
          <h3 className="font-semibold mb-2 text-base sm:text-lg">
            Drop us a Query
          </h3>
          <p
            className={cn(
              "text-sm sm:text-md text-gray-600 mb-4",
              isDark ? "text-white" : "text-gray-600"
            )}
          >
            Fill in the details below and our team will get in touch with you
            within 24 hours.
          </p>

          <textarea
            placeholder="Type your query here*"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(
              "w-full border px-3 py-2 rounded mb-3 text-sm h-[200px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500",
              isDark
                ? "bg-[#06021D] border border-gray-500"
                : "bg-white border-gray-300 "
            )}
          ></textarea>

          {userType === "creator" && (
            <div
              className={cn(
                "mb-4 p-3 rounded-md border bg-purple-50",
                isDark
                  ? "bg-[#C9A7FF26] border border-[#C9A7FF]"
                  : "bg-purple-50 border-purple-500"
              )}
            >
              <div className="flex items-start gap-2">
                <div
                  className={cn(
                    "p-1.5 rounded-full bg-white border",
                    isDark
                      ? "bg-[#06021D] border border-gray-500"
                      : "bg-white border-gray-300"
                  )}
                >
                  <MessageCircle
                    className={cn(
                      "h-4 w-4",
                      isDark ? "text-[#C9A7FF]" : "text-purple-600"
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "flex-1 text-xs sm:text-sm text-gray-700",
                    isDark ? "text-white" : "text-gray-700"
                  )}
                >
                  For quicker responses, join our active Game of creators
                  discord community.
                  <div className="mt-2">
                    <a
                      href={SOCIAL_LINKS.discord}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 text-xs sm:text-sm"
                    >
                      <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{" "}
                      Join Discord
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className={cn(
              "w-full py-3 rounded-full font-semibold text-white",
              isDark
                ? "bg-[#7F39EC] to-[#B16FF4]"
                : "bg-gradient-to-r from-[#7F39EC] to-[#B16FF4]"
            )}
          >
            {loading ? "Submitting..." : "SUBMIT"}
          </button>

          {/* {message && (
          <p className="mt-2 text-sm text-center text-gray-700">{message}</p>
        )} */}
        </div>

        {/* Button */}
        <button className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-purple-500 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg transition z-50">
          <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>
    </div>
  );
};

export default ChatSupport;
