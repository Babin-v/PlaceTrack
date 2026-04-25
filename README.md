# 🎓 PlaceTrack — Placement Training Management System

A comprehensive, professional, and secure platform designed to track student placement performance, manage assignments, and facilitate faculty-student communication.

## ✨ Features

- **🛡️ Secure Auth**: Role-based login (Faculty & Student) using Roll Numbers or Email.
- **📊 Performance Analytics**: Real-time dashboards with Chart.js showing score trends and batch-wise distribution.
- **📝 Assignment Management**:
  - Automated sync with **HackerRank** contests.
  - Integration with **LeetCode** profiles.
  - Manual document uploads (PDF/Images).
- **💬 Professional Chat**:
  - Private faculty-student communication.
  - **Voice Messaging**: Record and send voice notes.
  - **File Attachments**: Share documents and assets directly.
- **📄 Reporting**: One-click CSV export for all student performance data.
- **🎨 Premium UI**: Modern Light Mode interface with glassmorphism elements.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express
- **Database**: SQLite (via `sql.js` for universal compatibility)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Libraries**: Chart.js, Multer (File uploads), Bcryptjs (Security)

## 🚀 Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/placetrack.git
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Run the server**:
   ```bash
   node server.js
   ```
4. **Access the portal**:
   Open `http://localhost:3000` in your browser.

### 🔑 Demo Credentials
- **Faculty**: `faculty@college.edu` / `faculty123`
- **Student**: `CS001` (Roll No) / `student123`

## 📁 Project Structure

- `/public`: Frontend assets (HTML, CSS, JS).
- `server.js`: Main Express server and API logic.
- `db.js`: Database wrapper for SQLite.
- `/uploads`: Storage for assignment submissions and chat attachments.

---
Built with ❤️ for Educational Excellence.
