// ── Student Dashboard ─────────────────────────────────────────────────────────
let myAssignments = [], mySubmissions = [], myFilter = 'all';

async function initStudent() {
  currentUser = getUser();
  if (!currentUser || currentUser.role !== 'student') { logout(); return; }
  document.getElementById('uname').textContent = currentUser.name;
  document.getElementById('av').textContent = currentUser.name[0];
  document.getElementById('ubatch').textContent = currentUser.batch || '—';
  document.getElementById('welcome-msg').textContent = `Welcome, ${currentUser.name.split(' ')[0]}! 👋`;
  await Promise.all([loadMyData(), loadUpcoming()]);
  loadMyCharts();
  loadCodingStats();
  pollUnread();
}

async function loadMyData() {
  myAssignments = await api('/api/assignments');
  mySubmissions = await api(`/api/submissions?student_id=${currentUser.id}`);

  // Stats
  const graded = mySubmissions.filter(s=>s.marks!=null);
  const avg = graded.length ? Math.round(graded.reduce((a,s)=>a+s.marks,0)/graded.length) : 0;
  document.getElementById('student-stats').innerHTML = [
    ['📋','Assignments', myAssignments.length,'rgba(124,106,245,0.15)'],
    ['✅','Submitted', mySubmissions.filter(s=>s.status!=='pending').length,'rgba(62,207,207,0.15)'],
    ['⭐','My Avg Score', avg+'%','rgba(74,222,128,0.15)'],
    ['⏳','Pending', myAssignments.length-mySubmissions.filter(s=>s.status!=='pending').length,'rgba(251,191,36,0.15)'],
  ].map(([icon,label,val,bg])=>`
    <div class="stat-card">
      <div class="stat-icon" style="background:${bg}">${icon}</div>
      <div class="stat-value">${val}</div>
      <div class="stat-label">${label}</div>
    </div>`).join('');

  renderMyAssignments();
}

function filterMyAssign(f, el) {
  myFilter = f;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderMyAssignments();
}

function getSubForAssign(aid) {
  return mySubmissions.find(s=>s.assignment_id===aid);
}

