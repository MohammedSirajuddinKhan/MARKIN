import pool from '../config/db.js';

async function checkTeacherSchema() {
    try {
        const [createTable] = await pool.query('SHOW CREATE TABLE teacher_details_db');
        console.log('=== teacher_details_db SCHEMA ===\n');
        console.log(createTable[0]['Create Table']);
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

checkTeacherSchema().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
