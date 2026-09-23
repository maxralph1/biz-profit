import dbClient from '../../config/db/dbClient.js';

async function addAuditEventsAppendOnlyTrigger() {
  try {
    await dbClient.query('BEGIN');

    await dbClient.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_events_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'audit_events is append-only'
          USING ERRCODE = 'restrict_violation';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await dbClient.query(`
      DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
    `);
    await dbClient.query(`
      CREATE TRIGGER audit_events_no_update
      BEFORE UPDATE ON audit_events
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_events_mutation();
    `);

    await dbClient.query(`
      DROP TRIGGER IF EXISTS audit_events_no_delete ON audit_events;
    `);
    await dbClient.query(`
      CREATE TRIGGER audit_events_no_delete
      BEFORE DELETE ON audit_events
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_events_mutation();
    `);

    await dbClient.query('COMMIT');
    console.log('"audit_events" append-only trigger ready.');

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.log('error adding audit_events trigger!');
    console.log(error);
  }
}

export default addAuditEventsAppendOnlyTrigger;