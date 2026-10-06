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
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl md:text-[52px] font-black bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent mb-3 pb-1 pt-2 leading-tight">
            Get in Touch
          </h1>
          <p className="text-[#8E8E8E] text-base sm:text-lg max-w-xl mx-auto">
            Have a question or need support? We&apos;d love to hear from you.
          </p>
        </div>

       



         <section className="py-16 px-4 sm:px-8 lg:px-24 bg-black flex justify-center items-center">
                <div className="relative w-full max-w-[1200px] min-h-[471px] py-16 px-6 sm:px-12 flex flex-col justify-center items-center overflow-hidden rounded-[28px] border border-[#3A3636] bg-[linear-gradient(360deg,#000000_0%,#353535_100%)] shadow-[inset_0px_0px_4px_rgba(255,255,255,0.25)]">
                  {/* Background Decorative Shapes */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {/* <div className="w-[990px] h-[441px] absolute left-[27px] top-[335px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                    <div className="w-[990px] h-[441px] absolute left-[267px] top-[-202px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" /> */}
                    {/* <div className="w-[990px] h-[441px] absolute left-[27px] top-[354px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                    <div className="w-[990px] h-[441px] absolute left-[267px] top-[-183px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                    <div className="w-[990px] h-[441px] absolute left-[27px] top-[308px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                    <div className="w-[990px] h-[441px] absolute left-[267px] top-[-230px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                    <div className="w-[990px] h-[441px] absolute left-[27px] top-[288px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                    <div className="w-[990px] h-[441px] absolute left-[267px] top-[-250px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" /> */}
                  </div>
        
                  {/* Main Content Box */}
                  <div className="relative z-10 max-w-[654px] mx-auto flex flex-col items-center text-center gap-9">
                    <div className="flex flex-col items-center gap-4">
                      <h2 className="text-[28px] sm:text-[36px] md:text-[40px] font-medium text-white leading-[130%] tracking-tight">
                        Want to promote your brand?
                        <br/>
                        Book a Call
                      </h2>
                      <p className="text-[15px] sm:text-[17px] font-medium text-[#8E8E8E] leading-[150%]">
                        Book a demo with{" "}
                        <span className="text-[#F1F1F1] font-semibold">Vishesh</span>
                        , Founder of Game Of Creators. Join hundreds of successful businesses. Get answers and start launching impactful campaigns with a free consultation.
                      </p>
                    </div>
        
                    <a
                      href="https://calendly.com/guptavishesh2/30min"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2.5 px-9 py-3 bg-[#DEDEDE] text-[#353535] hover:bg-white rounded-[14px] font-semibold text-base leading-[20px] transition-all duration-200 cursor-pointer shadow-md group"
                    >
                      <span>Book Call Now</span>
                      <ArrowRight className="w-4 h-4 text-[#353535] transition-transform group-hover:translate-x-0.5" />
                    </a>
                  </div>
                </div>
              </section>
      </div>
    </section>
  );
}
