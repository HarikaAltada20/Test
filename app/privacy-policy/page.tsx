export default function PrivacyPolicyPage() {
  return (
    <div
      className="min-h-screen text-white border-b border-[#A87313]"
      style={{ backgroundColor: "#000825" }}
    >
      
      <div className="container mx-auto px-2 py-12 max-w-[1250px]">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold whitespace-nowrap slide-up" 
          style={{ animationDelay: "1s" }}>
            <span
            
              style={{
                background:
                  "linear-gradient(180deg, #7F39EC 26.04%, #AD6BF3 81.25%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
               
                display: "inline",
              }}
            >
              Privacy&nbsp;
            </span>
            <span className="text-white">Policy</span>
          </h1>

          <p className="text-slate-300 mt-4 text-lg">
            Last Updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-9 text-slate-100 leading-relaxed">
          {/* Section 1 */}
          <section className="relative">
            {/* Purple circle touching right edge */}
            <div
              className="absolute top-10 right-0 w-44 h-44 rounded-full opacity-20 blur-3xl -z-10"
              style={{ backgroundColor: "#7F39EC" }}
            ></div>

            <h2 className="text-2xl font-semibold mb-4 text-white">
              1. Introduction
            </h2>
            <p className="mb-4 text-lg">
              We care about your privacy and we respect your privacy and are
              committed to protecting your personal data. This privacy policy
              will inform you about how we use and protect any personal data
              when you interact with our services and our rights and how the law
              protects you.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">
              2. The Data We Collect About You
            </h2>
            <p className="text-lg mb-4">
              Personal data, or personal information, means any information
              about an individual from which that person can be identified. We
              may collect, use, store and transfer different kinds of personal
              data about you which we have grouped together as follows:
            </p>
            <ul className="list-disc text-lg pl-6 space-y-4">
              <li>
                Identity Data includes first name, last name, username or
                similar identifier.
              </li>
              <li>
                Contact Data includes email address, telephone numbers and
                billing addresses.
              </li>
              <li>
                Technical Data includes internet protocol (IP) address, browser
                type and version, time zone setting and location, browser
                plug-in types and versions, operating system and platform, and
                other technology on the devices you use to access this website.
              </li>
              <li>
                Usage Data includes information about how you use our website,
                products and services.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">
              3. How We Use Your Personal Data
            </h2>
            <p className="mb-4 text-lg">
              We will only use your personal data when the law allows us to.
              Most commonly, we will use your personal data in the following
              circumstances:
            </p>
            <ul className="list-disc pl-6 text-lg space-y-3">
              <li>
                Where we need to perform the contract we are about to enter into
                or have entered into with you.
              </li>
              <li>
                Where it is necessary for our legitimate interests (or those of
                a third party) and your interests and fundamental rights do not
                override those interests.
              </li>
              <li>Where we need to comply with a legal obligation.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">
              4. Data Security
            </h2>
            <p className="mb-4 text-lg">
              We have put in place appropriate security measures to prevent your
              personal data from being accidentally lost, used or accessed in an
              unauthorised way, altered or disclosed. In addition, we limit
              access to your personal data to those employees, agents,
              contractors and other third parties who have a business need to
              know.
            </p>
          </section>

          {/* Section 5 */}

          <section className="relative">
            {/* Purple circle background at left */}

            <h2 className="text-2xl font-semibold mb-4 text-white">
              5. Your Legal Rights
            </h2>
            <p className="mb-4 text-lg">
              Under certain circumstances, you have rights under data protection
              laws in relation to your personal data, including the right to:
            </p>
            <ul className="list-disc pl-6 text-lg space-y-3">
              <li>Request access to your personal data</li>
              <li>Request correction of your personal data</li>
              <li>Request erasure of your personal data</li>
              <li>Object to processing of your personal data</li>
              <li>Request restriction of processing your personal data</li>
              <li>Request transfer of your personal data</li>
              <li>Right to withdraw consent</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-white">
              6. Contact Us
            </h2>
            <p className="mb-4 text-lg">
              If you have any questions about this privacy policy or our privacy
              practices, please contact us at:
            </p>
            <div className="pl-4 text-lg">
              <p>Email: support@examplecreators.com</p>
              <p>
                Address: 4647 Wildomar Dr, Los Angeles, California 90068, US
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