function renderMyAssignments() {
  const filtered = myFilter==='all' ? myAssignments : myAssignments.filter(a=>{
    const sub = getSubForAssign(a.id);
    const status = sub?.status || 'pending';
    return status === myFilter;
  });
  document.getElementById('my-assignments-list').innerHTML = filtered.length ? filtered.map(a=>{
    const sub = getSubForAssign(a.id);
    const status = sub?.status || 'pending';
    const overdue = a.due_date && new Date(a.due_date) < new Date() && status==='pending';
    return `<div class="glass-card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span class="badge ${a.platform==='HackerRank'?'badge-success':a.platform==='LeetCode'?'badge-warning':'badge-primary'}">${a.platform}</span>
            ${statusBadge(status)}
            ${overdue?'<span class="badge badge-danger">⚠️ Overdue</span>':''}
          </div>
          <h3 style="font-size:16px;font-weight:700">${a.title}</h3>
          ${a.description?`<p style="font-size:13px;color:var(--text-muted);margin-top:4px">${a.description}</p>`:''}
          <p style="font-size:12px;color:var(--text-dim);margin-top:6px">📅 Due: ${fmtDate(a.due_date)} &nbsp;|&nbsp; 🏆 Max: ${a.max_marks}</p>
          ${sub?.marks!=null?`<p style="font-size:13px;color:var(--success);font-weight:700;margin-top:6px">Your Score: ${sub.marks}/${a.max_marks}</p>`:''}
          ${sub?.notes?`<p style="font-size:12px;color:var(--text-muted);margin-top:4px">📝 ${sub.notes}</p>`:''}
          ${sub?.file_name?`<p style="font-size:12px;margin-top:4px"><a href="${sub.file_path}" target="_blank" style="color:var(--primary)">📎 ${sub.file_name}</a></p>`:''}
        </div>
        <div style="display:flex;gap:8px">
          ${a.external_url?`<a class="btn btn-ghost btn-sm" href="${a.external_url}" target="_blank">🔗 Open</a>`:''}
          ${status==='pending'||status==='submitted'?`<button class="btn btn-primary btn-sm" onclick="openSubmit(${a.id},'${a.title}',${a.allow_upload})">📤 Submit</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('') : `<div class="empty-state"><div class="empty-icon">📋</div><h3>No assignments</h3><p>Check back later</p></div>`;
}

async function loadUpcoming() {
  const assigns = await api('/api/assignments');
  const upcoming = assigns.filter(a=>a.due_date && new Date(a.due_date) >= new Date()).sort((a,b)=>new Date(a.due_date)-new Date(b.due_date)).slice(0,4);
  document.getElementById('upcoming-list').innerHTML = upcoming.length ? upcoming.map(a=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
      <div><p style="font-size:13px;font-weight:600">${a.title}</p>
      <p style="font-size:11px;color:var(--text-muted)">${a.platform}</p></div>
      <span style="font-size:12px;color:var(--warning)">📅 ${fmtDate(a.due_date)}</span>
    </div>`).join('') : '<p style="color:var(--text-muted);font-size:13px">No upcoming deadlines 🎉</p>';

  const graded = mySubmissions.filter(s=>s.marks!=null).slice(0,4);
  document.getElementById('recent-scores').innerHTML = graded.length ? graded.map(s=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
      <p style="font-size:13px;font-weight:600">${s.assignment_title}</p>
      <span style="font-size:13px;font-weight:700;color:${s.marks>=80?'var(--success)':s.marks>=50?'var(--warning)':'var(--danger)'}">
        ${s.marks}/${s.max_marks}</span>
    </div>`).join('') : '<p style="color:var(--text-muted);font-size:13px">No graded submissions yet</p>';
}

// ── My Charts ──
async function loadMyCharts() {
  const graded = mySubmissions.filter(s=>s.marks!=null);
  destroyChart('my-trend');
  charts['my-trend'] = new Chart(document.getElementById('chart-my-trend'),{type:'line',
    data:{labels:graded.map(s=>s.assignment_title?.substring(0,15)||''),
    datasets:[{label:'My Score',data:graded.map(s=>s.marks),borderColor:'#7c6af5',backgroundColor:'rgba(124,106,245,0.1)',tension:.4,fill:true,pointBackgroundColor:'#7c6af5'}]},
    options:{scales:{y:{beginAtZero:true,max:100}}}});

  const st={pending:0,submitted:0,graded:0};
  mySubmissions.forEach(s=>st[s.status]=(st[s.status]||0)+1);
  const pending = myAssignments.length - mySubmissions.length;
  destroyChart('my-status');
  charts['my-status']=new Chart(document.getElementById('chart-my-status'),{type:'doughnut',
    data:{labels:['Pending','Submitted','Graded'],datasets:[{data:[st.pending+pending,st.submitted,st.graded],backgroundColor:['#475569','#fbbf24','#4ade80'],borderWidth:0}]},
    options:{plugins:{legend:{position:'bottom'}},cutout:'60%'}});

  // vs class avg
  const allSubs = await api('/api/submissions');
  const labels=[], myScores=[], classAvgs=[];
  graded.forEach(s=>{
    const classGrp = allSubs.filter(a=>a.assignment_id===s.assignment_id&&a.marks!=null);
    const avg = classGrp.length ? Math.round(classGrp.reduce((a,b)=>a+b.marks,0)/classGrp.length) : 0;
    labels.push(s.assignment_title?.substring(0,12)); myScores.push(s.marks); classAvgs.push(avg);
  });
  destroyChart('vs-avg');
  charts['vs-avg']=new Chart(document.getElementById('chart-vs-avg'),{type:'bar',
    data:{labels,datasets:[
      {label:'My Score',data:myScores,backgroundColor:'rgba(124,106,245,0.7)',borderRadius:4},
      {label:'Class Avg',data:classAvgs,backgroundColor:'rgba(62,207,207,0.4)',borderRadius:4}]},
    options:{scales:{y:{beginAtZero:true,max:100}}}});
}

// ── Coding Stats ──
async function loadCodingStats() { await Promise.all([loadLeetCode(), loadHackerRank()]); }

async function loadLeetCode() {
  const u = currentUser?.leetcode_username;
  document.getElementById('lc-username').textContent = u ? `@${u}` : 'No username set';
  if(!u) { document.getElementById('lc-stats').innerHTML='<p style="color:var(--text-muted);font-size:13px">Set your LeetCode username in your profile.</p>'; return; }
  const r = await api(`/api/leetcode/profile/${u}`);
  if(r.error) { document.getElementById('lc-stats').innerHTML=`<p style="color:var(--danger);font-size:13px">Error: ${r.error}</p>`; return; }
  document.getElementById('lc-stats').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center">
      <div style="background:rgba(74,222,128,0.1);border-radius:8px;padding:12px"><div style="font-size:22px;font-weight:800;color:var(--success)">${r.easy}</div><div style="font-size:11px;color:var(--text-muted)">Easy</div></div>
      <div style="background:rgba(251,191,36,0.1);border-radius:8px;padding:12px"><div style="font-size:22px;font-weight:800;color:var(--warning)">${r.medium}</div><div style="font-size:11px;color:var(--text-muted)">Medium</div></div>
      <div style="background:rgba(248,113,113,0.1);border-radius:8px;padding:12px"><div style="font-size:22px;font-weight:800;color:var(--danger)">${r.hard}</div><div style="font-size:11px;color:var(--text-muted)">Hard</div></div>
    </div>
    <p style="font-size:12px;color:var(--text-muted);margin-top:10px;text-align:center">Total Solved: <strong style="color:var(--text)">${r.total}</strong></p>`;
  destroyChart('lc');
  charts['lc']=new Chart(document.getElementById('chart-lc'),{type:'doughnut',data:{labels:['Easy','Medium','Hard'],datasets:[{data:[r.easy,r.medium,r.hard],backgroundColor:['#4ade80','#fbbf24','#f87171'],borderWidth:0}]},options:{plugins:{legend:{position:'bottom'}},cutout:'55%'}});
}

async function loadHackerRank() {
  const u = currentUser?.hackerrank_username;
  document.getElementById('hr-username').textContent = u ? `@${u}` : 'No username set';
  if(!u) { document.getElementById('hr-stats').innerHTML='<p style="color:var(--text-muted);font-size:13px">Set your HackerRank username.</p>'; return; }
  const r = await api(`/api/hackerrank/profile/${u}`);
  if(r.error||!r.models) {
    document.getElementById('hr-stats').innerHTML=`<a href="https://hackerrank.com/${u}" target="_blank" class="btn btn-ghost" style="width:100%;justify-content:center;margin-top:8px">🔗 View HackerRank Profile</a>`;
    return;
  }
  const badges = r.models || [];
  document.getElementById('hr-stats').innerHTML = badges.length ? `
    <div style="display:flex;flex-wrap:wrap;gap:8px">${badges.map(b=>`
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;text-align:center">
        <div style="font-size:20px">${b.stars>=5?'⭐':b.stars>=3?'🌟':'✨'}</div>
        <div style="font-size:11px;font-weight:600;margin-top:4px">${b.badge_name||b.name}</div>
        <div style="font-size:10px;color:var(--text-muted)">${b.stars||0}★</div>
      </div>`).join('')}</div>
    <a href="https://hackerrank.com/${u}" target="_blank" class="btn btn-ghost btn-sm" style="margin-top:12px;width:100%;justify-content:center">🔗 Full Profile</a>`
    : `<p style="color:var(--text-muted);font-size:13px">No badges found.</p>`;
}

// ── Submit ──
function openSubmit(aid, title, allowUpload) {
  document.getElementById('sub-assign-id').value = aid;
  document.getElementById('sub-notes').value = '';
  document.getElementById('sub-file').value = '';
  document.getElementById('file-chosen').textContent = '';
  document.getElementById('submit-assign-info').innerHTML = `<strong>📋 ${title}</strong>`;
  document.getElementById('upload-field').style.display = allowUpload ? 'block' : 'none';
  openModal('modal-submit');
}

function fileChosen(input) {
  document.getElementById('file-chosen').textContent = input.files[0]?.name || '';
}

async function submitAssignment() {
  const aid = document.getElementById('sub-assign-id').value;
  const notes = document.getElementById('sub-notes').value;
  const file = document.getElementById('sub-file').files[0];
  const fd = new FormData();
  fd.append('student_id', currentUser.id);
  fd.append('assignment_id', aid);
  fd.append('notes', notes);
  if(file) fd.append('file', file);
  const r = await apiForm('/api/submissions', fd);
  if(r.error) { toast(r.error,'error'); return; }
  toast('Assignment submitted! ✅');
  closeModal('modal-submit');
  loadMyData();
}

// Upload drag-drop
document.getElementById('upload-zone')?.addEventListener('dragover', e=>{ e.preventDefault(); e.currentTarget.classList.add('dragover'); });
document.getElementById('upload-zone')?.addEventListener('dragleave', e=>e.currentTarget.classList.remove('dragover'));
document.getElementById('upload-zone')?.addEventListener('drop', e=>{
  e.preventDefault(); e.currentTarget.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if(f){ document.getElementById('sub-file').files = e.dataTransfer.files; fileChosen(document.getElementById('sub-file')); }
});
