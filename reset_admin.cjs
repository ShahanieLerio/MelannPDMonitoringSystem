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

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const newPassword = 'admin';
const hashed = hashPassword(newPassword);

pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    client.query(`UPDATE users SET password_hash = $1 WHERE username = 'admin'`, [hashed], (err, result) => {
        release();
        if (err) {
            console.error('Error executing query', err.stack);
        } else {
            console.log(`Successfully reset admin password to: ${newPassword}`);
        }
        pool.end();
    });
});
