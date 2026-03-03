import pool from "../../config/db.js";
import notificationService from "../services/notificationService.js";

const ADMIN_USER = process.env.ADMIN_USER || "admin@markin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "admin123";

export async function login(req, res, next) {
  try {
    const { role, identifier, password } = req.body;

    if (!role || !identifier) {
      return res
        .status(400)
        .json({ message: "Role and identifier are required" });
    }

    if (role === "admin") {
      if (identifier !== ADMIN_USER || password !== ADMIN_PASS) {
        return res.status(401).json({ message: "Invalid admin credentials" });
      }

      req.session.user = { role: "admin", id: identifier };
      return res.json({ message: "Login successful", redirectTo: "/admin" });
    }

    if (role === "teacher") {
      const [rows] = await pool.query(
        "SELECT teacher_id, name, stream FROM teacher_details_db WHERE teacher_id = ? LIMIT 1",
        [identifier]
      );

      if (rows.length === 0) {
        return res.status(401).json({ message: "Teacher ID not found" });
      }

      req.session.user = {
        role: "teacher",
        id: rows[0].teacher_id,
        name: rows[0].name,
      };
      return res.json({ message: "Login successful", redirectTo: "/teacher" });
    }

    if (role === "student") {
      const [rows] = await pool.query(
        "SELECT student_id, student_name, stream, division, roll_no FROM student_details_db WHERE student_id = ? LIMIT 1",
        [identifier]
      );

      if (rows.length === 0) {
        return res.status(401).json({ message: "Student ID not found" });
      }

      req.session.user = {
        role: "student",
        id: rows[0].student_id,
        name: rows[0].student_name,
        stream: rows[0].stream,
        division: rows[0].division,
        rollNo: rows[0].roll_no,
      };

      return res.json({ message: "Login successful", redirectTo: "/student" });
    }

    return res.status(400).json({ message: "Unsupported role" });
  } catch (error) {
    return next(error);
  }
}

export function logout(req, res) {
  const userId = req.session?.user?.id;
  
  // Disconnect all SSE connections for this user
  if (userId) {
    notificationService.disconnectUser(userId);
  }

  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
}

