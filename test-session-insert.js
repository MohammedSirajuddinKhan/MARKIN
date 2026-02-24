import mysql from 'mysql2/promise';

async function test() {
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'hinal',
        password: 'hinal',
        database: 'acadmark_attendance'
    });

    try {
        // Get a teacher
        const [teachers] = await conn.query('SELECT teacher_id FROM teacher_details_db LIMIT 1');

        if (teachers.length === 0) {
            console.log('❌ No teachers in database');
            await conn.end();
            return;
        }

        const teacherId = teachers[0].teacher_id;
        const testSessionId = `TEST_${Date.now()}`;

        console.log(`Testing with teacher: ${teacherId}`);

        // Try to insert
        await conn.query(
            `INSERT INTO attendance_sessions 
        (session_id, teacher_id, subject, year, semester, division, stream, started_at, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'active')`,
            [testSessionId, teacherId, 'Mathematics', 'FY', '1', 'A', 'Science']
        );

        console.log('✅ Insert test PASSED - attendance_sessions table is working correctly');

        // Cleanup
        await conn.query('DELETE FROM attendance_sessions WHERE session_id = ?', [testSessionId]);
        console.log('✅ Cleanup successful');

    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    await conn.end();
}

test();
