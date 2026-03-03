import pool from '../config/db.js';

async function testDefaulterFunction() {
    try {
        console.log('Testing defaulter list functionality...\n');

        // Check if we have students
        const [students] = await pool.query('SELECT COUNT(*) as count FROM student_details_db');
        console.log(`Students in database: ${students[0].count}`);

        // Check if we have teachers
        const [teachers] = await pool.query('SELECT COUNT(*) as count FROM teacher_details_db');
        console.log(`Teachers in database: ${teachers[0].count}`);

        // Check attendance data
        const [attendance] = await pool.query('SELECT COUNT(*) as count FROM attendance_records');
        console.log(`Attendance records: ${attendance[0].count}`);

        // Check stats tables
        const [monthly] = await pool.query('SELECT COUNT(*) as count FROM monthly_attendance_summary');
        console.log(`Monthly summary records: ${monthly[0].count}`);

        const [stats] = await pool.query('SELECT COUNT(*) as count FROM student_attendance_stats');
        console.log(`Student stats records: ${stats[0].count}`);

        console.log('\n✓ All tables exist and are accessible.');
        console.log('\n📌 To generate defaulter lists:');
        console.log('   1. Mark attendance for some classes (use Teacher dashboard)');
        console.log('   2. The attendance stats will be automatically updated');
        console.log('   3. Then generate the defaulter list from Admin or Teacher dashboard');

        await pool.end();
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testDefaulterFunction();
