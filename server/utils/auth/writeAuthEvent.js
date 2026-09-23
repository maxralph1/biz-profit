import dbPool from '../../config/db/dbPool.js';

/**
 * Records an authentication event. Best-effort: a failure here never propagates — the login (or refresh, or verification) has already succeeded or failed on its own terms, and losing a log line is better than blocking the user.
 *
 * Never logs credentials. `metadata` should record that an attempt was made and any non-sensitive reason codes — not the attempted value.
 *
 * @param {object} req   - Express request (for ip + user-agent extraction)
 * @param {object} event
 * @param {number|null} event.user_id
 * @param {string}      event.event_type
 * @param {string|null} [event.attempted_identifier]
 * @param {object|null} [event.metadata]
 */
export default async function writeAuthEvent(req, {
  user_id = null,
  event_type,
  attempted_identifier = null,
  metadata = null,
}) {
  const ip = (req.ip || '').slice(0, 45) || null;
  const userAgent = (req.get('user-agent') || '').slice(0, 1000) || null;

  try {
    await dbPool.query(
      `INSERT INTO auth_events
         (user_id, event_type, attempted_identifier, ip, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        user_id,
        event_type,
        attempted_identifier,
        ip,
        userAgent,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    /** Log locally but don't fail the request. If this is happening in production it's a signal to alert on — silently-swallowed log failures are a known way to lose audit evidence. */
    console.error('[writeAuthEvent] failed to record event:', {
      event_type,
      error: err?.message,
      code: err?.code,
    });
  }
}