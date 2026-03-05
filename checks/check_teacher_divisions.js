import pool from '../config/db.js';

async function checkTeacherData() {
    try {
        console.log('🔍 Checking teacher data for multi-year issues...\n');

        // Get all teacher records
        const [teachers] = await pool.query(`
            SELECT teacher_id, name, subject, year, stream, semester, division
            FROM teacher_details_db
            ORDER BY teacher_id, year, stream, semester
        `);

        console.log(`Found ${teachers.length} teacher records\n`);
        
        // Group by teacher_id to see if they teach multiple years
        const teacherMap = {};
        teachers.forEach(t => {
            if (!teacherMap[t.teacher_id]) {
                teacherMap[t.teacher_id] = {
                    name: t.name,
                    records: []
                };
            }
            teacherMap[t.teacher_id].records.push({
                subject: t.subject,
                year: t.year,
                stream: t.stream,
                semester: t.semester,
                division: t.division
            });
        });

        // Show teachers teaching multiple years
        console.log('Teachers teaching multiple years:\n');
        Object.entries(teacherMap).forEach(([id, data]) => {
            const years = [...new Set(data.records.map(r => r.year))];
            if (years.length > 1) {
                console.log(`${data.name} (${id}) teaches ${years.length} years: ${years.join(', ')}`);
                data.records.forEach(r => {
                    console.log(`  - ${r.subject} | ${r.year}-${r.stream} | Sem: ${r.semester} | Div: ${r.division}`);
                });
                console.log('');
            }
        });

        // Check if any teacher has the same division across multiple years
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('Checking for teachers with overlapping divisions across years:\n');
        
        Object.entries(teacherMap).forEach(([id, data]) => {
            const years = [...new Set(data.records.map(r => r.year))];
            if (years.length > 1) {
                // Parse divisions for each year
                const divisionsByYear = {};
                data.records.forEach(r => {
                    const divs = r.division.split(',').map(d => d.trim().toUpperCase());
                    if (!divisionsByYear[r.year]) {
                        divisionsByYear[r.year] = new Set();
                    }
                    divs.forEach(d => divisionsByYear[r.year].add(d));
                });

                // Check for overlapping divisions
                const allYears = Object.keys(divisionsByYear);
                for (let i = 0; i < allYears.length; i++) {
                    for (let j = i + 1; j < allYears.length; j++) {
                        const year1 = allYears[i];
                        const year2 = allYears[j];
                        const divs1 = divisionsByYear[year1];
                        const divs2 = divisionsByYear[year2];
                        
                        const overlap = [...divs1].filter(d => divs2.has(d));
                        if (overlap.length > 0) {
                            console.log(`⚠️  ${data.name} (${id})`);
                            console.log(`   Has same divisions in ${year1} and ${year2}: ${overlap.join(', ')}`);
                            console.log(`   ${year1}: ${[...divs1].join(', ')}`);
                            console.log(`   ${year2}: ${[...divs2].join(', ')}`);
                            console.log('');
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

checkTeacherData().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
