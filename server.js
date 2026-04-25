const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const fetch = require('node-fetch');
const multer = require('multer');
const fs = require('fs');
const { createDb } = require('./db');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 3000;

// Socket.io logic
io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
  });
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  const db = await createDb();

  // Schema
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    email TEXT UNIQUE, password TEXT NOT NULL,
    role TEXT NOT NULL, batch TEXT, roll_no TEXT UNIQUE, reg_no TEXT UNIQUE,
    hackerrank_username TEXT, leetcode_username TEXT, phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.exec(`CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
    description TEXT, platform TEXT NOT NULL DEFAULT 'Manual',
    contest_slug TEXT, external_url TEXT, due_date TEXT,
    max_marks INTEGER DEFAULT 100, assigned_batch TEXT DEFAULT 'all',
    allow_upload INTEGER DEFAULT 1, created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.exec(`CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER,
    assignment_id INTEGER, marks REAL, status TEXT DEFAULT 'pending',
    notes TEXT, file_name TEXT, file_path TEXT,
    submitted_at DATETIME, graded_at DATETIME,
    UNIQUE(student_id, assignment_id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER,
    receiver_id INTEGER, content TEXT,
    file_name TEXT, file_path TEXT, is_voice INTEGER DEFAULT 0,
    is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

  // Seed
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count === 0) {
    const fp = bcrypt.hashSync('faculty123', 10);
    const sp = bcrypt.hashSync('student123', 10);
    db.prepare(`INSERT INTO users (name,email,password,role) VALUES (?,?,?,'faculty')`).run('Dr. Rajesh Kumar','faculty@college.edu',fp);
    const students = [
      ['Arjun Sharma','arjun@student.edu','2024-CSE-A','CS001','REG001','arjun_hr','tourist'],
      ['Priya Patel','priya@student.edu','2024-CSE-A','CS002','REG002','priya_codes','neal_wu'],
      ['Rahul Singh','rahul@student.edu','2024-CSE-B','CS003','REG003','rahul_dev','lee215'],
      ['Sneha Reddy','sneha@student.edu','2024-CSE-B','CS004','REG004','sneha_code','jiangly'],
      ['Kiran Kumar','kiran@student.edu','2024-IT-A','IT001','REG005','kiran_hr','ecnerwala'],
    ];
    for (const s of students)
      db.prepare(`INSERT INTO users (name,email,password,role,batch,roll_no,reg_no,hackerrank_username,leetcode_username) VALUES (?,?,?,'student',?,?,?,?,?)`).run(s[0],s[1],sp,s[2],s[3],s[4],s[5],s[6]);

    const asgns = [
      ['Arrays & String Manipulation','Practice array problems','HackerRank','arrays-strings-2024','https://www.hackerrank.com/contests/arrays-strings-2024','2026-05-10',100,'all'],
      ['Dynamic Programming Basics','Weekly DP challenge','HackerRank','dp-basics-week2','https://www.hackerrank.com/contests/dp-basics-week2','2026-05-17',100,'2024-CSE-A'],
      ['Graph Algorithms','Graph problems set','HackerRank','graphs-week3','https://www.hackerrank.com/contests/graphs-week3','2026-05-31',100,'all'],
      ['Resume Writing','Upload your updated resume PDF','Manual',null,null,'2026-05-12',100,'all'],
      ['Aptitude Test','Online aptitude mock test','Manual',null,null,'2026-05-20',50,'all'],
    ];
    for (const a of asgns)
      db.prepare(`INSERT INTO assignments (title,description,platform,contest_slug,external_url,due_date,max_marks,assigned_batch,created_by) VALUES (?,?,?,?,?,?,?,?,1)`).run(...a);

    const sids = db.prepare(`SELECT id FROM users WHERE role='student'`).all().map(r=>r.id);
    const aids = db.prepare(`SELECT id FROM assignments`).all().map(r=>r.id);
    for (const s of [
      [sids[0],aids[0],92,'graded'],[sids[1],aids[0],78,'graded'],
      [sids[2],aids[0],85,'graded'],[sids[3],aids[0],91,'graded'],
      [sids[4],aids[0],67,'graded'],[sids[0],aids[1],88,'graded'],
      [sids[1],aids[1],74,'graded'],[sids[2],aids[1],79,'graded'],
      [sids[3],aids[2],72,'submitted'],[sids[4],aids[3],0,'submitted'],
    ]) db.prepare(`INSERT OR IGNORE INTO submissions (student_id,assignment_id,marks,status,submitted_at) VALUES (?,?,?,?,datetime('now'))`).run(...s);
  }

  // ── AUTH ───────────────────────────────────────────────────────────────────
  app.post('/api/auth/login', (req, res) => {
    const { identifier, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email=? OR roll_no=?').get(identifier, identifier);
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Invalid credentials' });
    const { password: _, ...safe } = user;
    res.json({ user: safe });
  });

  // ── STUDENTS ───────────────────────────────────────────────────────────────
  app.get('/api/students', (req, res) =>
    res.json(db.prepare(`SELECT id,name,email,batch,roll_no,reg_no,hackerrank_username,leetcode_username,phone,created_at FROM users WHERE role='student' ORDER BY batch,name`).all()));

  app.post('/api/students', (req, res) => {
    const { name,email,password,batch,roll_no,reg_no,hackerrank_username,leetcode_username,phone } = req.body;
    try {
      const r = db.prepare(`INSERT INTO users (name,email,password,role,batch,roll_no,reg_no,hackerrank_username,leetcode_username,phone) VALUES (?,?,?,'student',?,?,?,?,?,?)`).run(name,email,bcrypt.hashSync(password||'student123',10),batch,roll_no,reg_no,hackerrank_username,leetcode_username,phone);
      res.json({ id: r.lastInsertRowid });
    } catch(e) { res.status(400).json({ error:'Email or Roll No already exists' }); }
  });

  app.put('/api/students/:id', (req, res) => {
    const { name,email,batch,roll_no,reg_no,hackerrank_username,leetcode_username,phone } = req.body;
    db.prepare(`UPDATE users SET name=?,email=?,batch=?,roll_no=?,reg_no=?,hackerrank_username=?,leetcode_username=?,phone=? WHERE id=?`).run(name,email,batch,roll_no,reg_no,hackerrank_username,leetcode_username,phone,req.params.id);
    res.json({ success:true });
  });

  app.delete('/api/students/:id', (req, res) => {
    db.prepare('DELETE FROM submissions WHERE student_id=?').run(req.params.id);
    db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
    res.json({ success:true });
  });

  // ── FACULTY ────────────────────────────────────────────────────────────────
  app.get('/api/faculty', (req, res) =>
    res.json(db.prepare(`SELECT id,name,email FROM users WHERE role='faculty'`).all()));

  // ── ASSIGNMENTS ────────────────────────────────────────────────────────────
  app.get('/api/assignments', (req, res) =>
    res.json(db.prepare(`SELECT a.*,u.name as creator_name FROM assignments a LEFT JOIN users u ON a.created_by=u.id ORDER BY a.created_at DESC`).all()));

  app.post('/api/assignments', (req, res) => {
    const { title,description,platform,contest_slug,external_url,due_date,max_marks,assigned_batch,allow_upload,created_by } = req.body;
    const r = db.prepare(`INSERT INTO assignments (title,description,platform,contest_slug,external_url,due_date,max_marks,assigned_batch,allow_upload,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(title,description,platform||'Manual',contest_slug||null,external_url||null,due_date,max_marks||100,assigned_batch||'all',allow_upload?1:0,created_by||1);
    res.json({ id: r.lastInsertRowid });
  });

  app.put('/api/assignments/:id', (req, res) => {
    const { title,description,platform,contest_slug,external_url,due_date,max_marks,assigned_batch,allow_upload } = req.body;
    db.prepare(`UPDATE assignments SET title=?,description=?,platform=?,contest_slug=?,external_url=?,due_date=?,max_marks=?,assigned_batch=?,allow_upload=? WHERE id=?`).run(title,description,platform,contest_slug||null,external_url||null,due_date,max_marks,assigned_batch,allow_upload?1:0,req.params.id);
    res.json({ success:true });
  });

  app.delete('/api/assignments/:id', (req, res) => {
    db.prepare('DELETE FROM submissions WHERE assignment_id=?').run(req.params.id);
    db.prepare('DELETE FROM assignments WHERE id=?').run(req.params.id);
    res.json({ success:true });
  });

  // ── SUBMISSIONS ────────────────────────────────────────────────────────────
  app.get('/api/submissions', (req, res) => {
    const { student_id, assignment_id, status } = req.query;
    let q = `SELECT s.*,u.name as student_name,u.roll_no,a.title as assignment_title,a.max_marks,a.platform,a.allow_upload FROM submissions s JOIN users u ON s.student_id=u.id JOIN assignments a ON s.assignment_id=a.id WHERE 1=1`;
    const p = [];
    if (student_id) { q+=' AND s.student_id=?'; p.push(Number(student_id)); }
    if (assignment_id) { q+=' AND s.assignment_id=?'; p.push(Number(assignment_id)); }
    if (status) { q+=' AND s.status=?'; p.push(status); }
    q += ' ORDER BY s.submitted_at DESC';
    res.json(db.prepare(q).all(...p));
  });

  app.post('/api/submissions', upload.single('file'), (req, res) => {
    const { student_id, assignment_id, notes } = req.body;
    const file_name = req.file ? req.file.originalname : null;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;
    try {
      db.prepare(`INSERT OR REPLACE INTO submissions (student_id,assignment_id,status,notes,file_name,file_path,submitted_at) VALUES (?,?,'submitted',?,?,?,datetime('now'))`).run(Number(student_id),Number(assignment_id),notes||null,file_name,file_path);
      res.json({ success:true });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/submissions/:id/grade', (req, res) => {
    const { marks, notes } = req.body;
    db.prepare(`UPDATE submissions SET marks=?,status='graded',notes=?,graded_at=datetime('now') WHERE id=?`).run(marks,notes,Number(req.params.id));
    res.json({ success:true });
  });

  // ── HACKERRANK SYNC ────────────────────────────────────────────────────────
  app.post('/api/sync/hackerrank/:assignmentId', async (req, res) => {
    const asgn = db.prepare('SELECT * FROM assignments WHERE id=?').get(Number(req.params.assignmentId));
    if (!asgn?.contest_slug) return res.status(400).json({ error:'No contest slug set' });
    try {
      const r = await fetch(`https://www.hackerrank.com/rest/contests/${asgn.contest_slug}/leaderboard?offset=0&limit=100`,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}});
      if (!r.ok) throw new Error(`HackerRank returned ${r.status}`);
      const data = await r.json();
      const board = data.models || [];
      const students = db.prepare(`SELECT id,hackerrank_username FROM users WHERE role='student'`).all();
      let synced = 0;
      for (const entry of board) {
        const st = students.find(s => s.hackerrank_username?.toLowerCase() === entry.hacker?.toLowerCase());
        if (st) {
          const marks = Math.min(Math.round((entry.score/asgn.max_marks)*100),100);
          db.prepare(`INSERT OR REPLACE INTO submissions (student_id,assignment_id,marks,status,submitted_at) VALUES (?,?,?,'graded',datetime('now'))`).run(st.id,asgn.id,marks);
          synced++;
        }
      }
      res.json({ success:true, synced, total: board.length });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // ── HACKERRANK PROFILE ─────────────────────────────────────────────────────
  app.get('/api/hackerrank/profile/:username', async (req, res) => {
    try {
      const r = await fetch(`https://www.hackerrank.com/rest/hackers/${req.params.username}/badges`,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}});
      if (!r.ok) throw new Error('Profile not found');
      res.json(await r.json());
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // ── LEETCODE PROFILE ───────────────────────────────────────────────────────
  app.get('/api/leetcode/profile/:username', async (req, res) => {
    try {
      const q = `query userPublicProfile($username:String!){matchedUser(username:$username){username submitStats:submitStatsGlobal{acSubmissionNum{difficulty count}}}}`;
      const r = await fetch('https://leetcode.com/graphql',{method:'POST',headers:{'Content-Type':'application/json','Referer':'https://leetcode.com'},body:JSON.stringify({query:q,variables:{username:req.params.username}})});
      if (!r.ok) throw new Error('LeetCode request failed');
      const data = await r.json();
      const stats = data?.data?.matchedUser?.submitStats?.acSubmissionNum || [];
      const result = { username:req.params.username, easy:0, medium:0, hard:0, total:0 };
      for (const s of stats) {
        if (s.difficulty==='Easy') result.easy=s.count;
        else if (s.difficulty==='Medium') result.medium=s.count;
        else if (s.difficulty==='Hard') result.hard=s.count;
        else if (s.difficulty==='All') result.total=s.count;
      }
      res.json(result);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // ── CSV REPORT ─────────────────────────────────────────────────────────────
  app.get('/api/reports/csv', (req, res) => {
    const rows = db.prepare(`SELECT u.roll_no,u.name,u.batch,u.email,a.title as assignment,a.platform,a.due_date,COALESCE(s.marks,0) as marks,a.max_marks,COALESCE(s.status,'pending') as status FROM users u CROSS JOIN assignments a LEFT JOIN submissions s ON s.student_id=u.id AND s.assignment_id=a.id WHERE u.role='student' ORDER BY u.batch,u.name`).all();
    const hdrs = ['Roll No','Name','Batch','Email','Assignment','Platform','Due Date','Marks','Max Marks','Status'];
    const csv = [hdrs.join(','), ...rows.map(r => [r.roll_no,`"${r.name}"`,r.batch,r.email,`"${r.assignment}"`,r.platform,r.due_date,r.marks,r.max_marks,r.status].join(','))].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="placement_report.csv"');
    res.send(csv);
  });

  // ── STATS ──────────────────────────────────────────────────────────────────
  app.get('/api/stats', (req, res) => {
    const totalStudents = db.prepare(`SELECT COUNT(*) as c FROM users WHERE role='student'`).get().c;
    const totalAssignments = db.prepare(`SELECT COUNT(*) as c FROM assignments`).get().c;
    const avgScore = db.prepare(`SELECT AVG(marks) as avg FROM submissions WHERE status='graded'`).get().avg || 0;
    const submitted = db.prepare(`SELECT COUNT(*) as c FROM submissions WHERE status IN ('submitted','graded')`).get().c;
    const graded = db.prepare(`SELECT COUNT(*) as c FROM submissions WHERE status='graded'`).get().c;
    res.json({ totalStudents, totalAssignments, avgScore:Math.round(avgScore*10)/10, submitted, graded });
  });

  // ── CHAT ───────────────────────────────────────────────────────────────────
  app.get('/api/chat/conversations/:userId', (req, res) => {
    const uid = Number(req.params.userId);
    const allMsgs = db.prepare(`SELECT m.*,s.name as sender_name,r.name as receiver_name FROM messages m JOIN users s ON m.sender_id=s.id JOIN users r ON m.receiver_id=r.id WHERE m.sender_id=? OR m.receiver_id=? ORDER BY m.created_at DESC`).all(uid,uid);
    const threads = {};
    for (const m of allMsgs) {
      const otherId = m.sender_id === uid ? m.receiver_id : m.sender_id;
      if (!threads[otherId]) {
        threads[otherId] = { ...m, other_id: otherId, other_name: m.sender_id===uid ? m.receiver_name : m.sender_name };
      }
    }
    const convos = Object.values(threads);
    for (const c of convos) {
      c.unread = db.prepare(`SELECT COUNT(*) as cnt FROM messages WHERE receiver_id=? AND sender_id=? AND is_read=0`).get(uid, c.other_id).cnt;
    }
    res.json(convos);
  });

  app.get('/api/chat/messages/:userId/:otherId', (req, res) => {
    const { userId, otherId } = req.params;
    const msgs = db.prepare(`SELECT m.*,u.name as sender_name,u.role as sender_role FROM messages m JOIN users u ON m.sender_id=u.id WHERE (m.sender_id=? AND m.receiver_id=?) OR (m.sender_id=? AND m.receiver_id=?) ORDER BY m.created_at ASC`).all(Number(userId),Number(otherId),Number(otherId),Number(userId));
    db.prepare(`UPDATE messages SET is_read=1 WHERE receiver_id=? AND sender_id=?`).run(Number(userId),Number(otherId));
    res.json(msgs);
  });

  app.post('/api/chat/messages', (req, res) => {
    const { sender_id, receiver_id, content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error:'Empty message' });
    const r = db.prepare(`INSERT INTO messages (sender_id,receiver_id,content) VALUES (?,?,?)`).run(Number(sender_id),Number(receiver_id),content.trim());
    const msg = db.prepare(`SELECT m.*,u.name as sender_name,u.role as sender_role FROM messages m JOIN users u ON m.sender_id=u.id WHERE m.id=?`).get(r.lastInsertRowid);
    
    // Emit real-time message
    io.to(`user_${receiver_id}`).emit('new_message', msg);
    
    res.json(msg);
  });

  // Send message with attachment (file or voice)
  app.post('/api/chat/upload', upload.single('file'), (req, res) => {
    const { sender_id, receiver_id, content, is_voice } = req.body;
    const file_name = req.file ? req.file.originalname : null;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;
    
    const r = db.prepare(`INSERT INTO messages (sender_id,receiver_id,content,file_name,file_path,is_voice) VALUES (?,?,?,?,?,?)`)
      .run(Number(sender_id), Number(receiver_id), content || null, file_name, file_path, is_voice === 'true' ? 1 : 0);
      
    const msg = db.prepare(`SELECT m.*,u.name as sender_name,u.role as sender_role FROM messages m JOIN users u ON m.sender_id=u.id WHERE m.id=?`).get(r.lastInsertRowid);
    
    // Emit real-time message/file/voice
    io.to(`user_${receiver_id}`).emit('new_message', msg);
    
    res.json(msg);
  });

  app.get('/api/chat/unread/:userId', (req, res) => {
    const c = db.prepare(`SELECT COUNT(*) as cnt FROM messages WHERE receiver_id=? AND is_read=0`).get(Number(req.params.userId));
    res.json({ unread: c.cnt });
  });

  // ── START ──────────────────────────────────────────────────────────────────
  http.listen(PORT, () => {
    console.log(`\n🚀 PlaceTrack running at http://localhost:${PORT}`);
    console.log(`   Faculty → faculty@college.edu / faculty123`);
    console.log(`   Student → arjun@student.edu  / student123\n`);
  });
}

bootstrap().catch(err => { console.error('Startup error:', err); process.exit(1); });
