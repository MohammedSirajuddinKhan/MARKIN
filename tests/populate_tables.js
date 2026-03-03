import mysql from 'mysql2/promise';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function populateTables() {
    let connection;

    try {
        // Read environment variables or use defaults
        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'acadmark_db',
            multipleStatements: true
        };

        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);

        // Read the SQL file
        const sqlFile = join(__dirname, 'populate_attendance_stats.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');

        console.log('Executing SQL to populate tables...');
        const [results] = await connection.query(sql);

        console.log('\nSuccess! Tables populated.');

        // Show results
        const [summary] = await connection.query('SELECT COUNT(*) as count FROM monthly_attendance_summary');
        const [stats] = await connection.query('SELECT COUNT(*) as count FROM student_attendance_stats');

        console.log(`\nmonthly_attendance_summary: ${summary[0].count} rows`);
        console.log(`student_attendance_stats: ${stats[0].count} rows`);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

populateTables();
