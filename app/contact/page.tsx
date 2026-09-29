"use client";
import { Mail, Calendar, ArrowRight } from "lucide-react";
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
    <section className="bg-[#050A30] text-white py-12 px-6 sm:py-20 sm:px-10 border-b border-[#A87313]">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
            Get in Touch
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-xl">
            Have a question or need support? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left — Contact info + Book a call */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Email</p>
                  <a
                    href="mailto:support@gameofcreators.com"
                    className="text-sm text-white hover:text-purple-400 transition-colors"
                  >
                    support@gameofcreators.com
                  </a>
                </div>
              </div>
            </div>

            {/* Book a Call CTA */}
            <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-900/20 to-transparent p-6">
              <h3 className="font-semibold text-white mb-1">Are you a brand?</h3>
              <p className="text-sm text-slate-400 mb-5">
                Skip the form — book a free 30-min call with founder and we&apos;ll build your campaign plan together.
              </p>
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#4C238B] to-[#7F39EC] text-white font-semibold text-sm hover:from-[#5a2ba3] hover:to-[#8f45f5] transition-all duration-300"
              >
                <Calendar className="h-4 w-4" />
                Book a Free Call
                <ArrowRight className="h-4 w-4" />
              </a>
              <p className="text-xs text-slate-600 mt-3">Or visit our{" "}
                <Link href="/get-started" className="text-purple-400 hover:text-purple-300 underline underline-offset-4">
                  brand page
                </Link>{" "}for more options.
              </p>
            </div>
          </div>

          {/* Right — Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  name="name"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors"
                />
                {errors.name && <p className="text-red-400 mt-1 text-xs">{errors.name}</p>}
              </div>

              <div>
                <input
                  type="email"
                  name="email"
                  placeholder="Your email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors"
                />
                {errors.email && <p className="text-red-400 mt-1 text-xs">{errors.email}</p>}
              </div>

              <div>
                <textarea
                  name="message"
                  placeholder="How can we help you?"
                  rows={5}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors resize-none"
                />
                {errors.message && <p className="text-red-400 mt-1 text-xs">{errors.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7F39EC] to-[#B16FF4] font-semibold text-white text-sm hover:from-[#8f45f5] hover:to-[#c07ff5] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
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
