"use client";

import { Mail, MapPin } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center bg-gradient-to-b from-white to-slate-50 py-16 px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Contact Us</h1>
        <p className="text-lg text-gray-500">We'd love to hear from you! Reach out and our team will get back to you soon.</p>
      </div>
      <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 flex flex-col md:flex-row gap-10 items-center max-w-2xl w-full">
        <div className="flex flex-col items-center gap-8 w-full">
          <div className="flex items-center gap-4 w-full justify-center">
            <span className="bg-primary/10 p-4 rounded-full">
              <Mail className="h-8 w-8 text-primary" />
            </span>
            <div className="text-left">
              <h3 className="font-semibold text-lg">Email Us</h3>
              <a href="mailto:hello@gameofcreators.com" className="text-primary underline text-base font-medium">hello@gameofcreators.com</a>
              <p className="text-xs text-gray-500 mt-1">We aim to respond within 24 hours</p>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full justify-center">
            <span className="bg-primary/10 p-4 rounded-full">
              <MapPin className="h-8 w-8 text-primary" />
            </span>
            <div className="text-left">
              <h3 className="font-semibold text-lg">Office Location</h3>
              <p className="text-base text-gray-700">
                6425 Weidlake Dr,<br />
                Los Angeles, California 90068, US
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8">
        <a href="mailto:hello@gameofcreators.com">
          <button className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-rose-600 text-white font-semibold shadow hover:scale-105 transition">
            Email Us Now
          </button>
        </a>
      </div>
    </div>
  );
}

