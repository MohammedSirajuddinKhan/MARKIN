import pool from "../../config/db.js";
import { getStudentStats } from "../services/attendanceService.js";
import defaulterService from "../services/defaulterService.js";

const CAMPUS_LAT = parseFloat(process.env.CAMPUS_LATITUDE || "19.0760");
const CAMPUS_LNG = parseFloat(process.env.CAMPUS_LONGITUDE || "72.8777");
const CAMPUS_RADIUS = parseInt(process.env.CAMPUS_RADIUS_METERS || "500", 10);

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // meters
}

export async function studentDashboard(req, res, next) {
  try {
    const studentId = req.session.user.id;

    // Get student info
    const [student] = await pool.query(
      `SELECT student_id, student_name, roll_no, year, stream, division
       FROM student_details_db
       WHERE student_id = ?`,
      [studentId],
    );

    const studentInfo = student?.[0] || {};

    // Get attendance stats
    const stats = await getStudentStats(studentId);

    // Get defaulter status
    const defaulterStatus =
      await defaulterService.getStudentDefaulterStatus(studentId);

    // Get monthly summary
    const [monthlySummary] = await pool.query(
      `SELECT 
         YEAR(s.started_at) as year,
         MONTH(s.started_at) as month,
         s.stream,
         s.division,
         COUNT(DISTINCT ar.session_id) as total_sessions,
         COUNT(DISTINCT CASE WHEN ar.status = 'P' THEN ar.session_id END) as present_count,
         COUNT(DISTINCT CASE WHEN ar.status = 'A' THEN ar.session_id END) as absent_count,
         ROUND((COUNT(DISTINCT CASE WHEN ar.status = 'P' THEN ar.session_id END) / COUNT(DISTINCT ar.session_id)) * 100, 2) as percentage
       FROM attendance_records ar
       JOIN attendance_sessions s ON ar.session_id = s.session_id
       WHERE ar.student_id = ?
       GROUP BY YEAR(s.started_at), MONTH(s.started_at), s.stream, s.division
       ORDER BY year DESC, month DESC
       LIMIT 6`,
      [studentId],
    );

    return res.json({
      studentInfo: {
        id: studentInfo.student_id,
        name: studentInfo.student_name,
        rollNo: studentInfo.roll_no,
        year: studentInfo.year,
        stream: studentInfo.stream,
        division: studentInfo.division,
      },
      summary: {
        totalSessions: stats.total,
        presentCount: stats.present,
        absentCount: stats.absent,
        percentage: stats.percentage,
      },
      defaulterStatus: {
        isDefaulter: defaulterStatus.isDefaulter,
        defaulterSubjects: defaulterStatus.defaulterSubjects,
        message: defaulterStatus.isDefaulter
          ? "⚠️ You are a defaulter! Your attendance is below 75%."
          : "✅ Your attendance is good. Keep it up!",
      },
      recentAttendance: stats.recentSessions || [],
      monthlySummary: monthlySummary || [],
      subjectBreakdown: stats.subjectBreakdown || [],
      defaulterDetails: defaulterStatus.details,
    });
  } catch (error) {
    return next(error);
  }
}

export async function markAttendance(req, res, next) {
  try {
    const student = req.session.user;
    const { latitude, longitude, accuracy } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude required" });
    }

    const distance = haversineDistance(
      latitude,
      longitude,
      CAMPUS_LAT,
      CAMPUS_LNG,
    );

    if (distance > CAMPUS_RADIUS) {
      await pool.query(
        `INSERT INTO geolocation_logs 
          (student_id, latitude, longitude, accuracy, distance, status, timestamp) 
         VALUES (?, ?, ?, ?, ?, 'REJECTED', NOW())`,
        [
          student.id,
          latitude,
          longitude,
          accuracy || null,
          Math.round(distance),
        ],
      );

      return res
        .status(403)
        .json({ message: "You are outside campus range", distance });
    }

    await pool.query(
      `INSERT INTO geolocation_logs 
        (student_id, latitude, longitude, accuracy, distance, status, timestamp) 
       VALUES (?, ?, ?, ?, ?, 'ACCEPTED', NOW())`,
      [student.id, latitude, longitude, accuracy || null, Math.round(distance)],
    );

    await pool.query(
      `INSERT INTO self_marking 
        (student_id, status, marked_at) 
       VALUES (?, 'P', NOW())`,
      [student.id],
    );

    await pool.query(
      `INSERT INTO activity_logs 
        (actor_role, actor_id, action, details, created_at) 
       VALUES ('student', ?, 'SELF_MARK_ATTENDANCE', ?, NOW())`,
      [student.id, JSON.stringify({ distance })],
    );

    const stats = await getStudentStats(student.id);

    return res.json({
      message: "Attendance marked successfully",
      distance,
      stats,
    });
  } catch (error) {
    return next(error);
  }
}

