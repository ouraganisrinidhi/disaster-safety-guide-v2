const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const requiredVariables = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missingVariables = requiredVariables.filter(name => !process.env[name]);
  if (missingVariables.length) {
    throw new Error(`Missing required database environment variables: ${missingVariables.join(', ')}`);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL_CA
      ? { ca: process.env.DB_SSL_CA, rejectUnauthorized: true }
      : undefined,
    multipleStatements: true
  });
  try {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8')
      .replace(/^\s*CREATE DATABASE IF NOT EXISTS[\s\S]*?;\s*/im, '')
      .replace(/^\s*USE\s+[^;]+;\s*$/im, '');
    await connection.query(sql);
    console.log(`Database schema applied from ${schemaPath}.`);
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
