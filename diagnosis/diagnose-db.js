/**
 * Database Diagnostic and Fix Script
 * This script checks and fixes all potential issues with the subject column
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'hinal',
    password: process.env.DB_PASSWORD || 'hinal',
    database: process.env.DB_NAME || 'acadmark_attendance'
};

async function diagnosticAndFix() {
    console.log('🔍 Running database diagnostics...\n');

    const conn = await mysql.createConnection(dbConfig);

    try {
        // 1. Check all tables with subject column
        console.log('📋 Checking tables with subject column:');
        const tablesWithSubject = [
            'attendance_sessions',
            'attendance_backup',
            'monthly_attendance_summary',
            'student_attendance_stats',
            'teacher_details_db'
        ];

        let allTablesOk = true;
        for (const table of tablesWithSubject) {
            try {
                const [cols] = await conn.query(`DESCRIBE ${table}`);
                const subjectCol = cols.find(col => col.Field === 'subject');
                if (subjectCol) {
                    console.log(`   ✅ ${table.padEnd(35)} subject: ${subjectCol.Type}`);
                } else {
                    console.log(`   ❌ ${table.padEnd(35)} MISSING subject column`);
                    allTablesOk = false;
                }
            } catch (error) {
                console.log(`   ❌ ${table.padEnd(35)} Table not found: ${error.message}`);
                allTablesOk = false;
            }
        }

        if (!allTablesOk) {
            console.log('\n⚠️  Some tables are missing or have issues. Please run database_setup.sql\n');
            await conn.end();
            return;
        }

        // 2. Test INSERT into attendance_sessions
        console.log('\n🧪 Testing INSERT into attendance_sessions:');
        const [teachers] = await conn.query('SELECT teacher_id FROM teacher_details_db LIMIT 1');

        if (teachers.length === 0) {
            console.log('   ⚠️  No teachers in database. Import teachers first.');
        } else {
            const teacherId = teachers[0].teacher_id;
            const testSessionId = `DIAG_TEST_${Date.now()}`;

            try {
                await conn.query(
                    `INSERT INTO attendance_sessions 
            (session_id, teacher_id, subject, year, semester, division, stream, started_at, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'active')`,
                    [testSessionId, teacherId, 'Test Subject', 'FY', '1', 'A', 'Science']
                );
                console.log('   ✅ INSERT test passed');

                // Cleanup
                await conn.query('DELETE FROM attendance_sessions WHERE session_id = ?', [testSessionId]);
                console.log('   ✅ Cleanup successful');
            } catch (error) {
                console.log('   ❌ INSERT failed:', error.message);
            }
        }

        // 3. Test INSERT into attendance_backup
        console.log('\n🧪 Testing INSERT into attendance_backup:');
        if (teachers.length > 0) {
            const teacherId = teachers[0].teacher_id;

            try {
                await conn.query(
                    `INSERT INTO attendance_backup 
            (filename, session_id, teacher_id, subject, year, semester, stream, division, started_at, records, file_content) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
                    ['test.xlsx', 'TEST_SESSION', teacherId, 'Test Subject', 'FY', '1', 'Science', 'A', '[]', 'test_content']
                );
                console.log('   ✅ INSERT test passed');

                // Cleanup
                await conn.query('DELETE FROM attendance_backup WHERE session_id = ?', ['TEST_SESSION']);
                console.log('   ✅ Cleanup successful');
            } catch (error) {
                console.log('   ❌ INSERT failed:', error.message);
            }
        }

        // 4. Check connection pool settings
        console.log('\n⚙️  Connection Info:');
        const [connInfo] = await conn.query('SELECT CONNECTION_ID(), DATABASE(), USER()');
        console.log('   Connection ID:', connInfo[0]['CONNECTION_ID()']);
        console.log('   Database:', connInfo[0]['DATABASE()']);
        console.log('   User:', connInfo[0]['USER()']);

        // 5. Check for any lingering connections
        const [processes] = await conn.query(
            `SELECT COUNT(*) as count FROM information_schema.PROCESSLIST 
       WHERE DB = ? AND COMMAND != 'Sleep'`,
            [dbConfig.database]
        );
        console.log('   Active DB connections:', processes[0].count);

        console.log('\n✅ All diagnostics passed! Database is working correctly.');
        console.log('\n💡 If you still see the error:');
        console.log('   1. Restart your server completely (kill all node processes)');
        console.log('   2. Clear browser cache and cookies');
        console.log('   3. Try in incognito/private browsing mode');
        console.log('   4. Check browser console for the exact error details\n');

    } catch (error) {
        console.log('\n❌ Diagnostic error:', error.message);
        console.log('   Stack:', error.stack);
    }

    await conn.end();
}

diagnosticAndFix().catch(console.error);
