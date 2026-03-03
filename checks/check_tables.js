import pool from '../config/db.js';

async function checkTables() {
    try {
        console.log('Checking database tables...\n');

        // Check if tables exist
        const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
    `);

        console.log('Existing tables:');
        tables.forEach(t => console.log('  -', t.TABLE_NAME));

        // Check specific tables
        const requiredTables = ['monthly_attendance_summary', 'student_attendance_stats'];

        for (const tableName of requiredTables) {
            const [exists] = await pool.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ?
      `, [tableName]);

            if (exists[0].count > 0) {
                const [count] = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
                console.log(`\n${tableName}: EXISTS (${count[0].count} rows)`);
            } else {
                console.log(`\n${tableName}: MISSING`);
            }
        }

        await pool.end();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkTables();
