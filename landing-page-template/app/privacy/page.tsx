import Link from 'next/link'

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>

        <div className="prose prose-gray max-w-none space-y-6">
          <p className="text-gray-600">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Information We Collect</h2>
            <p className="text-gray-600">
              When you submit our contact form, we collect the following information:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mt-2 space-y-1">
              <li>First and last name</li>
              <li>Email address</li>
              <li>Phone number (optional)</li>
              <li>IP address</li>
              <li>Browser information (user agent)</li>
              <li>Referral source and campaign information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">How We Use Your Information</h2>
            <p className="text-gray-600">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mt-2 space-y-1">
              <li>Contact you regarding your inquiry</li>
              <li>Send marketing communications (if you opted in)</li>
              <li>Analyze marketing campaign effectiveness</li>
              <li>Improve our services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">SMS Communications</h2>
            <p className="text-gray-600">
              If you opt in to receive SMS messages:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mt-2 space-y-1">
              <li>Message frequency may vary</li>
              <li>Message and data rates may apply</li>
              <li>Reply STOP to unsubscribe at any time</li>
              <li>Reply HELP for assistance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Data Sharing</h2>
            <p className="text-gray-600">
              We do not sell your personal information. We may share your information with
              service providers who assist us in operating our business, subject to
              confidentiality agreements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Data Retention</h2>
            <p className="text-gray-600">
              We retain your information for as long as necessary to fulfill the purposes
              outlined in this policy, unless a longer retention period is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Your Rights</h2>
            <p className="text-gray-600">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 text-gray-600 mt-2 space-y-1">
              <li>Request access to your personal information</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Opt out of marketing communications</li>
            </ul>
            <p className="text-gray-600 mt-2">
              To exercise these rights, please contact us using the information below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Contact Us</h2>
            <p className="text-gray-600">
              If you have questions about this privacy policy or our data practices,
              please contact us at: [Your Contact Email]
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <Link
            href="/"
            className="text-blue-600 hover:underline"
          >
            &larr; Back to Form
          </Link>
        </div>
      </div>
    </main>
  )
}
