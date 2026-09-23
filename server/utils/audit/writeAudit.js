/**
 * Records an audit event. MUST be called with a client that is inside an
 * open transaction — the event and the mutation it describes commit or
 * roll back together.
 *
 * Event conventions:
 *   subject_type  one of: 'user' | 'business' | 'business_user' | 'transaction_type' | 'transaction' | 'monthly_total'
 *   action        'created' | 'updated' | 'deleted' | 'approved' | 'reversed' | 'role_changed' | 'password_changed' | 'email_changed' | 'member_added' | 'member_removed' | ... (free-form)
 *   payload       JSONB or null. Common shape: { changes: { field: newVal } }
 *
 * @param {object} client                - pooled client with open transaction
 * @param {object} event
 * @param {number} event.actor_id
 * @param {string} event.subject_type
 * @param {number} event.subject_id
 * @param {string} event.action
 * @param {number|null} [event.business_id]
 * @param {object|null} [event.payload]
 */
export default async function writeAudit(client, {
  actor_id,
  subject_type,
  subject_id,
  action,
  business_id = null,
  payload = null,
}) {
  await client.query(
    `INSERT INTO audit_events
       (actor_id, subject_type, subject_id, business_id, action, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      actor_id,
      subject_type,
      subject_id,
      business_id,
      action,
      payload ? JSON.stringify(payload) : null,
    ]
  );
}