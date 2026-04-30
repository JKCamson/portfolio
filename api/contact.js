import { z } from 'zod';
import { Resend } from 'resend';

const ContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  message: z.string().min(1).max(5000),
  company: z.string().max(200).optional(),
  turnstileToken: z.string().min(1),
});

async function verifyTurnstile(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error('TURNSTILE_SECRET_KEY not set');
  const body = new URLSearchParams({ secret, response: token });
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  const data = await r.json();
  return Boolean(data?.success);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const parsed = ContactSchema.safeParse(req.body);
  if (!parsed.success) {
    const fieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return res.status(400).json({ ok: false, fieldErrors });
  }

  const { name, email, message, company, turnstileToken } = parsed.data;

  if (company && company.length > 0) {
    return res.status(200).json({ ok: true });
  }

  let humanVerified = false;
  try {
    humanVerified = await verifyTurnstile(turnstileToken);
  } catch (err) {
    console.error('Turnstile verify error:', err);
    return res.status(500).json({ ok: false, error: 'Verification service unavailable' });
  }
  if (!humanVerified) {
    return res.status(403).json({ ok: false, error: 'Verification failed' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const ownerEmail = process.env.OWNER_EMAIL;
  const senderEmail = process.env.SENDER_EMAIL;

  try {
    await resend.emails.send({
      from: senderEmail,
      to: ownerEmail,
      replyTo: email,
      subject: `Portfolio contact from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
    });
  } catch (err) {
    console.error('Owner email send error:', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong.' });
  }

  // Auto-reply — best-effort. If it fails, we still consider the submission successful
  // because the owner already got the message.
  try {
    await resend.emails.send({
      from: senderEmail,
      to: email,
      subject: 'Thanks for reaching out',
      text: `Hi ${name},\n\nI got your message and will get back to you soon.\n\n— John Kyle`,
    });
  } catch (err) {
    console.error('Auto-reply send error (non-fatal):', err);
  }

  return res.status(200).json({ ok: true });
}
