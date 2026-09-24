import 'dotenv/config';
import AuditEvent from '../../app/models/AuditEvent.js';
import dbClient from '../../config/db/dbClient.js';

async function createAuditEventsTable() {
  try {
    await dbClient.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    
    await dbClient.query('BEGIN');

    if (process.env.ENV === 'test') {
      await dbClient.query(`
        DROP TABLE IF EXISTS audit_events
      `);
    };

    await dbClient.query(`
      CREATE TABLE audit_events (
        ${AuditEvent}
      );
    `);

    /** Fetch an entity's trail: WHERE subject_type=$1 AND subject_id=$2 */
    await dbClient.query(`
      CREATE INDEX idx_audit_events_subject
        ON audit_events (subject_type, subject_id, created_at DESC);
    `);

    /**
     * Business-scoped views. Partial index — events without a business
     * (global user events) don't need to be in this index.
     */
    await dbClient.query(`
      CREATE INDEX idx_audit_events_business
        ON audit_events (business_id, created_at DESC)
        WHERE business_id IS NOT NULL;
    `);

    /** "What has this user done?" — the actor-first view. */
    await dbClient.query(`
      CREATE INDEX idx_audit_events_actor
        ON audit_events (actor_id, created_at DESC);
    `);

    await dbClient.query('COMMIT');
    console.log('"audit_events" table ready.');

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.log('error creating audit_events table!');
    console.log(error);
  }
}

export default createAuditEventsTable;