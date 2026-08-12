require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

function hashPassword(password) {
  const input = `melann-v1:${password}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `melann-v1:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

const search = process.argv[2];
const newPassword = process.argv[3];

if (!search || !newPassword) {
  console.error('Usage: node reset_user_password.cjs "<username or full name>" "<new password>"');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('New password must be at least 6 characters.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  let lookup = await pool.query(
    `SELECT id, username, full_name, status
     FROM users
     WHERE lower(username) = lower($1)
        OR lower(full_name) = lower($1)
     ORDER BY
       CASE
         WHEN lower(username) = lower($1) THEN 0
         ELSE 1
       END,
       username`,
    [search]
  );

  if (lookup.rows.length === 0) {
    lookup = await pool.query(
    `SELECT id, username, full_name, status
     FROM users
     WHERE lower(username) LIKE lower($2)
        OR lower(full_name) LIKE lower($2)
     ORDER BY username
     LIMIT 5`,
      [search, `%${search}%`]
    );
  }

  if (lookup.rows.length === 0) {
    console.error(`No matching user found for: ${search}`);
    process.exitCode = 1;
    return;
  }

  if (lookup.rows.length > 1) {
    console.error('Multiple users matched. Use the exact username:');
    for (const user of lookup.rows) {
      console.error(`- ${user.username} (${user.full_name || 'no full name'}, ${user.status})`);
    }
    process.exitCode = 1;
    return;
  }

  const user = lookup.rows[0];
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
    hashPassword(newPassword),
    user.id,
  ]);

  console.log(`Password reset complete for ${user.username} (${user.full_name || 'no full name'}).`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
