import pool from '../config/db.js';

async function checkMultiYearStudents() {
    try {
        console.log('🔍 Checking for students in multiple years...\n');

        // Check for duplicate student records (same student_id in different years/streams)
        const [duplicateStudents] = await pool.query(`
            SELECT student_id, COUNT(*) as count
            FROM student_details_db
            GROUP BY student_id
            HAVING COUNT(*) > 1
        `);

        if (duplicateStudents.length > 0) {
            console.log(`⚠️  Found ${duplicateStudents.length} students with duplicate records:\n`);
            
            for (const dup of duplicateStudents) {
                const [records] = await pool.query(`
                    SELECT student_id, student_name, year, stream, division, roll_no
                    FROM student_details_db
                    WHERE student_id = ?
                    ORDER BY year, stream, division
                `, [dup.student_id]);
                
                console.log(`Student ID: ${dup.student_id} (${dup.count} records)`);
                records.forEach(r => {
                    console.log(`  - ${r.student_name} | ${r.year}-${r.stream}-${r.division} | Roll: ${r.roll_no}`);
                });
                console.log('');
            }
        } else {
            console.log('✅ No duplicate student records found.\n');
        }

        // Check for students mapped to teachers of different years
        const [multiYearMappings] = await pool.query(`
            SELECT 
                m.student_id,
                s.student_name,
                s.year as student_year,
                s.stream as student_stream,
                s.division as student_division,
                COUNT(DISTINCT m.year) as different_years,
                GROUP_CONCAT(DISTINCT m.year ORDER BY m.year) as teacher_years,
                GROUP_CONCAT(DISTINCT CONCAT(m.year, '-', m.stream) ORDER BY m.year) as teacher_classes
            FROM teacher_student_map m
            INNER JOIN student_details_db s ON m.student_id = s.student_id
            GROUP BY m.student_id, s.student_name, s.year, s.stream, s.division
            HAVING COUNT(DISTINCT m.year) > 1
        `);

        if (multiYearMappings.length > 0) {
            console.log(`❌ Found ${multiYearMappings.length} students mapped to multiple years:\n`);
            
            multiYearMappings.forEach(student => {
                console.log(`Student: ${student.student_name} (${student.student_id})`);
                console.log(`  Enrolled in: ${student.student_year}-${student.student_stream}-${student.student_division}`);
                console.log(`  Mapped to teacher years: ${student.teacher_years}`);
                console.log(`  Mapped to classes: ${student.teacher_classes}`);
                console.log('');
            });
        } else {
            console.log('✅ No students mapped to multiple years.\n');
        }

        // Check for year/stream/division mismatches
        const [mismatches] = await pool.query(`
            SELECT 
                m.student_id,
                s.student_name,
                s.year as student_year,
                s.stream as student_stream,
                s.division as student_division,
                m.teacher_id,
                m.subject,
                m.year as mapping_year,
                m.stream as mapping_stream
            FROM teacher_student_map m
            INNER JOIN student_details_db s ON m.student_id = s.student_id
            WHERE s.year != m.year 
                OR s.stream != m.stream
            ORDER BY s.year, s.stream, s.division, s.student_id
        `);

        if (mismatches.length > 0) {
            console.log(`❌ Found ${mismatches.length} mismatched student-teacher mappings:\n`);
            
            const grouped = {};
            mismatches.forEach(m => {
                const key = `${m.student_year}-${m.student_stream}-${m.student_division}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(m);
            });

            Object.entries(grouped).forEach(([studentClass, records]) => {
                console.log(`\nClass: ${studentClass} (${records.length} mismatches)`);
                records.slice(0, 5).forEach(r => {
                    console.log(`  Student: ${r.student_name} (${r.student_id})`);
                    console.log(`    → Mapped to: ${r.subject} (${r.mapping_year}-${r.mapping_stream})`);
                });
                if (records.length > 5) {
                    console.log(`  ... and ${records.length - 5} more`);
                }
            });
        } else {
            console.log('✅ All student-teacher mappings are correct.\n');
        }

        console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Error checking multi-year students:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

checkMultiYearStudents().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
