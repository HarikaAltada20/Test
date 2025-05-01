export default function PrivacyPolicyPage() {
    return (
        <div className="container max-w-4xl mx-auto py-12 px-4">
            <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

            <div className="prose max-w-none">
                <p className="mb-4">Last Updated: {new Date().toLocaleDateString()}</p>

                <h2 className="text-2xl font-bold mt-8 mb-4">1. Introduction</h2>
                <p>
                    Welcome to Game Of Creators. We respect your privacy and are committed to protecting your personal data.
                    This privacy policy will inform you about how we look after your personal data when you visit our website
                    and tell you about your privacy rights and how the law protects you.
                </p>

                <h2 className="text-2xl font-bold mt-8 mb-4">2. The Data We Collect About You</h2>
                <p>
                    Personal data, or personal information, means any information about an individual from which that person
                    can be identified. We may collect, use, store and transfer different kinds of personal data about you which
                    we have grouped together as follows:
                </p>
                <ul className="list-disc pl-5 my-4">
                    <li>Identity Data includes first name, last name, username or similar identifier.</li>
                    <li>Contact Data includes email address and telephone numbers.</li>
                    <li>Technical Data includes internet protocol (IP) address, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform.</li>
                    <li>Usage Data includes information about how you use our website, products and services.</li>
                </ul>

                <h2 className="text-2xl font-bold mt-8 mb-4">3. How We Use Your Personal Data</h2>
                <p>
                    We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
                </p>
                <ul className="list-disc pl-5 my-4">
                    <li>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
                    <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
                    <li>Where we need to comply with a legal obligation.</li>
                </ul>

                <h2 className="text-2xl font-bold mt-8 mb-4">4. Data Security</h2>
                <p>
                    We have put in place appropriate security measures to prevent your personal data from being accidentally lost,
                    used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal data
                    to those employees, agents, contractors and other third parties who have a business need to know.
                </p>

                <h2 className="text-2xl font-bold mt-8 mb-4">5. Your Legal Rights</h2>
                <p>
                    Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to:
                </p>
                <ul className="list-disc pl-5 my-4">
                    <li>Request access to your personal data</li>
                    <li>Request correction of your personal data</li>
                    <li>Request erasure of your personal data</li>
                    <li>Object to processing of your personal data</li>
                    <li>Request restriction of processing your personal data</li>
                    <li>Request transfer of your personal data</li>
                    <li>Right to withdraw consent</li>
                </ul>

                <h2 className="text-2xl font-bold mt-8 mb-4">6. Contact Us</h2>
                <p>
                    If you have any questions about this privacy policy or our privacy practices, please contact us at:
                </p>
                <p className="mt-2">
                    Email: privacy@gameofcreators.com.com<br />
                    Address: 123 Innovation Way, San Francisco, CA 94105
                </p>
            </div>
        </div>
    );
} 