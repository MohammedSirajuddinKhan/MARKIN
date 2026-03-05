import pool from '../config/db.js';

async function checkMappingTable() {
    try {
        console.log('🔍 Checking teacher_student_map table structure...\n');

        // Get table structure
        const [createTable] = await pool.query('SHOW CREATE TABLE teacher_student_map');
        console.log('Current table structure:');
        console.log(createTable[0]['Create Table']);
        console.log('\n');

        // Check a sample of mappings
        const [sampleMappings] = await pool.query(`
            SELECT 
                m.teacher_id,
                m.student_id,
                s.student_name,
                s.year as student_year,
                s.stream as student_stream,
                s.division as student_division,
                t.name as teacher_name,
                t.subject,
                t.year as teacher_year,
                t.stream as teacher_stream,
                t.division as teacher_division
            FROM teacher_student_map m
            JOIN student_details_db s ON m.student_id = s.student_id
            JOIN teacher_details_db t ON m.teacher_id = t.teacher_id
            WHERE s.student_id = 'BSC001'
            ORDER BY t.year, t.subject
        `);

        console.log('Sample mappings for student BSC001:\n');
        sampleMappings.forEach(m => {
            console.log(`Student: ${m.student_name} (${m.student_year}-${m.student_stream}-${m.student_division})`);
            console.log(`  → Teacher: ${m.teacher_name} teaching ${m.subject}`);
            console.log(`     Class: ${m.teacher_year}-${m.teacher_stream}-${m.teacher_division}`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

checkMappingTable().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
