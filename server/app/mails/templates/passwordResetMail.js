export default function passwordResetMail({ first_name, reset_url }) {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Hi ${first_name},</p>
      <p>We received a request to reset your BizProfit password.</p>
      <p>
        <a href="${reset_url}"
           style="display:inline-block;padding:12px 20px;background:#111;color:#fff; text-decoration:none;border-radius:6px;">
          Reset password
        </a>
      </p>
      <p>Or paste this link into your browser:</p>
      <p style="word-break: break-all; color: #555;">${reset_url}</p>
      <p>This link expires in 10 minutes. If you didn't request it, ignore this email.</p>
    </div>
  `;
}