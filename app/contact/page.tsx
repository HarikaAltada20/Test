"use client";
import { MapPin, Phone, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function ContactPage() {
  const images = [
    "/images/Component 347.png",
    "/images/Property 1=Frame 2147207675.png",
    "/images/Property 1=Frame 2147207676.png",
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);

  // form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
      setFade(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [images.length]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus("✅ Message sent successfully!");
        setFormData({ name: "", email: "", phone: "", message: "" });
      } else {
        setStatus("❌ Failed: " + data.error);
      }
    } catch (err) {
      setStatus("❌ Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-[#050A30] text-white py-16 px-6 border-b border-[#A87313]">
      <div className="max-w-[1200px] mx-auto grid md:grid-cols-2 gap-20 items-start">
        {/* Left Section */}
        <div>
          <div
            className="p-6 rounded-xl space-y-6"
            style={{
              background:
                "linear-gradient(180deg, rgba(127, 57, 236, 0.46) 0%, rgba(0, 8, 37, 0.46) 100%)",
            }}
          >
            <h2 className="text-2xl font-bold">Lets get in touch</h2>
            <p className="text-lg text-gray-200">
              We&apos;re open for any suggestion or just to have a chat
            </p>

            <div className="flex items-start gap-4">
              <MapPin className="text-white mt-1" />
              <p className="text-lg">
                6425 Weidlake Dr, <br />
                Los Angeles, California 90068, US
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Phone className="text-white" />
              <p className="text-lg">+91-9876543210</p>
            </div>

            <div className="flex items-center gap-4">
              <Mail className="text-white" />
              <p className="text-lg">hello@gameofcreators.com</p>
            </div>
          </div>

          {/* Image */}
          <div className="rounded-xl mt-3 overflow-hidden">
            <Image
              src={images[currentIndex]}
              alt="Contact"
              width={500}
              height={300}
              className={`w-full h-full object-cover transition-opacity duration-500 ${
                fade ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>
        </div>

        {/* Right Section */}
        <div>
          <h2 className="text-4xl font-bold mb-3">Get in Touch</h2>
          <p className="text-lg text-gray-300 mb-6">
            We&apos;d love to hear from you! Reach out and our team will get
            back to you soon.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <input
              type="text"
              name="name"
              placeholder="Enter the Name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-4 rounded-md bg-transparent border border-gray-400 text-white focus:outline-none"
            />
            <input
              type="email"
              name="email"
              placeholder="Enter the Email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-4 rounded-md bg-transparent border border-gray-400 text-white focus:outline-none"
            />
            <input
              type="tel"
              name="phone"
              placeholder="Enter the Mobile Number"
              value={formData.phone}
              onChange={handleChange}
              className="w-full p-4 rounded-md bg-transparent border border-gray-400 text-white focus:outline-none"
            />
            <textarea
              name="message"
              placeholder="Enter your Message"
              rows={6}
              value={formData.message}
              onChange={handleChange}
              className="w-full p-4 rounded-md bg-transparent border border-gray-400 text-white focus:outline-none"
            ></textarea>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full bg-gradient-to-r from-[#7F39EC] to-[#B16FF4] font-semibold text-white"
            >
              {loading ? "Sending..." : "Submit"}
            </button>
            {status && <p className="text-sm mt-2">{status}</p>}
          </form>
        </div>
      </div>
    </section>
  );
}
