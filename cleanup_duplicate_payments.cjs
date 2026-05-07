/**
 * cleanup_duplicate_payments.cjs
 * 
 * Removes duplicate payment rows that share the same loan_id + date.
 * 
 * Strategy (per loan_id + date group):
 *   1. Keep the GOOD status row first (prefer the legacy Access record, i.e. numeric id, if both are GOOD)
 *   2. If there is no GOOD row, keep the most recently created one
 *   3. Delete all other duplicates in the group
 */

const { Client } = require('pg');

async function cleanup() {
    const client = new Client({
        connectionString: 'postgres://postgres:admin123@localhost:5432/melannDB_Pastdue'
    });

    await client.connect();
    console.log('Connected. Scanning for duplicate payment dates...\n');

    // Find all (loan_id, date) combos that have more than one row
    const dupes = await client.query(`
        SELECT loan_id, date, COUNT(*) AS cnt
        FROM payments
        GROUP BY loan_id, date
        HAVING COUNT(*) > 1
        ORDER BY loan_id, date
    `);

    console.log(`Found ${dupes.rows.length} duplicate (loan_id, date) groups.\n`);

    let deletedTotal = 0;

    for (const row of dupes.rows) {
        const { loan_id, date } = row;

        // Fetch all rows for this group, ordered by preference:
        //   1. GOOD status first
        //   2. Numeric ID first (Access legacy records) among GOOD
        //   3. Most recent created_at as tiebreaker
        const rows = await client.query(`
            SELECT id, status, created_at, or_number
            FROM payments
            WHERE loan_id = $1 AND date = $2
            ORDER BY
                CASE WHEN status = 'GOOD' THEN 0 ELSE 1 END ASC,
                CASE WHEN id ~ '^[0-9]+$' THEN 0 ELSE 1 END ASC,
                created_at DESC NULLS LAST
        `, [loan_id, date]);

        const keep = rows.rows[0];  // Best candidate to keep
        const toDelete = rows.rows.slice(1).map(r => r.id);

        if (toDelete.length > 0) {
            await client.query(`DELETE FROM payments WHERE id = ANY($1::text[])`, [toDelete]);
            deletedTotal += toDelete.length;
            console.log(`  loan_id=${loan_id} date=${date} → Kept [${keep.or_number}] (${keep.status}), deleted ${toDelete.length} duplicate(s)`);
        }
    }

    console.log(`\n✅ Done! Deleted ${deletedTotal} duplicate payment rows.`);
    await client.end();
}

cleanup().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
