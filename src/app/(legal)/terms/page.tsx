'use client';

import { LegalDocument } from '@/components/landing/legal-document';

const defaultContent = `<h2>Introduction</h2>
<p>These Terms of Service ("Terms") govern your use of the Inventra construction and operations management platform ("Service"), operated by Inventra ("us", "we", or "our"). Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, and others who access or use the Service.</p>

<h2>1. Accounts</h2>
<p>When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service. You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password.</p>

<h2>2. Intellectual Property</h2>
<p>The Service and its original content (excluding Content provided by users), features, and functionality are and will remain the exclusive property of Inventra and its licensors. The Service is protected by copyright, trademark, and other laws of both the India and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Inventra.</p>

<h2>3. User Content</h2>
<p>Our Service allows you to post, link, store, share, and otherwise make available certain information, text, graphics, videos, or other material ("Content"). You are responsible for the Content that you post to the Service, including its legality, reliability, and appropriateness. By posting Content to the Service, you grant us the right and license to use, modify, publicly perform, publicly display, reproduce, and distribute such Content on and through the Service for the purpose of operating and providing the Service.</p>

<h2>4. Prohibited Uses</h2>
<p>You agree not to use the Service:</p>
<ul>
    <li>In any way that violates any applicable national or international law or regulation.</li>
    <li>For the purpose of exploiting, harming, or attempting to exploit or harm minors in any way by exposing them to inappropriate content or otherwise.</li>
    <li>To transmit, or procure the sending of, any advertising or promotional material, including any "junk mail", "chain letter," "spam," or any other similar solicitation.</li>
    <li>To impersonate or attempt to impersonate the Company, a Company employee, another user, or any other person or entity.</li>
</ul>

<h2>5. Termination</h2>
<p>We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.</p>

<h2>6. Limitation of Liability</h2>
<p>In no event shall Inventra, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>

<h2>7. Governing Law</h2>
<p>These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions.</p>

<h2>8. Changes</h2>
<p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.</p>
`;

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      description="The rules for using Inventra — your account, your data, subscriptions and our responsibilities."
      field="termsOfServiceContent"
      defaultHtml={defaultContent}
      lastUpdated="2024-05-23"
      href="/terms"
    />
  );
}
