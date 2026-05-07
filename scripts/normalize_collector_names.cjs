const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const normalizeCollectorKey = (collector) =>
  String(collector || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

const getCollectorDisplayName = (collector, collectors) => {
  const collectorKey = normalizeCollectorKey(collector);
  const collectorInfo = collectors.find(c =>
    normalizeCollectorKey(c.name) === collectorKey ||
    normalizeCollectorKey(c.nickname) === collectorKey
  );

  return normalizeCollectorKey((collectorInfo && (collectorInfo.nickname || collectorInfo.name)) || collector);
};

const normalizeTable = async (client, table, column, collectors) => {
  const { rows } = await client.query(`SELECT id, ${column} AS value FROM ${table}`);
  let updateCount = 0;

  for (const row of rows) {
    const nextValue = getCollectorDisplayName(row.value, collectors);
    if (nextValue && nextValue !== row.value) {
      await client.query(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, [nextValue, row.id]);
      updateCount += 1;
    }
  }

  return updateCount;
};

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const collectors = (await client.query('SELECT id, name, nickname, branch FROM collectors')).rows;
    await client.query('BEGIN');

    const updates = {
      loans: await normalizeTable(client, 'loans', 'collector', collectors),
      demand_letters: await normalizeTable(client, 'demand_letters', 'collector_name', collectors),
      remarks: await normalizeTable(client, 'remarks', 'collector', collectors),
    };

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS collectors_name_unique
      ON collectors (UPPER(REGEXP_REPLACE(TRIM(name), '\\s+', ' ', 'g')))
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS collectors_nickname_unique
      ON collectors (UPPER(REGEXP_REPLACE(TRIM(nickname), '\\s+', ' ', 'g')))
      WHERE nickname IS NOT NULL AND TRIM(nickname) <> ''
    `);

    await client.query('COMMIT');
    console.log(JSON.stringify(updates, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
