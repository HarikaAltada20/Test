"use client";
import React, { useState } from "react";
import { X, MessageSquare, ExternalLink, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SOCIAL_LINKS } from "@/constants/socialLinks";
interface ChatProps {
  onClose: () => void;
  email: string; // 👈 pass logged-in user's email
  userType?: "creator" | "advertiser" | "admin"; // optional: show creator-only CTA
}

const ChatSupport: React.FC<ChatProps> = ({ onClose, email, userType }) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { toast } = useToast();

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
    <div className="fixed right-6 bottom-20 w-[380px] bg-white shadow-2xl border rounded-lg z-50 flex flex-col">
      {/* Header Section */}
      <div className="bg-purple-500 text-white rounded-t-lg p-6 flex justify-between items-start">
        <h2 className="text-xl">Get Touch with Us!</h2>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition ml-2"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form Section */}
      <div className="p-5 flex-1">
        <h3 className="font-semibold mb-2 text-lg">Drop us a Query</h3>
        <p className="text-md text-gray-600 mb-4">
          Fill in the details below and our team will get in touch with you
          within 24 hours.
        </p>

        <textarea
          placeholder="Type your query here*"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border border-gray-300 px-3 py-2 rounded mb-3 text-sm h-[200px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
        ></textarea>

        {userType === "creator" && (
          <div className="mb-4 p-3 rounded-md border bg-purple-50">
            <div className="flex items-start gap-2">
              <div className="p-1.5 rounded bg-white border">
                <MessageCircle className="h-4 w-4 text-purple-600" />
              </div>
              <div className="flex-1 text-sm text-gray-700">
                For quicker responses, join our active Game of creators discord community.
                <div className="mt-2">
                  <a
                    href={SOCIAL_LINKS.discord}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700"
                  >
                    <ExternalLink className="h-4 w-4" /> Join Discord
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-3 rounded-full bg-gradient-to-r from-[#7F39EC] to-[#B16FF4] font-semibold text-white"
        >
          {loading ? "Submitting..." : "SUBMIT"}
        </button>

        {/* {message && (
          <p className="mt-2 text-sm text-center text-gray-700">{message}</p>
        )} */}
      </div>

      {/* Button */}
      <button className="fixed bottom-6 right-6 bg-purple-500 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg  transition z-50">
        <MessageSquare size={25} />
      </button>
    </div>
  );
};

export default ChatSupport;
