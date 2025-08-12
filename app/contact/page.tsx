"use client";
import { MapPin, Phone, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function ContactPage() {
  const images = [
    "./images/Component 347.png",
    "/images/Property 1=Frame 2147207675.png",
    "./images/Property 1=Frame 2147207676.png",
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
    
     
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setFade(true); // fade in new image

    }, 3000); // change every 3 sec
    return () => clearInterval(interval);
  }, [images.length]);
  return (
    // <div className="min-h-[60vh] flex flex-col items-center justify-center bg-gradient-to-b from-white to-slate-50 py-16 px-4">
    //   <div className="text-center mb-8">
    //     <h1 className="text-4xl font-bold mb-2">Contact Us</h1>
    //     <p className="text-lg text-gray-500">We'd love to hear from you! Reach out and our team will get back to you soon.</p>
    //   </div>
    //   <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-8 flex flex-col md:flex-row gap-10 items-center max-w-2xl w-full">
    //     <div className="flex flex-col items-center gap-8 w-full">
    //       <div className="flex items-center gap-4 w-full justify-center">
    //         <span className="bg-primary/10 p-4 rounded-full">
    //           <Mail className="h-8 w-8 text-primary" />
    //         </span>
    //         <div className="text-left">
    //           <h3 className="font-semibold text-lg">Email Us</h3>
    //           <a href="mailto:hello@gameofcreators.com" className="text-primary underline text-base font-medium">hello@gameofcreators.com</a>
    //           <p className="text-xs text-gray-500 mt-1">We aim to respond within 24 hours</p>
    //         </div>
    //       </div>
    //       <div className="flex items-center gap-4 w-full justify-center">
    //         <span className="bg-primary/10 p-4 rounded-full">
    //           <MapPin className="h-8 w-8 text-primary" />
    //         </span>
    //         <div className="text-left">
    //           <h3 className="font-semibold text-lg">Office Location</h3>
    //           <p className="text-base text-gray-700">
    //             6425 Weidlake Dr,<br />
    //             Los Angeles, California 90068, US
    //           </p>
    //         </div>
    //       </div>
    //     </div>
    //   </div>
    //   <div className="mt-8">
    //     <a href="mailto:hello@gameofcreators.com">
    //       <button className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-rose-600 text-white font-semibold shadow hover:scale-105 transition">
    //         Email Us Now
    //       </button>
    //     </a>
    //   </div>
    // </div>

    <section className="bg-[#050A30] text-white py-16 px-6">
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
            {/* <Image
              src="./images/Component 347.png"
              alt="Contact"
              width={500}
              height={300}
              className="w-full h-full object-cover"
            /> */}

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

          <form className="space-y-6">
            <input
              type="text"
              placeholder="Enter the Name"
              className="w-full p-4 rounded-md bg-transparent border border-gray-400 text-white focus:outline-none"
            />
            <input
              type="email"
              placeholder="Enter the Email"
              className="w-full p-4 rounded-md bg-transparent border border-gray-400 text-white focus:outline-none"
            />
            <input
              type="tel"
              placeholder="Enter the Mobile Number"
              className="w-full p-4 rounded-md bg-transparent border border-gray-400 text-white focus:outline-none"
            />
            <textarea
              placeholder="Enter your Message"
              rows={6}
              className="w-full p-4 rounded-md bg-transparent border border-gray-400 text-white focus:outline-none"
            ></textarea>
            <button
              type="submit"
              className="w-full py-3 rounded-full bg-gradient-to-r from-[#7F39EC] to-[#B16FF4] font-semibold text-white"
            >
              Submit
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
