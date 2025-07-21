export default function TermsOfServicePage() {
    return (
        <div className="container max-w-4xl mx-auto py-12 px-4">
            <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>

            <div className="prose max-w-none">
                <p className="mb-4">Last Updated: {new Date().toLocaleDateString()}</p>

                <h2 className="text-2xl font-bold mt-8 mb-4">1. Introduction</h2>
                <p>
                    Welcome to Game Of Creators. These terms and conditions outline the rules and regulations for the use of our website.
                    By accessing this website, we assume you accept these terms and conditions in full. Do not continue to use
                    Game Of Creators if you do not accept all of the terms and conditions stated on this page.
                </p>

                <h2 className="text-2xl font-bold mt-8 mb-4">2. License to Use</h2>
                <p>
                    Unless otherwise stated, Game Of Creators and/or its licensors own the intellectual property rights for all material on Game Of Creators.
                    All intellectual property rights are reserved. You may view and/or print pages from the website for your own personal use
                    subject to restrictions set in these terms and conditions.
                </p>
                <p className="mt-2">You must not:</p>
                <ul className="list-disc pl-5 my-4">
                    <li>Republish material from this website</li>
                    <li>Sell, rent or sub-license material from this website</li>
                    <li>Reproduce, duplicate or copy material from this website</li>
                    <li>Redistribute content from Game Of Creators (unless content is specifically made for redistribution)</li>
                </ul>

                <h2 className="text-2xl font-bold mt-8 mb-4">3. User Content</h2>
                <p>
                    In these terms and conditions, "User Content" means material (including without limitation text, images, audio
                    material, video material and audio-visual material) that you submit to this website, for whatever purpose.
                </p>
                <p className="mt-2">
                    You grant to Game Of Creators a worldwide, irrevocable, non-exclusive, royalty-free license to use, reproduce, adapt,
                    publish, translate and distribute your User Content in any existing or future media. You also grant to Game Of Creators
                    the right to sub-license these rights, and the right to bring an action for infringement of these rights.
                </p>

                <h2 className="text-2xl font-bold mt-8 mb-4">4. Limitation of Liability</h2>
                <p>
                    In no event shall Game Of Creators, nor any of its officers, directors and employees, be liable to you for anything
                    arising out of or in any way connected with your use of this website, whether such liability is under contract,
                    tort or otherwise, and Game Of Creators shall not be liable for any indirect, consequential or special liability
                    arising out of or in any way related to your use of this website.
                </p>

                <h2 className="text-2xl font-bold mt-8 mb-4">5. Indemnification</h2>
                <p>
                    You hereby indemnify to the fullest extent Game Of Creators from and against any and all liabilities, costs, demands,
                    causes of action, damages and expenses (including reasonable attorney's fees) arising out of or in any way
                    related to your breach of any of the provisions of these terms.
                </p>

                <h2 className="text-2xl font-bold mt-8 mb-4">6. Variation of Terms</h2>
                <p>
                    Game Of Creators is permitted to revise these terms at any time as it sees fit, and by using this website you are
                    expected to review these terms regularly to ensure you understand all terms and conditions governing use of this website.
                </p>

                <h2 className="text-2xl font-bold mt-8 mb-4">7. Entire Agreement</h2>
                <p>
                    These terms constitute the entire agreement between Game Of Creators and you in relation to your use of this website,
                    and supersede all previous agreements in respect of your use of this website.
                </p>

                <h2 className="text-2xl font-bold mt-8 mb-4">8. Governing Law & Jurisdiction</h2>
                <p>
                    These terms will be governed by and construed in accordance with the laws of the United States, and any
                    disputes relating to these terms will be subject to the exclusive jurisdiction of the courts of the United States.
                </p>

                <h2 className="text-2xl font-bold mt-8 mb-4">9. Contact Us</h2>
                <p>
                    If you have any questions about these Terms of Service, please contact us at:
                </p>
                <p className="mt-2">
                    Email: support@gameofcreators.com<br />
                    Address: 6425 Weidlake Dr,
                    Los Angeles, California 90068, US
                </p>
            </div>
        </div>
    );
} 