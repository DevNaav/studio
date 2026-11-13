'use client';

import { LegalDocument } from '@/components/landing/legal-document';

const defaultContent = `<h2>Introduction</h2>
<p>This Privacy Policy explains how Inventra ("we," "us," or "our") collects, uses, stores, and protects information when you access or use our construction and operations management platform ("Service"). By using the Service, you agree to the collection and use of information in accordance with this policy.</p>

<h2>Information We Collect</h2>
<p>We may collect several types of information, including:</p>
<ul>
    <li><strong>Personal Information:</strong> Name, email address, phone number, and payment information when you register or subscribe.</li>
    <li><strong>Company Information:</strong> Company name, user roles, and project details.</li>
    <li><strong>Usage Data:</strong> Information on how the Service is accessed and used, such as IP address, browser type, and pages visited.</li>
    <li><strong>Project Data:</strong> All data you upload or create within the platform, including but not limited to inventory logs, expense records, labor details, and documents.</li>
</ul>

<h2>How We Use Your Information</h2>
<p>We use the collected data for various purposes:</p>
<ul>
    <li>To provide and maintain our Service.</li>
    <li>To manage your account and subscription.</li>
    <li>To notify you about changes to our Service.</li>
    <li>To provide customer support and respond to your inquiries.</li>
    <li>To gather analysis or valuable information so that we can improve our Service.</li>
    <li>To monitor the usage of our Service and prevent fraudulent activity.</li>
    <li>For AI-powered features, such as data analysis and threat modeling. Project data sent to AI models is not used for training third-party models and is governed by the privacy policies of our AI service providers.</li>
</ul>

<h2>Data Storage and Security</h2>
<p>Your data is stored securely on Firebase (Google Cloud) servers. We implement a variety of security measures to maintain the safety of your personal and project information. However, no method of transmission over the Internet or method of electronic storage is 100% secure.</p>

<h2>Data Sharing and Disclosure</h2>
<p>We do not sell, trade, or otherwise transfer your personally identifiable information to outside parties. This does not include trusted third parties who assist us in operating our Service, so long as those parties agree to keep this information confidential. We may also release your information when we believe release is appropriate to comply with the law, enforce our site policies, or protect ours or others' rights, property, or safety.</p>

<h2>Your Data Rights</h2>
<p>You have the right to access, update, or delete your personal information at any time through your account settings or by contacting us directly. As a company administrator, you are responsible for managing the data of your users and projects.</p>

<h2>Changes to This Privacy Policy</h2>
<p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.</p>

<h2>Contact Us</h2>
<p>If you have any questions about this Privacy Policy, please contact us via our contact page.</p>
`;

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      description="How Inventra collects, uses and protects your information and your company’s project data."
      field="privacyPolicyContent"
      defaultHtml={defaultContent}
      lastUpdated="2024-05-23"
      href="/privacy"
    />
  );
}
