import { OWNER_EMAIL } from '../constants/appConstants.js';

export async function sendNewUserNotificationEmail(userDoc) {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.warn(
      '[email-notification] EmailJS is not configured. The admin request remains available in the Admin Portal; no email was sent.',
    );
    return { sent: false, reason: 'not-configured' };
  }

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://studio-37.web.app';
  const approveLink = `${origin}/admin/approve?uid=${encodeURIComponent(String(userDoc.uid || ''))}`;

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: OWNER_EMAIL,
          user_name: userDoc.displayName || 'Pengguna baru',
          user_email: userDoc.email || 'Tidak ada',
          user_phone: userDoc.phoneNumber || 'Tidak ada',
          provider: userDoc.provider || 'Tidak diketahui',
          approve_link: approveLink,
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.warn(
        '[email-notification] EmailJS rejected the notification. No Firebase mail-Extension fallback was attempted.',
        { status: response.status, detail },
      );
      return { sent: false, reason: 'provider-error', status: response.status };
    }

    console.info('[email-notification] Admin request notification sent through EmailJS.');
    return { sent: true, provider: 'emailjs' };
  } catch (error) {
    console.error(
      '[email-notification] EmailJS request failed. No Firebase mail-Extension fallback was attempted.',
      error,
    );
    return { sent: false, reason: 'provider-error' };
  }
}
