export default function verificationMail({ first_name, code }) {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Hi ${first_name},</p>
      <p>Your verification code is:</p>
      <h2 style="font-family: monospace; letter-spacing: 6px; font-size: 32px; margin: 24px 0;">
        ${code}
      </h2>
      <p>This code expires in 10 minutes.</p>
      <p>If you didn't request this, you can ignore this email.</p>
    </div>
  `;
}