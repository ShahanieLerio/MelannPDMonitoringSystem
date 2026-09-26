const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(projectRoot, 'schema.sql');
const upgradePath = path.join(projectRoot, 'database', 'company_upgrade_no_data_loss.sql');

const readSql = (filePath) => fs.readFileSync(filePath, 'utf8');
const stripComments = (sql) => sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*--.*$/gm, '');

const schema = readSql(schemaPath);
const upgrade = readSql(upgradePath);
const schemaSql = stripComments(schema);
const upgradeSql = stripComments(upgrade);

const errors = [];
const requiredTables = [
    'users',
    'collectors',
    'supervisors',
    'action_personnel',
    'loans',
    'payments',
    'remarks',
    'demand_letters',
    'activity_logs',
    'visit_logs',
    'contact_logs',
    'deleted_loans',
    'migration_batches',
    'management_dispositions'
];

for (const table of requiredTables) {
    const tablePattern = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`, 'i');
    if (!tablePattern.test(schemaSql)) errors.push(`schema.sql is missing table: ${table}`);
}

const requiredSchemaFragments = [
    /activity_logs\s*\([\s\S]*?\btype\s+TEXT/i,
    /demand_letters\s*\([\s\S]*?\bcourrier\s+TEXT/i,
    /visit_logs\s*\([\s\S]*?\bpersonnel_assigned\s+TEXT/i,
    /visit_logs\s*\([\s\S]*?\baccompanying_personnel\s+TEXT/i,
    /contact_logs\s*\([\s\S]*?\bpersonnel_assigned\s+TEXT/i,
    /migration_batches_source_cycle_unique/i
];

for (const fragment of requiredSchemaFragments) {
    if (!fragment.test(schemaSql)) errors.push(`schema.sql is missing required fragment: ${fragment}`);
}

const recordChangingStatement = /^\s*(INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)\b/im;
if (recordChangingStatement.test(schemaSql)) {
    errors.push('schema.sql contains a record-changing or table-dropping statement.');
}
if (recordChangingStatement.test(upgradeSql)) {
    errors.push('company_upgrade_no_data_loss.sql contains a record-changing or table-dropping statement.');
}

for (const table of ['supervisors', 'action_personnel', 'visit_logs', 'contact_logs', 'deleted_loans', 'migration_batches', 'management_dispositions']) {
    const tablePattern = new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`, 'i');
    if (!tablePattern.test(upgradeSql)) errors.push(`upgrade script is missing table: ${table}`);
}

if (!/\bBEGIN\s*;/i.test(upgradeSql) || !/\bCOMMIT\s*;/i.test(upgradeSql)) {
    errors.push('upgrade script must run its DDL in a transaction.');
}

if (errors.length > 0) {
    console.error('Database package validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
}

console.log(`Database package validation passed (${requiredTables.length} schema tables, no record-changing statements).`);