export async function studentActivity(req, res, next) {
  try {
    const studentId = req.session.user.id;

    const [rows] = await pool.query(
      `SELECT action, details, created_at
       FROM activity_logs
       WHERE actor_role = 'student' AND actor_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [studentId],
    );

    return res.json({ activity: rows });
  } catch (error) {
    return next(error);
  }
}

export async function getAllSessions(req, res, next) {
  try {
    const studentId = req.session.user.id;

    // Get all sessions the student has attended (both present and absent)
    // Use a subquery to get one name per teacher_id, since teacher_details_db
    // can have multiple rows per teacher (one per subject) after the schema migration.
    // Joining directly would multiply attendance rows — one per teacher-subject row.
    const [sessions] = await pool.query(
      `SELECT 
         s.started_at as session_date,
         s.subject,
         ar.status,
         s.year,
         s.stream,
         s.division,
         t.name as teacher_name,
         ar.marked_at as created_at
       FROM attendance_records ar
       JOIN attendance_sessions s ON ar.session_id = s.session_id
       LEFT JOIN (
         SELECT teacher_id, MAX(name) AS name
         FROM teacher_details_db
         GROUP BY teacher_id
       ) t ON s.teacher_id = t.teacher_id
       WHERE ar.student_id = ?
         AND s.year IS NOT NULL
         AND s.stream IS NOT NULL
         AND s.division IS NOT NULL
         AND s.subject IS NOT NULL
       GROUP BY ar.session_id, ar.student_id
       ORDER BY s.started_at DESC, ar.marked_at DESC`,
      [studentId],
    );

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
}

export async function getPresentSessions(req, res, next) {
  try {
    const studentId = req.session.user.id;

    // Get sessions where student was present
    const [sessions] = await pool.query(
      `SELECT 
         s.started_at as session_date,
         s.subject,
         s.year,
         s.stream,
         s.division
       FROM attendance_records ar
       JOIN attendance_sessions s ON ar.session_id = s.session_id
       WHERE ar.student_id = ? 
         AND ar.status = 'P'
         AND s.year IS NOT NULL
         AND s.stream IS NOT NULL
         AND s.division IS NOT NULL
         AND s.subject IS NOT NULL
       GROUP BY ar.session_id, ar.student_id
       ORDER BY s.started_at DESC`,
      [studentId],
    );

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
}

export async function getAbsentSessions(req, res, next) {
  try {
    const studentId = req.session.user.id;

    // Get sessions where student was absent
    const [sessions] = await pool.query(
      `SELECT 
         s.started_at as session_date,
         s.subject,
         s.year,
         s.stream,
         s.division
       FROM attendance_records ar
       JOIN attendance_sessions s ON ar.session_id = s.session_id
       WHERE ar.student_id = ? 
         AND ar.status = 'A'
         AND s.year IS NOT NULL
         AND s.stream IS NOT NULL
         AND s.division IS NOT NULL
         AND s.subject IS NOT NULL
       GROUP BY ar.session_id, ar.student_id
       ORDER BY s.started_at DESC`,
      [studentId],
    );

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
}

export async function getAttendanceCalendar(req, res, next) {
  try {
    const studentId = req.session.user.id;

    // Get attendance data grouped by date
    const [attendanceByDate] = await pool.query(
      `SELECT 
         DATE(s.started_at) as date,
         COUNT(DISTINCT ar.session_id) as total,
         COUNT(DISTINCT CASE WHEN ar.status = 'P' THEN ar.session_id END) as present,
         COUNT(DISTINCT CASE WHEN ar.status = 'A' THEN ar.session_id END) as absent
       FROM attendance_records ar
       JOIN attendance_sessions s ON ar.session_id = s.session_id
       WHERE ar.student_id = ?
       GROUP BY DATE(s.started_at)
       ORDER BY date DESC`,
      [studentId],
    );

    // Convert to object keyed by date
    const calendar = {};
    attendanceByDate.forEach((row) => {
      const dateStr = row.date.toISOString().split("T")[0];
      calendar[dateStr] = {
        total: row.total,
        present: row.present,
        absent: row.absent,
      };
    });

    res.json({ calendar });
  } catch (error) {
    next(error);
  }
}
