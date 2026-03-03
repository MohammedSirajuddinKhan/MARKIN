import pool from '../config/db.js';

async function checkData() {
    try {
        console.log('Checking attendance data...\n');

        const [records] = await pool.query('SELECT COUNT(*) as count FROM attendance_records');
        console.log(`attendance_records: ${records[0].count} rows`);

        const [sessions] = await pool.query('SELECT COUNT(*) as count FROM attendance_sessions');
        console.log(`attendance_sessions: ${sessions[0].count} rows`);

        const [students] = await pool.query('SELECT COUNT(*) as count FROM student_details_db');
        console.log(`student_details_db: ${students[0].count} rows`);

        const [teachers] = await pool.query('SELECT COUNT(*) as count FROM teacher_details_db');
        console.log(`teacher_details_db: ${teachers[0].count} rows`);

        // Check if attendance_records has session_date
        const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'attendance_records'
    `);

        console.log('\nattendance_records columns:');
        columns.forEach(c => console.log('  -', c.COLUMN_NAME));

        // Sample data
        if (records[0].count > 0) {
            const [sample] = await pool.query('SELECT * FROM attendance_records LIMIT 3');
            console.log('\nSample attendance_records:');
            console.log(sample);
        }

        await pool.end();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkData();
