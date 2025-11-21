import dotenv from 'dotenv';
dotenv.config();
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ to, subject, html }) {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || '"Promo Price App" <onboarding@resend.dev>',
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Resend Error:", error);
      throw new Error("Failed to send email: " + error.message);
    }

    console.log(`✅ Email sent to ${to} with subject "${subject}"`);
    return data;

  } catch (err) {
    console.error("Resend Full Error:", err);
    throw err;
  }
}



export function generateEmailBodyFromChanges(changes = [], batchInfo = {}) {
  const { title = '', status = '', startDate = '', endDate = '', appliedAt = '', revertedAt = '' } = batchInfo;

  const rows = changes.map(change => {
    const variantId = change.id.split('/').pop();
    return `
      <tr>
        <td>${change.vendor}</td>
        <td>${change.title}</td>
        <td>${change.sku}</td>
        <td>${variantId}</td>
        <td>${change.from.price}</td>
        <td>${change.from.compareAtPrice || '-'}</td>
        <td>${change.to.price}</td>
        <td>${change.to.compareAtPrice || '-'}</td>
        <td>${change.explanation}</td>
      </tr>
    `;
  });

  return `
    <h2>${status === 'reverted' ? '♻️ Promo Price Reverted' : '🟢 Promo Price Applied'}</h2>

    <p><strong>Title:</strong> ${title}</p>
    <p><strong>Status:</strong> ${status}</p>
    <p><strong>Start:</strong> ${startDate || '-'}</p>
    <p><strong>End:</strong> ${endDate || '-'}</p>
    <p><strong>Applied at:</strong> ${appliedAt || '-'}</p>
    <p><strong>Reverted at:</strong> ${revertedAt || '-'}</p>

    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse;">
      <thead style="background: #eee;">
        <tr>
          <th>Vendor</th>
          <th>Product</th>
          <th>SKU</th>
          <th>Variant ID</th>
          <th>Old Price</th>
          <th>Old Compare</th>
          <th>New Price</th>
          <th>New Compare</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `;
}
