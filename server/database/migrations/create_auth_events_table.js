import AuthEvent from '../../app/models/AuthEvent.js';
import dbClient from '../../config/db/dbClient.js';

async function createAuthEventsTable() {
  try {
    await dbClient.query('BEGIN');

    await dbClient.query(`
      CREATE TABLE auth_events (
        ${AuthEvent}
      );
    `);

    /** Primary query: user's own recent events, newest first. */
    await dbClient.query(`
      CREATE INDEX idx_auth_events_user_time
        ON auth_events (user_id, created_at DESC)
        WHERE user_id IS NOT NULL;
    `);

    /** Retention pruning and admin time-range queries. */
    await dbClient.query(`
      CREATE INDEX idx_auth_events_time
        ON auth_events (created_at DESC);
    `);

    /** Detect enumeration: same identifier, many attempts. */
    await dbClient.query(`
      CREATE INDEX idx_auth_events_identifier_time
        ON auth_events (attempted_identifier, created_at DESC)
        WHERE attempted_identifier IS NOT NULL;
    `);

    /** Append-only, matching audit_events. */
    await dbClient.query(`
      CREATE OR REPLACE FUNCTION prevent_auth_events_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'auth_events is append-only'
          USING ERRCODE = 'restrict_violation';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await dbClient.query(`
      CREATE TRIGGER auth_events_no_update
      BEFORE UPDATE ON auth_events
      FOR EACH ROW
      EXECUTE FUNCTION prevent_auth_events_mutation();
    `);
    await dbClient.query(`
      CREATE TRIGGER auth_events_no_delete
      BEFORE DELETE ON auth_events
      FOR EACH ROW
      EXECUTE FUNCTION prevent_auth_events_mutation();
    `);

    await dbClient.query('COMMIT');
    console.log('"auth_events" table ready.');

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.log('error creating auth_events table!');
    console.log(error);
  }
}

export default createAuthEventsTable;