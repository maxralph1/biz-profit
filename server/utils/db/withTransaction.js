import dbPool from '../../config/db/dbPool.js';

/**
 * Runs `fn(client)` inside a single database transaction. Every query the
 * callback issues must use the provided `client`, not the pool — otherwise
 * it runs outside the transaction and won't roll back on failure.
 */
export default async function withTransaction(fn) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}