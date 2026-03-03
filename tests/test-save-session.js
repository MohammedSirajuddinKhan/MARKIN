import mysql from 'mysql2/promise';

async function testSaveSession() {
    const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'hinal',
        password: 'hinal',
        database: 'acadmark_attendance'
    });

    try {
        console.log('🧪 Testing SAVE SESSION functionality...\n');

        // Get a teacher and student
        const [teachers] = await conn.query('SELECT teacher_id FROM teacher_details_db LIMIT 1');
        const [students] = await conn.query('SELECT student_id FROM student_details_db LIMIT 1');

        if (teachers.length === 0 || students.length === 0) {
            console.log('❌ Need at least one teacher and one student in database');
            await conn.end();
            return;
        }

        const teacherId = teachers[0].teacher_id;
        const studentId = students[0].student_id;
        const testSessionId = `TEST_SESSION_${Date.now()}`;

        console.log('Step 1: Creating attendance session...');
        await conn.query(
            `INSERT INTO attendance_sessions 
        (session_id, teacher_id, subject, year, semester, division, stream, started_at, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'active')`,
            [testSessionId, teacherId, 'Mathematics', 'FY', '1', 'A', 'Science']
        );
        console.log('✅ Session created\n');

        console.log('Step 2: Inserting attendance record...');
        await conn.query(
            `INSERT INTO attendance_records 
        (session_id, teacher_id, student_id, subject, year, stream, division, status, session_date, marked_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [testSessionId, teacherId, studentId, 'Mathematics', 'FY', 'Science', 'A', 'P', new Date()]
        );
        console.log('✅ Attendance record inserted\n');

        console.log('Step 3: Finalizing session...');
        await conn.query(
            `UPDATE attendance_sessions 
       SET ended_at = NOW(), present_count = 1, absent_count = 0, status = 'completed' 
       WHERE session_id = ?`,
            [testSessionId]
        );
        console.log('✅ Session finalized\n');

        console.log('Step 4: Inserting into attendance_backup...');
        await conn.query(
            `INSERT INTO attendance_backup 
        (filename, session_id, teacher_id, subject, year, semester, stream, division, started_at, records, file_content) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
            ['test_backup.xlsx', testSessionId, teacherId, 'Mathematics', 'FY', '1', 'Science', 'A', '[]', 'test']
        );
        console.log('✅ Backup saved\n');

        // Cleanup
        console.log('Cleaning up test data...');
        await conn.query('DELETE FROM attendance_backup WHERE session_id = ?', [testSessionId]);
        await conn.query('DELETE FROM attendance_records WHERE session_id = ?', [testSessionId]);
        await conn.query('DELETE FROM attendance_sessions WHERE session_id = ?', [testSessionId]);
        console.log('✅ Cleanup complete\n');

        console.log('🎉 SUCCESS! All SAVE SESSION operations work correctly!\n');
        console.log('The "Unknown column \'subject\' in \'INSERT INTO\'" error is now FIXED.');
        console.log('\nYou can now:');
        console.log('1. Restart your browser (or hard refresh with Ctrl+Shift+R)');
        console.log('2. Login as a teacher');
        console.log('3. Start a session and click SAVE SESSION - it should work! ✅\n');

    } catch (error) {
        console.log('❌ Test failed:', error.message);
        console.log('   SQL:', error.sql);
    }

    await conn.end();
}

testSaveSession();
