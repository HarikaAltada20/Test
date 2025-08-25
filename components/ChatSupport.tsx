"use client";
import React, { useState } from "react";
import { X, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
interface ChatProps {
  onClose: () => void;
  email: string; // 👈 pass logged-in user's email
}

const ChatSupport: React.FC<ChatProps> = ({ onClose, email }) => {
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
          Fill in the details below and our advisors will get in touch with you
          within 24 hours.
        </p>

        <textarea
          placeholder="Type your query here*"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full border border-gray-300 px-3 py-2 rounded mb-3 text-sm h-[200px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
        ></textarea>

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

      {/* Floating Button */}
      <button className="fixed bottom-6 right-6 bg-purple-500 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-800 transition z-50">
        <MessageSquare size={25} />
      </button>
    </div>
  );
};

export default ChatSupport;
