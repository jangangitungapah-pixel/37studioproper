import { collection, doc, setDoc } from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseConfigured } from '../lib/firebase.js';
import { OWNER_EMAIL } from '../constants/appConstants.js';


function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendNewUserNotificationEmail(userDoc) {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://studio-37.web.app';
  const approveLink = `${origin}/admin/approve?uid=${userDoc.uid}`;
  const safeDisplayName = escapeHtml(userDoc.displayName);
  const safeEmail = escapeHtml(userDoc.email || 'Tidak ada');
  const safePhoneNumber = escapeHtml(userDoc.phoneNumber || 'Tidak ada');
  const safeProvider = escapeHtml(userDoc.provider);
  const safeCreatedAt = escapeHtml(new Date(userDoc.createdAt).toLocaleString('id-ID'));
  const safeApproveLink = escapeHtml(approveLink);

  // Method 1: EmailJS (Client-Side API)
  if (serviceId && templateId && publicKey) {
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
            user_name: userDoc.displayName,
            user_email: userDoc.email || 'Tidak ada',
            user_phone: userDoc.phoneNumber || 'Tidak ada',
            provider: userDoc.provider,
            approve_link: approveLink,
          },
        }),
      });

      if (response.ok) {
        console.log('Email notification sent successfully via EmailJS.');
        return;
      } else {
        const errText = await response.text();
        console.warn('EmailJS send failed, falling back to Firestore mail collection:', errText);
      }
    } catch (err) {
      console.warn('Error calling EmailJS API, falling back to Firestore mail collection:', err);
    }
  }

  // Method 2: Firestore /mail collection (Firebase Trigger Email Extension fallback)
  if (isFirebaseConfigured && firestoreDb) {
    try {
      const mailRef = doc(collection(firestoreDb, 'mail'));
      await setDoc(mailRef, {
        createdBy: firebaseAuth?.currentUser?.uid || userDoc.uid,
        type: 'adminApprovalRequest',
        createdAt: new Date().toISOString(),
        to: OWNER_EMAIL,
        message: {
          subject: `[37 Music Studio] Pendaftaran Admin Baru: ${userDoc.displayName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #ffffff;">
              <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-top: 0;">Pendaftaran Admin Baru</h2>
              <p>Ada pendaftaran akun admin baru yang memerlukan persetujuan Anda:</p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; width: 120px; color: #7f8c8d;">Nama:</td>
                  <td style="padding: 8px 0; color: #2c3e50;">${safeDisplayName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #7f8c8d;">Email:</td>
                  <td style="padding: 8px 0; color: #2c3e50;">${safeEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #7f8c8d;">No HP:</td>
                  <td style="padding: 8px 0; color: #2c3e50;">${safePhoneNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #7f8c8d;">Metode Login:</td>
                  <td style="padding: 8px 0; color: #2c3e50; text-transform: uppercase;">${safeProvider}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #7f8c8d;">Waktu Daftar:</td>
                  <td style="padding: 8px 0; color: #2c3e50;">${safeCreatedAt}</td>
                </tr>
              </table>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${safeApproveLink}" style="background-color: #2ecc71; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block; box-shadow: 0 4px 6px rgba(46, 204, 113, 0.2);">
                  Setujui Akses Akun
                </a>
              </div>
              
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 0.8rem; color: #95a5a6; text-align: center;">
                Jika tombol di atas tidak berfungsi, Anda juga dapat menyalin tautan berikut ke browser Anda:<br/>
                <a href="${safeApproveLink}" style="color: #3498db; word-break: break-all;">${safeApproveLink}</a>
              </p>
            </div>
          `,
        },
      });
      console.log('Written to Firestore mail collection successfully.');
    } catch (err) {
      console.error('Failed to write to Firestore mail collection:', err);
    }
  }
}
