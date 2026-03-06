import pool from '../config/db.js';

async function fixStudentTeacherMappings() {
    let connection;
    try {
        console.log('🔧 Starting fix for student-teacher mappings...\n');

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Step 1: Backup current mappings if table exists
        console.log('📦 Step 1: Checking if mapping table exists...');
        const [tables] = await connection.query(`
            SHOW TABLES LIKE 'teacher_student_map'
        `);

        if (tables.length > 0) {
            console.log('📦 Backing up current mappings...');
            await connection.query(`
                CREATE TABLE IF NOT EXISTS teacher_student_map_backup_${Date.now()} AS
                SELECT * FROM teacher_student_map
            `);
            console.log('✅ Backup created\n');

            // Drop the old mapping table
            console.log('🗑️  Step 2: Dropping old mapping table...');
            await connection.query('DROP TABLE IF EXISTS teacher_student_map');
            console.log('✅ Old table dropped\n');
        } else {
            console.log('⚠️  Table does not exist (may have been dropped in previous run)\n');
        }

        // Step 3: Create new mapping table with proper composite key
        console.log('🏗️  Step 3: Creating new mapping table with year/subject/stream context...');
        await connection.query(`
            CREATE TABLE teacher_student_map (
                id INT AUTO_INCREMENT,
                teacher_id VARCHAR(50) NOT NULL,
                subject VARCHAR(100) NOT NULL,
                year VARCHAR(10) NOT NULL,
                stream VARCHAR(100) NOT NULL,
                semester VARCHAR(20) NOT NULL,
                student_id VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY unique_mapping (teacher_id, subject, year, stream, semester, student_id),
                KEY idx_teacher (teacher_id),
                KEY idx_student (student_id),
                KEY idx_year_stream (year, stream)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);
        console.log('✅ New table created\n');

        // Step 4: Populate new mappings correctly
        console.log('📝 Step 4: Creating correct student-teacher mappings...\n');

        // Get all teachers with their assignments
        const [teachers] = await connection.query(`
            SELECT teacher_id, name, subject, year, stream, semester, division
            FROM teacher_details_db
            ORDER BY teacher_id, year, stream, semester
        `);

        console.log(`Found ${teachers.length} teacher assignments\n`);

        let totalMappings = 0;
        let teacherCount = 0;

        for (const teacher of teachers) {
            teacherCount++;
            const divisions = teacher.division
                .split(',')
                .map(d => d.trim().toUpperCase())
                .filter(d => d.length > 0);

            console.log(`[${teacherCount}/${teachers.length}] ${teacher.name} - ${teacher.subject} (${teacher.year}-${teacher.stream})`);
            console.log(`   Divisions: ${divisions.join(', ')}`);

            let teacherMappingCount = 0;

            for (const division of divisions) {
                // Find students matching EXACTLY: year, stream, and division
                const [students] = await connection.query(`
                    SELECT student_id, student_name, roll_no
                    FROM student_details_db
                    WHERE year = ?
                      AND stream = ?
                      AND division = ?
                    ORDER BY roll_no
                `, [teacher.year, teacher.stream, division]);

                if (students.length > 0) {
                    // Create mappings with full context
                    for (const student of students) {
                        await connection.query(`
                            INSERT INTO teacher_student_map 
                                (teacher_id, subject, year, stream, semester, student_id)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP
                        `, [
                            teacher.teacher_id,
                            teacher.subject,
                            teacher.year,
                            teacher.stream,
                            teacher.semester,
                            student.student_id
                        ]);

                        teacherMappingCount++;
                        totalMappings++;
                    }
                    console.log(`   ✓ Mapped ${students.length} student(s) from ${teacher.year}-${teacher.stream} Div ${division}`);
                } else {
                    console.log(`   ⚠️  No students found for ${teacher.year}-${teacher.stream} Div ${division}`);
                }
            }

            console.log(`   📊 Total: ${teacherMappingCount} mapping(s)\n`);
        }

        // Commit the transaction
        await connection.commit();

        // Step 5: Verify the fix
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('📊 VERIFICATION');
        console.log('═══════════════════════════════════════════════════════\n');

        const [verifyResult] = await pool.query(`
            SELECT 
                m.student_id,
                s.student_name,
                s.year as student_year,
                s.stream as student_stream,
                COUNT(DISTINCT m.year) as mapped_years,
                GROUP_CONCAT(DISTINCT m.year ORDER BY m.year) as years
            FROM teacher_student_map m
            JOIN student_details_db s ON m.student_id = s.student_id
            GROUP BY m.student_id, s.student_name, s.year, s.stream
            HAVING COUNT(DISTINCT m.year) > 1
        `);

        if (verifyResult.length === 0) {
            console.log('✅ SUCCESS! No students are mapped to multiple years.');
        } else {
            console.log(`⚠️  Warning: ${verifyResult.length} students still mapped to multiple years`);
            verifyResult.slice(0, 5).forEach(r => {
                console.log(`  - ${r.student_name} (${r.student_year}): mapped to years ${r.years}`);
            });
        }

        console.log(`\n✅ Total mappings created: ${totalMappings}`);
        console.log('\n🎉 Student-teacher mapping fix completed successfully!');

    } catch (error) {
        if (connection) {
            await connection.rollback();
            console.log('❌ Transaction rolled back due to error');
        }
        console.error('❌ Error fixing mappings:', error);
        throw error;
    } finally {
        if (connection) connection.release();
        await pool.end();
    }
}

fixStudentTeacherMappings().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
