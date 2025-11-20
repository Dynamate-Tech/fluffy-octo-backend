import dotenv from 'dotenv';
dotenv.config();
import nodemailer from 'nodemailer';

export async function sendEmail({ to, subject, html }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    await transporter.sendMail({
    from: \`"Promo Price App" <${process.env.EMAIL_USER}>\`,
    to,
    subject,
    html,
  });
  console.log(\`✅ Email sent to ${to} with subject "${subject}"\`);
  } catch (error) {
    console.error("Nodemailer Error:", error.message);
    // Log the full error object for detailed debugging
    // console.error("Nodemailer Full Error:", error); 
    throw new Error(\`Failed to send email: \${error.message}\`);
  }}



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
