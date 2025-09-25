"use client";
import { useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { FaChevronDown } from "react-icons/fa";
import Link from "next/link";

const igFaqs = [
  {
    question: "Why do I need an Instagram Creator or Business account?",
    answer: [
      "Instagram requires a Creator or Business account to allow third-party applications like Game Of Creators to access your content (Reels/Videos) and their performance insights. This is necessary for us to verify your content for campaign submissions.",
      "Personal Instagram accounts do not provide the API access needed for these features.",
    ],
    links: [
      {
        label: "Set up a business account on Instagram",
        url: "https://help.instagram.com/502981923235522",
      },
    ],
  },
  {
    question: "What content can Game Of Creators access?",
    answer: [
      "To ensure we can fetch your content for campaign submissions, it&apos;s important that you create new <strong>Reels or Videos <em>after</em> you have switched your account to a Creator Or Business type and connected it to Game Of Creators</strong>.",
      "This allows Instagram to properly track and make the content available via the API with the necessary permissions. You will be able to select from these fetched Reels/Videos in our platform, or you can provide a direct URL to your content for submission.",
    ],
  },
  {
    question: "What permissions does Game Of Creators request for Instagram?",
    answer: [
      "When you connect your Instagram account, Game Of Creators requests permissions to:",
    ],
    list: [
      "Access your profile information (like username, account type) to verify your account.",
      " Retrieve your media (Reels, Videos) and their basic data so you can select them for campaigns.",
    ],
    note: "We only request the permissions necessary for you to participate in campaigns. We do not post content on your behalf or access your direct messages.",
  },
  {
    question: "What if I&apos;m having trouble connecting?",
    answer: ["If you encounter issues, please double-check the following:"],
    list: [
      "Your Instagram account is a <strong>Creator or Business</strong> account.",
      "You are logged into the correct Instagram account in your browser when attempting the connection.",
      "Try clearing your browser cache or using an incognito/private browsing window.",
    ],
    note: "<p>If problems persist, please ensure you have granted all requested permissions during the Instagram authorization step. You might need to disconnect and attempt to reconnect, ensuring all permissions are accepted.</p><p>You can usually manage app permissions within your Instagram app settings under &quot;Apps and Websites&quot; or similar sections.</p><p>If you are still unable to connect, please contact our support team with details of the issue and any error messages you see.</p>",
  },
];

export default function InstagramConnectionFAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const faqTriggerRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="bg-[#000825] min-h-screen border-b border-[#A87313] flex items-center pt-12">
      <section className="px-4 text-white w-full">
        <div className="max-w-5xl mx-auto text-center">
          {/* Title */}
          <h2
            className="text-3xl md:text-5xl font-bold flex flex-wrap justify-center gap-4 slide-up"
            style={{ animationDelay: "0.2s" }}
          >
            <span
              className="text-white"
            //   style={{
            //     backgroundImage:
            //       "linear-gradient(180deg, #7F39EC 36.41%, #B16FF4 99.95%)",
            //   }}
            >
              Instagram
            </span>
            <span className="text-white">Connection</span>
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
              }}
            >
              FAQ
            </span>
          </h2>

          {/* Subtitle */}
          <p
            className="mt-6 mb-10 text-gray-300 md:text-2xl slide-left"
            style={{ animationDelay: "1s" }}
          >
            Answers to common questions about connecting your Instagram account.
          </p>

          {/* FAQ List */}
          <div className="mt-10 space-y-7">
            {igFaqs.map((faq, index) => (
              <div
                key={index}
                className="border border-gray-700 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full flex justify-between items-center px-6 py-6 bg-gradient-to-r from-transparent via-transparent to-[#7F39EC50] hover:bg-[#1A1B35] transition-colors"
                >
                  <span
                    className="text-left text-xl"
                    dangerouslySetInnerHTML={{ __html: faq.question }}
                  />
                  <FaChevronDown
                    className={`transition-transform ${
                      openIndex === index ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Expanded Content */}
                {openIndex === index && (
                  <div className="text-left text-md md:text-lg pt-4 px-6 pb-6 text-gray-400 leading-relaxed space-y-4">
                    {/* Paragraphs */}
                    {faq.answer &&
                      faq.answer.map((para, i) => (
                        <p
                          key={i}
                          className="mb-2"
                          dangerouslySetInnerHTML={{ __html: para }}
                        />
                      ))}

                    {/* Bullet List */}
                    {faq.list && (
                      <ul className="list-disc list-inside space-y-1">
                        {faq.list.map((item, i) => (
                          <li
                            key={i}
                            dangerouslySetInnerHTML={{ __html: item }}
                          />
                        ))}
                      </ul>
                    )}

                    {/* Links */}
                    {faq.links && (
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        {faq.links.map((link, i) => (
                          <li key={i}>
                            <Link
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              {link.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Note */}
                    {faq.note && (
                      <p
                        className="text-md text-gray-300"
                        dangerouslySetInnerHTML={{ __html: faq.note }}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="text-center py-10 ">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 justify-center rounded-3xl mt-8 relative text-white font-bold px-8 py-3 text-lg overflow-hidden"
            style={{
              background:
                "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
            }}
          >
            Back to Settings
          </Link>
        </div>
      </section>
    </div>
  );
}

// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { ExternalLink } from "lucide-react";
// import Link from "next/link";

// export default function InstagramConnectionFAQPage() {
//     return (
//         <div className="container mx-auto max-w-3xl py-8 px-4 sm:px-6 lg:px-8">
//             <header className="mb-8 text-center">
//                 <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
//                     Instagram Connection FAQ
//                 </h1>
//                 <p className="mt-4 text-xl text-gray-600">
//                     Answers to common questions about connecting your Instagram account to Game Of Creators.
//                 </p>
//             </header>

//             <div className="space-y-6">
//                 <Card>
//                     <CardHeader>
//                         <CardTitle className="text-2xl">Why do I need an Instagram Creator or Business account?</CardTitle>
//                     </CardHeader>
//                     <CardContent className="space-y-4 text-gray-700">
//                         <p>
//                             Instagram requires a <strong>Creator or Business account</strong> to allow third-party applications like Game Of Creators to access your content (Reels/Videos) and their performance insights. This is necessary for us to verify your content for campaign submissions.
//                         </p>
//                         <p>
//                             Personal Instagram accounts do not provide the API access needed for these features.
//                         </p>
//                         <p>
//                             You can learn how to switch your personal account to a Creator or Business account on Instagram&apos;s help pages:
//                             <ul className="list-disc list-inside mt-2 space-y-1">
//                                 <li>
//                                     <Link href="https://help.instagram.com/502981923235522" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
//                                         Set up a business account on Instagram <ExternalLink className="inline h-4 w-4 ml-1" />
//                                     </Link>
//                                 </li>
//                             </ul>
//                         </p>
//                     </CardContent>
//                 </Card>

//                 <Card>
//                     <CardHeader>
//                         <CardTitle className="text-2xl">What content can Game Of Creators access?</CardTitle>
//                     </CardHeader>
//                     <CardContent className="space-y-4 text-gray-700">
//                         <p>
//                             To ensure we can fetch your content for campaign submissions, it&apos;s important that you create new <strong>Reels or Videos <em>after</em> you have switched your account to a Creator Or Business type and connected it to Game Of Creators</strong>.
//                         </p>
//                         <p>
//                             This allows Instagram to properly track and make the content available via the API with the necessary permissions. You will be able to select from these fetched Reels/Videos in our platform, or you can provide a direct URL to your content for submission.
//                         </p>
//                     </CardContent>
//                 </Card>

//                 <Card>
//                     <CardHeader>
//                         <CardTitle className="text-2xl">What permissions does Game Of Creators request for Instagram?</CardTitle>
//                     </CardHeader>
//                     <CardContent className="space-y-4 text-gray-700">
//                         <p>
//                             When you connect your Instagram account, Game Of Creators requests permissions to:
//                         </p>
//                         <ul className="list-disc list-inside mt-2 space-y-1 bg-gray-50 p-4 rounded-md">
//                             <li>
//                                 Access your profile information (like username, account type) to verify your account.
//                             </li>
//                             <li>
//                                 Retrieve your media (Reels, Videos) and their basic data so you can select them for campaigns.
//                             </li>
//                         </ul>
//                         <p>
//                             We only request the permissions necessary for you to participate in campaigns. We do not post content on your behalf or access your direct messages.
//                         </p>
//                     </CardContent>
//                 </Card>

//                 <Card>
//                     <CardHeader>
//                         <CardTitle className="text-2xl">What if I&apos;m having trouble connecting?</CardTitle>
//                     </CardHeader>
//                     <CardContent className="space-y-4 text-gray-700">
//                         <p>
//                             If you encounter issues, please double-check the following:
//                         </p>
//                         <ul className="list-disc list-inside mt-2 space-y-1">
//                             <li>Your Instagram account is a <strong>Creator or Business</strong> account.</li>
//                             <li>You are logged into the correct Instagram account in your browser when attempting the connection.</li>
//                             <li>Try clearing your browser cache or using an incognito/private browsing window.</li>
//                         </ul>
//                         <p>
//                             If problems persist, please ensure you have granted all requested permissions during the Instagram authorization step. You might need to disconnect and attempt to reconnect, ensuring all permissions are accepted.
//                         </p>
//                         <p>
//                             You can usually manage app permissions within your Instagram app settings under &quot;Apps and Websites&quot; or similar sections.
//                         </p>
//                         <p>
//                             If you are still unable to connect, please contact our support team with details of the issue and any error messages you see.
//                         </p>
//                     </CardContent>
//                 </Card>

//                 <div className="text-center mt-10">
//                     <Link href="/dashboard/settings" className="text-primary hover:underline">
//                         &larr; Back to Settings
//                     </Link>
//                 </div>

//             </div>
//         </div>
//     );
// }
