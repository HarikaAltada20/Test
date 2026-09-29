export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen relative overflow-hidden bg-black text-white pt-[10px]">
      
      <div className="container mx-auto px-6 py-12 max-w-[1250px] relative z-10">
        <div className="text-white">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-black bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent drop-shadow-2xl mb-4">
              Terms of Service
            </h1>
            <p className="text-[#8E8E8E] mt-4 text-lg font-medium">
            Last Updated: {new Date("2025-08-01").toLocaleDateString("en-GB")}
          </p>
          </div>

          {/* Content */}
          <div className="space-y-8">
            {/* Section 1 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4 ">1. Introduction</h2>
              <p className="text-[#8E8E8E] leading-relaxed text-lg mb-4">
                Welcome to Game Of Creators. These terms and conditions outline the rules and regulations for the use of our website. By 
                accessing our website, you accept these terms and conditions in full. Do not continue to use Game Of Creators if 
                you do not accept all of the terms and conditions stated on this page.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4 ">2. License to Use</h2>
              <p className="text-[#8E8E8E] text-lg leading-relaxed mb-4">
                Unless otherwise stated, Game Of Creators and/or its licensors own the intellectual property rights for all material on Game 
                Of Creators. All intellectual property rights are reserved. You may access this from Game Of Creators for your own 
                personal use subject to restrictions set in these terms and conditions.
              </p>
              <p className="text-[#8E8E8E] text-lg mb-2">You must not:</p>
              <ul className="text-[#8E8E8E] text-lg space-y-1 ml-6">
                <li className="flex items-start">
                  <span className="text-white mr-2">•</span>
                  Republish material from this website
                </li>
                <li className="flex items-start">
                  <span className="text-white mr-2">•</span>
                  Sell, rent or sub-license material from this website
                </li>
                <li className="flex items-start">
                  <span className="text-white mr-2">•</span>
                  Reproduce, duplicate or copy material from this website
                </li>
                <li className="flex items-start">
                  <span className="text-white mr-2">•</span>
                  Redistribute content from Game Of Creators (unless content is specifically made for redistribution)
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">3. User Content</h2>
              <p className="text-[#8E8E8E] text-lg leading-relaxed mb-4">
                In these terms and conditions, "User Content" means material (including without limitation text, images, audio material, video 
                material and audio-visual material) that you submit to this website, for whatever purpose.
              </p>
              <p className="text-[#8E8E8E] text-lg leading-relaxed">
                You grant to Game Of Creators a worldwide, irrevocable, non-exclusive, royalty-free license to use, reproduce, adapt, 
                publish, translate and distribute your User Content in any existing or future media. You also grant to Game Of Creators the 
                right to sub-license these rights, and the right to bring an action for infringement of these rights.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="font-semibold mb-4 text-2xl">4. Limitation of Liability</h2>
              <p className="text-[#8E8E8E] text-lg leading-relaxed">
                In no event shall Game Of Creators, nor any of its officers, directors and employees, be liable to you for anything arising out 
                of or in any way connected with your use of this website, whether such liability is under contract, tort or otherwise, and 
                Game Of Creators, including its officers, directors and employees shall not be liable for any indirect, consequential or special liability arising out of or in any way related to 
                your use of this website.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Indemnification</h2>
              <p className="text-[#8E8E8E] text-lg leading-relaxed">
                You hereby indemnify to the fullest extent Game Of Creators from and against any and all liabilities, costs, demands, causes 
                of action, damages and expenses (including reasonable attorney's fees) arising out of or in any way related to your breach of 
                any of the provisions of these terms.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Variation of Terms</h2>
              <p className="text-[#8E8E8E] text-lg leading-relaxed">
                Game Of Creators is permitted to revise these terms at any time as it sees fit, and by using this website you are expected to 
                review these terms regularly to ensure you understand all terms and conditions governing use of this website.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Entire Agreement</h2>
              <p className="text-[#8E8E8E] text-lg leading-relaxed">
                These terms constitute the entire agreement between Game Of Creators and you in relation to your use of this website, and 
                supersede all prior agreements in respect of your use of this website.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Governing Law & Jurisdiction</h2>
              <p className="text-[#8E8E8E]  text-lg leading-relaxed">
                These terms will be governed by and construed in accordance with the laws of the United States, and any disputes relating 
                to these terms will be subject to the exclusive jurisdiction of the courts of United States.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Contact Us</h2>
              <p className="text-[#8E8E8E] text-lg  leading-relaxed mb-4">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <div className="text-[#8E8E8E] text-lg space-y-2">
                <p>
                  <span>Email:</span> support@gameofcreators.com
                </p>
                <p>
                  <span>Address:</span> 8435 Wilshire Dr, Los Angeles, California 90016, US
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
    );
} 