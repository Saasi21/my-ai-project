import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Database
const db = new Database("placement.db");

// Drop old table to apply new schema (Dev only)
db.exec("DROP TABLE IF EXISTS hiring_alerts");

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    college TEXT,
    degree TEXT,
    skills TEXT,
    desiredRole TEXT,
    dreamCompany TEXT,
    photoURL TEXT,
    role TEXT DEFAULT 'student',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS resumes (
    id TEXT PRIMARY KEY,
    userId TEXT,
    extractedSkills TEXT,
    experience TEXT,
    education TEXT,
    score INTEGER,
    suggestions TEXT,
    grammarCorrections TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS hiring_alerts (
    id TEXT PRIMARY KEY,
    companyName TEXT,
    role TEXT,
    location TEXT,
    link TEXT,
    type TEXT,
    description TEXT,
    requirements TEXT,
    deadline TEXT,
    postedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed initial hiring alerts if empty
const alertCount = db.prepare("SELECT COUNT(*) as count FROM hiring_alerts").get() as { count: number };
if (alertCount.count === 0) {
  const insertAlert = db.prepare("INSERT INTO hiring_alerts (id, companyName, role, location, link, type, description, requirements, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  insertAlert.run(
    "1", 
    "Google", 
    "Software Engineer", 
    "Bangalore", 
    "https://google.com/careers", 
    "Full-time",
    "Join Google's engineering team to build the next generation of search and cloud technologies. You will work on complex problems and collaborate with world-class engineers.",
    "B.Tech/M.Tech in CS, strong DS/Algo skills, experience with Java/Python/C++.",
    "2026-04-15"
  );
  insertAlert.run(
    "2", 
    "Amazon", 
    "SDE-1", 
    "Hyderabad", 
    "https://amazon.jobs", 
    "Full-time",
    "Amazon is looking for talented SDEs to join our retail systems team. You will be responsible for designing and implementing scalable services.",
    "Proficiency in Java/C++, understanding of distributed systems, strong problem-solving skills.",
    "2026-03-30"
  );
  insertAlert.run(
    "3", 
    "Microsoft", 
    "Cloud Intern", 
    "Remote", 
    "https://careers.microsoft.com/", 
    "Internship",
    "Work with the Azure team on cutting-edge cloud infrastructure. This is a 6-month internship with a potential for PPO.",
    "Currently pursuing B.Tech in CS, knowledge of cloud computing, good communication skills.",
    "2026-03-25"
  );
  insertAlert.run(
    "4", 
    "Meta", 
    "Software Engineer", 
    "London", 
    "https://metacareers.com", 
    "Full-time",
    "Join Meta to build technologies that help people connect, find communities, and grow businesses. You will work on products like Facebook, Instagram, and WhatsApp.",
    "Strong proficiency in C++, Java, or Python. Experience with distributed systems is a plus.",
    "2026-05-01"
  );
  insertAlert.run(
    "5", 
    "Netflix", 
    "UI Engineer", 
    "Remote", 
    "https://jobs.netflix.com", 
    "Full-time",
    "Netflix is looking for a UI Engineer to help us build the future of entertainment. You will be responsible for creating high-performance user interfaces.",
    "Expertise in React, TypeScript, and CSS. Passion for building great user experiences.",
    "2026-04-20"
  );
  insertAlert.run(
    "6", 
    "Apple", 
    "Hardware Engineer", 
    "Cupertino", 
    "https://www.apple.com/jobs/", 
    "Full-time",
    "Apple's hardware engineering team is looking for talented engineers to design the next generation of consumer electronics.",
    "Degree in Electrical Engineering or related field. Experience with circuit design and prototyping.",
    "2026-06-15"
  );
  insertAlert.run(
    "7", 
    "Zomato", 
    "Product Intern", 
    "Gurgaon", 
    "https://zomato.com/careers", 
    "Internship",
    "Join Zomato's product team to help us build the best food discovery and delivery platform in the world.",
    "Strong analytical skills, passion for product management, and excellent communication.",
    "2026-03-28"
  );
  insertAlert.run(
    "8", 
    "Swiggy", 
    "Backend Developer", 
    "Bangalore", 
    "https://swiggy.com/careers", 
    "Full-time",
    "Swiggy is looking for Backend Developers to join our logistics and delivery team. You will build scalable systems to handle millions of orders.",
    "Proficiency in Java or Go. Experience with microservices and NoSQL databases.",
    "2026-04-10"
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // User Routes
  app.get("/api/user/:id", (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (user) {
      res.json({ ...user, skills: JSON.parse(user.skills || "[]") });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.post("/api/user", (req, res) => {
    const { id, email, name, college, degree, skills, desiredRole, dreamCompany, photoURL } = req.body;
    try {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO users (id, email, name, college, degree, skills, desiredRole, dreamCompany, photoURL) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(id, email, name, college, degree, JSON.stringify(skills || []), desiredRole, dreamCompany, photoURL);
      
      const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
      if (updatedUser) {
        updatedUser.skills = JSON.parse(updatedUser.skills || "[]");
      }
      res.json(updatedUser);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Hiring Alerts
  app.get("/api/hiring-alerts", (req, res) => {
    const alerts = db.prepare("SELECT * FROM hiring_alerts ORDER BY postedAt DESC").all();
    res.json(alerts);
  });

  // Resume Analysis Storage
  app.post("/api/resume-analysis", (req, res) => {
    const { id, userId, extractedSkills, experience, education, score, suggestions, grammarCorrections } = req.body;
    try {
      const insert = db.prepare(`
        INSERT INTO resumes (id, userId, extractedSkills, experience, education, score, suggestions, grammarCorrections)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(
        id, userId, 
        JSON.stringify(extractedSkills), 
        JSON.stringify(experience), 
        JSON.stringify(education), 
        score, 
        JSON.stringify(suggestions), 
        JSON.stringify(grammarCorrections)
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Admin Stats
  app.get("/api/admin/stats", (req, res) => {
    try {
      const studentCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
      const alertCount = db.prepare("SELECT COUNT(*) as count FROM hiring_alerts").get() as { count: number };
      const resumeCount = db.prepare("SELECT COUNT(*) as count FROM resumes").get() as { count: number };
      
      res.json({
        totalStudents: studentCount.count,
        activeAlerts: alertCount.count,
        totalResumes: resumeCount.count,
        companies: 156 // Mocked for now
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
