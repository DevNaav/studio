/**
 * POST /api/billing/confirmation  { paymentId }
 *
 * Emails the signed-in buyer a purchase confirmation with the invoice PDF attached.
 * - The email only ever goes to the signed-in person's own (verified by Firebase) address.
 * - The payment and company are read from the database with the buyer's own token, so the
 *   security rules apply and nothing in the request body can change the amount or plan.
 * When real payments are added, the payment webhook can call the same code path.
 */
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { format } from 'date-fns';
import { ADMIN_PROJECT_ID, getAdminApp } from '@/lib/firebase-admin';
import { buildInvoicePdf, makeInvoiceNumber, planDescription, SELLER } from '@/lib/invoice-pdf';
import { isMailConfigured, sendMail } from '@/lib/server/mailer';

export const runtime = 'nodejs';

type Fields = Record<string, { stringValue?: string; integerValue?: string; doubleValue?: number; timestampValue?: string }>;

async function readDoc(path: string, token: string): Promise<Fields | null> {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${ADMIN_PROJECT_ID}/databases/(default)/documents/${path}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  if (!res.ok) return null;
  return (await res.json()).fields ?? {};
}

const str = (f: Fields, k: string) => f[k]?.stringValue ?? f[k]?.timestampValue ?? '';
const num = (f: Fields, k: string) => Number(f[k]?.doubleValue ?? f[k]?.integerValue ?? 0);
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Turns an SMTP error into advice the admin can act on. */
function smtpErrorMessage(error: any): string {
  const code = Number(error?.responseCode);
  const text = String(error?.response ?? error?.message ?? '');
  if (code === 454 || /too many login attempts/i.test(text)) {
    return 'Gmail is temporarily blocking sign-ins after too many attempts. Wait about 30 minutes, then try again.';
  }
  if (code === 535 || code === 534 || /username and password not accepted|application-specific password/i.test(text)) {
    return 'The email server rejected the login. Check SMTP_USER (full Gmail address) and SMTP_PASS (a Gmail app password, not your normal password).';
  }
  if (/ETIMEDOUT|ECONNECTION|ENOTFOUND/i.test(String(error?.code))) {
    return 'Could not reach the email server. Check SMTP_HOST and SMTP_PORT.';
  }
  return 'Could not send the email. Check the SMTP settings.';
}

// Stops the same confirmation being sent over and over (per server instance).
const sentCount = new Map<string, number>();

export async function POST(request: Request) {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });

  let email: string | undefined;
  let name: string | undefined;
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
    email = decoded.email;
    name = decoded.name;
  } catch {
    return NextResponse.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
  }
  if (!email) return NextResponse.json({ error: 'Your account has no email address.' }, { status: 400 });

  const body = await request.json().catch(() => ({}));

  if (!isMailConfigured()) {
    return NextResponse.json({ sent: false, reason: 'not-configured' });
  }

  // Test mode: a sample email to the signed-in person's own address, to check the setup.
  if (body?.test === true) {
    const key = `test:${email}`;
    if ((sentCount.get(key) ?? 0) >= 5) return NextResponse.json({ error: 'Too many test emails. Try again later.' }, { status: 429 });
    try {
      await sendMail({
        to: email,
        subject: 'Inventra test email',
        text: `This is a test from Inventra. If you can read this, purchase confirmation emails are working.

${SELLER.name}`,
        html: `<div style="font-family:Arial,sans-serif;color:#1e293b"><h3>Email is working</h3><p>This is a test from Inventra. If you can read this, purchase confirmation emails (with the invoice attached) will reach your customers.</p><p>${esc(SELLER.name)}</p></div>`,
      });
    } catch (error: any) {
      console.error('Test email failed', error);
      return NextResponse.json({ error: smtpErrorMessage(error) }, { status: 502 });
    }
    sentCount.set(key, (sentCount.get(key) ?? 0) + 1);
    return NextResponse.json({ sent: true, to: email });
  }

  const paymentId = body?.paymentId;
  if (typeof paymentId !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(paymentId)) {
    return NextResponse.json({ error: 'Invalid payment.' }, { status: 400 });
  }
  if ((sentCount.get(paymentId) ?? 0) >= 3) {
    return NextResponse.json({ error: 'This confirmation was already sent.' }, { status: 429 });
  }

  const payment = await readDoc(`payments/${paymentId}`, token);
  if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
  const companyId = str(payment, 'companyId');
  const company = companyId ? await readDoc(`companies/${companyId}`, token) : null;

  const paymentDate = str(payment, 'paymentDate') || new Date().toISOString();
  const planId = str(payment, 'planId');
  const amount = num(payment, 'amount');
  const invoiceNumber = str(payment, 'invoiceNumber') || makeInvoiceNumber(paymentId, new Date(paymentDate));
  const companyName = company ? str(company, 'name') : 'Your company';
  const periodEnd = company ? str(company, 'subscriptionEndDate') || null : null;

  const pdf = buildInvoicePdf({ invoiceNumber, paymentDate, planId, amount, companyName, buyerName: name, buyerEmail: email, periodEnd });
  const rs = `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const plan = planDescription(planId);
  const until = periodEnd ? format(new Date(periodEnd), 'dd MMM yyyy') : null;
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';

  try {
    await sendMail({
      to: email,
      subject: `Payment confirmed: ${plan} (${invoiceNumber})`,
      text: [
        greeting, '',
        `Thank you for your payment. Your subscription for ${companyName} is active.`, '',
        `Plan: ${plan}`, `Amount paid: ${rs}`, `Invoice: ${invoiceNumber}`,
        ...(until ? [`Valid until: ${until}`] : []), '',
        'Your invoice is attached as a PDF. You can also download it any time from Subscription > Payment History in the app.', '',
        `${SELLER.name}`, `https://${SELLER.website}`,
      ].join('\n'),
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1e293b">
  <h2 style="margin:0 0 12px">Payment confirmed</h2>
  <p>${esc(greeting)}</p>
  <p>Thank you for your payment. Your subscription for <b>${esc(companyName)}</b> is active.</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr><td style="padding:6px 0;color:#64748b">Plan</td><td style="padding:6px 0;text-align:right">${esc(plan)}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b">Amount paid</td><td style="padding:6px 0;text-align:right"><b>${esc(rs)}</b></td></tr>
    <tr><td style="padding:6px 0;color:#64748b">Invoice</td><td style="padding:6px 0;text-align:right">${esc(invoiceNumber)}</td></tr>
    ${until ? `<tr><td style="padding:6px 0;color:#64748b">Valid until</td><td style="padding:6px 0;text-align:right">${esc(until)}</td></tr>` : ''}
  </table>
  <p>Your invoice is attached as a PDF. You can also download it any time from <b>Subscription → Payment History</b> in the app.</p>
  <p style="margin-top:24px">Thanks,<br>${esc(SELLER.name)}<br><a href="https://${SELLER.website}" style="color:#0284c7">${esc(SELLER.website)}</a></p>
</div>`,
      attachments: [{ filename: `${invoiceNumber}.pdf`, content: Buffer.from(pdf.output('arraybuffer')), contentType: 'application/pdf' }],
    });
  } catch (error) {
    console.error('Confirmation email failed', error);
    return NextResponse.json({ error: smtpErrorMessage(error) }, { status: 502 });
  }

  sentCount.set(paymentId, (sentCount.get(paymentId) ?? 0) + 1);
  return NextResponse.json({ sent: true, to: email });
}
