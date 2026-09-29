"use client";
import { Mail, Calendar, ArrowRight, User, MessageSquare } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

const CALENDLY_URL = "https://calendly.com/guptavishesh2/30min";

export default function ContactPage() {
  const { toast } = useToast();
  // form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [, setStatus] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" }); // clear error on typing
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Enter a valid email address";
    }
    if (!formData.message.trim()) newErrors.message = "Message is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("");

    if (!validate()) return; // stop if validation fails

    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name, email: formData.email, message: formData.message }),
      });

      const data = await res.json();
      if (res.ok) {
        const successMsg = "✅ Message sent successfully!";
        setStatus(successMsg);
        toast({
          title: "Success",
          description: successMsg,
          variant: "default",
        });
        setFormData({ name: "", email: "", message: "" });
      } else {
        const errorMsg = "❌ Failed: " + data.error;
        setStatus(errorMsg);
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (err) {
      const errorMsg = "❌ Something went wrong.";
      setStatus(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-black text-white pt-[20px] pb-12 px-6 sm:pb-20 sm:px-10">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-black bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent mb-3">
            Get in Touch
          </h1>
          <p className="text-[#8E8E8E] text-base sm:text-lg max-w-xl">
            Have a question or need support? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left — Contact info + Book a call */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0.8)_100%)] p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-[#8E8E8E] uppercase tracking-wider font-semibold">Email</p>
                  <a
                    href="mailto:support@gameofcreators.com"
                    className="text-sm text-white hover:text-gray-300 transition-colors font-medium"
                  >
                    support@gameofcreators.com
                  </a>
                </div>
              </div>
            </div>

            {/* Book a Call CTA */}
            <div className="rounded-2xl border border-[#A87313]/30 bg-[linear-gradient(135deg,rgba(168,115,19,0.15)_0%,rgba(0,0,0,0.8)_100%)] p-6">
              <h3 className="font-semibold text-amber-500 mb-1">Are you a brand?</h3>
              <p className="text-sm text-[#8E8E8E] mb-5 leading-relaxed">
                Skip the form — book a free 30-min call with founder and we&apos;ll build your campaign plan together.
              </p>
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] text-white font-semibold text-sm hover:brightness-110 transition-all duration-300"
              >
                <Calendar className="h-4 w-4" />
                Book a Free Call
                <ArrowRight className="h-4 w-4" />
              </a>
              <p className="text-xs text-[#8E8E8E] mt-3">Or visit our{" "}
                <Link href="/get-started" className="text-amber-500 hover:text-amber-400 underline underline-offset-4">
                  brand page
                </Link>{" "}for more options.
              </p>
            </div>
          </div>

          {/* Right — Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-white text-sm font-medium">Your Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    name="name"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 h-12 rounded-xl bg-black border border-white/20 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors"
                  />
                </div>
                {errors.name && <p className="text-red-400 mt-1 text-xs">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-white text-sm font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 h-12 rounded-xl bg-black border border-white/20 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors"
                  />
                </div>
                {errors.email && <p className="text-red-400 mt-1 text-xs">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-white text-sm font-medium">Message</label>
                <div className="relative">
                  <textarea
                    name="message"
                    placeholder="How can we help you?"
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-black border border-white/20 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors resize-none"
                  />
                </div>
                {errors.message && <p className="text-red-400 mt-1 text-xs">{errors.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl border border-white/10 bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] font-semibold text-white text-sm hover:brightness-110 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
