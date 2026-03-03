import mysql from 'mysql2/promise';

async function testAllInserts() {
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
        console.log(`Testing with teacher: ${teacherId}\n`);

        // Test 1: attendance_sessions
        console.log('Test 1: INSERT INTO attendance_sessions');
        try {
            const testSessionId = `TEST_${Date.now()}`;
            await conn.query(
                `INSERT INTO attendance_sessions 
          (session_id, teacher_id, subject, year, semester, division, stream, started_at, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'active')`,
                [testSessionId, teacherId, 'Mathematics', 'FY', '1', 'A', 'Science']
            );
            console.log('✅ attendance_sessions INSERT works');
            await conn.query('DELETE FROM attendance_sessions WHERE session_id = ?', [testSessionId]);
        } catch (error) {
            console.log('❌ attendance_sessions INSERT failed:', error.message);
        }

        // Test 2: attendance_backup
        console.log('\nTest 2: INSERT INTO attendance_backup');
        try {
            await conn.query(
                `INSERT INTO attendance_backup 
          (filename, session_id, teacher_id, subject, year, semester, stream, division, started_at, records, file_content, saved_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                ['test.xlsx', 'SES_TEST', teacherId, 'Math', 'FY', '1', 'Science', 'A', new Date(), '[]', 'test']
            );
            console.log('✅ attendance_backup INSERT works');
            await conn.query('DELETE FROM attendance_backup WHERE session_id = ?', ['SES_TEST']);
        } catch (error) {
            console.log('❌ attendance_backup INSERT failed:', error.message);
        }

        // Test 3: Check all tables with subject column
        console.log('\nTest 3: Verifying all tables have subject column');
        const tablesWithSubject = [
            'attendance_sessions',
            'attendance_backup',
            'monthly_attendance_summary',
            'student_attendance_stats',
            'teacher_details_db'
        ];

        for (const table of tablesWithSubject) {
            try {
                const [cols] = await conn.query(`DESCRIBE ${table}`);
                const hasSubject = cols.some(col => col.Field === 'subject');
                if (hasSubject) {
                    console.log(`✅ ${table} has subject column`);
                } else {
                    console.log(`❌ ${table} MISSING subject column`);
                }
            } catch (error) {
                console.log(`❌ ${table} error:`, error.message);
            }
        }

    } catch (error) {
        console.log('❌ Unexpected error:', error.message);
    }

    await conn.end();
}

testAllInserts();
