"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Send,
  CheckCircle2,
  ArrowRight,
  Clock,
  Users,
  Zap,
  Crown,
  Rocket,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CALENDLY_URL = "https://calendly.com/guptavishesh2/30min";
const FREE_TRIAL_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSf7C6hOBIr90e8pBDt9mMo4AzJaFM0Dlbud-EleVIPtuCC68A/viewform";

export default function GetStartedClient() {
  const { toast } = useToast();

  // --- Quick Message Form ---
  const [msgForm, setMsgForm] = useState({ name: "", email: "", message: "" });
  const [msgErrors, setMsgErrors] = useState<Record<string, string>>({});
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgSubmitted, setMsgSubmitted] = useState(false);

  const handleMsgChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setMsgForm({ ...msgForm, [e.target.name]: e.target.value });
    setMsgErrors({ ...msgErrors, [e.target.name]: "" });
  };

  const validateMsg = () => {
    const errs: Record<string, string> = {};
    if (!msgForm.name.trim()) errs.name = "Required";
    if (!msgForm.email.trim()) errs.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msgForm.email))
      errs.email = "Invalid email";
    if (!msgForm.message.trim()) errs.message = "Required";
    setMsgErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleMsgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateMsg()) return;
    setMsgLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msgForm),
      });
      if (res.ok) {
        setMsgSubmitted(true);
        toast({ title: "Message sent!", description: "We'll get back to you within 24 hours." });
        setMsgForm({ name: "", email: "", message: "" });
      } else {
        toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setMsgLoading(false);
    }
  };

  const inputCls = (err?: string) =>
    cn(
      "w-full px-4 py-3 rounded-xl bg-white/5 border text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors",
      err ? "border-red-500/60" : "border-white/10"
    );

  return (
    <div className="min-h-screen bg-[#000825] text-white">

      {/* ── Page Header ── */}
      <div className="pt-20 pb-10 text-center px-6">
        <div className="inline-flex items-center gap-2.5 rounded-full px-1 py-1 pr-4 mb-6 border border-amber-500/30 bg-amber-500/5">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shrink-0 shadow-[0_0_10px_rgba(251,191,36,0.4)]">
            <Crown className="h-3 w-3 text-white" />
          </span>
          <span className="text-sm font-semibold text-amber-300 tracking-wide">For Brands</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 leading-tight">
          Let&apos;s make your brand
          <br />
          <span style={{
            background: "linear-gradient(180deg, #7F39EC 26.04%, #AD6BF3 81.25%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            go viral
          </span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">
          Start a free trial or just reach out — we&apos;ll figure out the best way to help you.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 sm:px-10 pb-24 space-y-8">

        {/* ══════════════════════════════════════
            SECTION 1 — FREE TRIAL
        ══════════════════════════════════════ */}
        <div className="rounded-2xl border border-amber-500/25 overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(180,83,9,0.12) 0%, rgba(0,8,37,0.6) 60%)" }}>
          <div className="p-8 sm:p-10">

            {/* Top row — label + badge */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                  <Rocket className="h-4 w-4 text-amber-400" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Free Trial</span>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300">
                30 days · No payment needed
              </span>
            </div>

            {/* Headline + guarantee */}
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 leading-snug">
              Launch your first campaign — <span className="text-amber-400">free</span>
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mb-8 max-w-xl">
              We personally review each brand and only work with those we&apos;re confident we can help.{" "}
              <span className="text-white font-semibold">No results? You don&apos;t pay anything.</span>
            </p>

            {/* Steps + CTA side by side on desktop */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-8">
              <div className="flex-1 space-y-4">
                {[
                  { num: "1", text: "Tell us about your brand and what you sell" },
                  { num: "2", text: "Share the results you're looking to achieve" },
                  { num: "3", text: "We'll review and reach out within 48 hrs if we're a fit" },
                ].map(({ num, text }) => (
                  <div key={num} className="flex items-center gap-4">
                    <span className="shrink-0 h-7 w-7 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center justify-center">
                      {num}
                    </span>
                    <span className="text-sm sm:text-base text-slate-300">{text}</span>
                  </div>
                ))}
              </div>

              <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2 min-w-[180px]">
                <a
                  href={FREE_TRIAL_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base hover:from-amber-400 hover:to-orange-400 transition-all duration-300 shadow-[0_0_24px_rgba(245,158,11,0.25)]"
                >
                  <Rocket className="h-4 w-4" />
                  Apply Now
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </a>
                <p className="text-center text-xs text-slate-600">Takes 2 minutes · Google Form</p>
              </div>
            </div>

          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-slate-600 text-sm font-medium px-2">or just reach out</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        {/* ══════════════════════════════════════
            SECTION 2 — TALK TO US
        ══════════════════════════════════════ */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Book a Call */}
          <div className="rounded-2xl border border-[#FFFFFF15] bg-gradient-to-b from-[#FFFFFF08] to-transparent p-7 flex flex-col">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-purple-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Book a Call</h2>
            </div>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Talk directly with our team — we&apos;ll understand your goals and
              put together a plan on the spot.
            </p>
            <ul className="space-y-2.5 mb-8 text-sm text-slate-300">
              {[
                { icon: Clock, text: "30-minute focused session" },
                { icon: Users, text: "Talk directly with our team" },
                { icon: Zap, text: "Get a custom campaign plan" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-purple-400 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
            <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer"
              className="mt-auto w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#4C238B] to-[#7F39EC] text-white font-semibold text-sm hover:from-[#5a2ba3] hover:to-[#8f45f5] transition-all duration-300 shadow-lg shadow-purple-900/30">
              <Calendar className="h-4 w-4" />
              Schedule a Free Call
              <ArrowRight className="h-4 w-4" />
            </a>
            <p className="text-center text-xs text-slate-600 mt-2.5">Opens Calendly — pick a time that suits you</p>
          </div>

          {/* Send a Message */}
          <div className="rounded-2xl border border-[#FFFFFF15] bg-gradient-to-b from-[#FFFFFF08] to-transparent p-7 flex flex-col">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Send a Message</h2>
            </div>

            {msgSubmitted ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center gap-3">
                <CheckCircle2 className="h-12 w-12 text-green-400" />
                <h3 className="text-lg font-bold">Got it!</h3>
                <p className="text-slate-400 text-sm">We&apos;ll reply within 24 hours.</p>
                <button onClick={() => setMsgSubmitted(false)}
                  className="mt-2 text-sm text-purple-400 hover:text-purple-300 underline underline-offset-4">
                  Send another
                </button>
              </div>
            ) : (
              <form onSubmit={handleMsgSubmit} className="flex flex-col gap-3 flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input type="text" name="name" placeholder="Your name" value={msgForm.name}
                      onChange={handleMsgChange} className={inputCls(msgErrors.name)} />
                    {msgErrors.name && <p className="text-red-400 text-xs mt-1">{msgErrors.name}</p>}
                  </div>
                  <div>
                    <input type="email" name="email" placeholder="Email" value={msgForm.email}
                      onChange={handleMsgChange} className={inputCls(msgErrors.email)} />
                    {msgErrors.email && <p className="text-red-400 text-xs mt-1">{msgErrors.email}</p>}
                  </div>
                </div>
                <div className="flex-1">
                  <textarea name="message" placeholder="How can we help?" rows={6}
                    value={msgForm.message} onChange={handleMsgChange}
                    className={cn(inputCls(msgErrors.message), "resize-none h-full min-h-[120px]")} />
                  {msgErrors.message && <p className="text-red-400 text-xs mt-1">{msgErrors.message}</p>}
                </div>
                <button type="submit" disabled={msgLoading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-500 text-white font-semibold text-sm hover:from-blue-600 hover:to-blue-400 transition-all duration-300 disabled:opacity-60 shadow-lg shadow-blue-900/20">
                  {msgLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Message
                    </>
                  )}
                </button>
                <p className="text-center text-xs text-slate-600">We respond within 24 hours</p>
              </form>
            )}
          </div>
        </div>

        {/* Bottom — self-serve */}
        <div className="text-center pt-2">
          <p className="text-slate-600 text-sm mb-2">Already know what you want?</p>
          <Link href="/auth/signup?role=brand"
            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium text-sm transition-colors">
            Create your brand account
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

      </div>
    </div>
  );
}
