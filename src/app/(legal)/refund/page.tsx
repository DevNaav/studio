
'use client';

import type { Metadata } from 'next';
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LandingPageContent } from '@/lib/types';
import { Loader2 } from 'lucide-react';

const defaultContent = `<h2>Subscription and Payments</h2>
<p>Our Service is billed on a subscription basis ("Subscription(s)"). You will be billed in advance on a recurring and periodic basis ("Billing Cycle"). Billing cycles are set either on a monthly or annual basis, depending on the type of subscription plan you select when purchasing a Subscription.</p>
<p>At the end of each Billing Cycle, your Subscription will automatically renew under the exact same conditions unless you cancel it or Inventra cancels it. You may cancel your Subscription renewal either through your online account management page or by contacting our customer support team.</p>

<h2>Refund Policy</h2>
<p>Except when required by law, paid Subscription fees are non-refundable.</p>
<p>We operate on a "no questions asked" refund policy for the first 15 days of any new annual subscription. If you are unsatisfied with our service for any reason, you can request a full refund within 15 days of your initial annual payment. This policy does not apply to monthly subscriptions or renewal payments.</p>

<h2>Trial Period</h2>
<p>Inventra may, at its sole discretion, offer a Subscription with a free trial for a limited period of time ("Free Trial"). You may be required to enter your billing information in order to sign up for the Free Trial. If you do enter your billing information when signing up for the Free Trial, you will not be charged by Inventra until the Free Trial has expired. On the last day of the Free Trial period, unless you canceled your Subscription, you will be automatically charged the applicable Subscription fees for the type of Subscription you have selected.</p>

<h2>Cancellations</h2>
<p>You can cancel your subscription at any time. The cancellation will take effect at the end of the current billing cycle. You will continue to have access to the service until the end of your billing period. We do not provide refunds or credits for any partial subscription periods.</p>

<h2>Contact Us</h2>
<p>If you have any questions about our Refund Policy, please contact us.</p>
`;

export default function RefundPolicyPage() {
  const [content, setContent] = useState<string>(defaultContent);
  const [loading, setLoading] = useState(true);
  const lastUpdated = "2024-05-23";

  useEffect(() => {
    const docRef = doc(db, 'site_content', 'landing_page');
    const unsubscribe = onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as LandingPageContent;
        setContent(data.refundPolicyContent || defaultContent);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-16 sm:py-24">
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground">Refund Policy</h1>
        <p className="mt-4 text-lg text-muted-foreground">Last Updated: {lastUpdated}</p>
      </div>

       {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
         <article 
            className="prose prose-invert prose-lg mx-auto max-w-none text-muted-foreground prose-headings:text-foreground prose-a:text-primary hover:prose-a:text-primary/80"
            dangerouslySetInnerHTML={{ __html: content }}
          />
      )}
    </div>
  );
}
