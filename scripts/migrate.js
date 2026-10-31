const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '002_users.sql'), 'utf8');
    await connection.query(sql);
    console.log('User-account database migration completed.');
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
