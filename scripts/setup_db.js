
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Error: DATABASE_URL not found in .env.local');
    process.exit(1);
}

const sql = neon(databaseUrl);

async function setup() {
    try {
        const schemaPath = path.resolve(__dirname, '../schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Initializing database schema...');
        // Split by semicolon to run multiple statements if needed, 
        // but Neon handles simple multi-statements in one call sometimes.
        // For safety, we'll try to run the whole thing.
        await sql(schema);

        console.log('Database setup successful! 🚀');
    } catch (error) {
        console.error('Database setup failed:', error);
    }
}

setup();
