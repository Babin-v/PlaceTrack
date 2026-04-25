// ── Faculty Dashboard ─────────────────────────────────────────────────────────
let allStudents = [], allAssignments = [], allSubmissions = [];

async function initFaculty() {
  currentUser = getUser();
  if (!currentUser || currentUser.role !== 'faculty') { logout(); return; }
  document.getElementById('uname').textContent = currentUser.name;
  document.getElementById('av').textContent = currentUser.name[0];
  await Promise.all([loadStats(), loadStudents(), loadAssignments(), loadSubmissions()]);
  loadOverviewCharts();
  pollUnread();
}

// ── Stats ──
async function loadStats() {
  const s = await api('/api/stats');
  document.getElementById('stats-grid').innerHTML = [
    ['👥','Total Students', s.totalStudents,'rgba(124,106,245,0.15)'],
    ['📋','Assignments', s.totalAssignments,'rgba(62,207,207,0.15)'],
    ['⭐','Avg Score', s.avgScore+'%','rgba(74,222,128,0.15)'],
    ['✅','Graded', s.graded,'rgba(251,191,36,0.15)'],
  ].map(([icon,label,val,bg])=>`
    <div class="stat-card">
      <div class="stat-icon" style="background:${bg}">${icon}</div>
      <div class="stat-value">${val}</div>
      <div class="stat-label">${label}</div>
    </div>`).join('');
}

// ── Students ──
async function loadStudents() {
  allStudents = await api('/api/students');
  renderStudents(allStudents);
  const sel = document.getElementById('prog-student');
  if(sel) sel.innerHTML = '<option value="">Select Student…</option>' +
    allStudents.map(s=>`<option value="${s.id}">${s.name} (${s.roll_no||s.batch})</option>`).join('');
}

function renderStudents(list) {
  document.getElementById('students-body').innerHTML = list.length ? list.map(s=>`
    <tr>
      <td><strong>${s.roll_no||'—'}</strong></td>
      <td><span class="badge badge-muted">${s.reg_no||'—'}</span></td>
      <td>${s.name}</td>
      <td><span class="badge badge-primary">${s.batch||'—'}</span></td>
      <td style="color:var(--text-muted)">${s.email||'—'}</td>
      <td>${s.hackerrank_username?`<a href="https://hackerrank.com/${s.hackerrank_username}" target="_blank" style="color:var(--secondary)">${s.hackerrank_username}</a>`:'—'}</td>
      <td>${s.leetcode_username?`<a href="https://leetcode.com/${s.leetcode_username}" target="_blank" style="color:var(--warning)">${s.leetcode_username}</a>`:'—'}</td>
      <td style="display:flex;gap:6px">
        <button class="btn-icon" onclick="editStudent(${s.id})" title="Edit">✏️</button>
        <button class="btn-icon" onclick="deleteStudent(${s.id})" title="Delete">🗑️</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="7" class="empty-state">No students found</td></tr>';
}

function filterStudents() {
  const q = document.getElementById('student-search').value.toLowerCase();
  renderStudents(allStudents.filter(s=>(s.name+s.email+s.roll_no+s.batch).toLowerCase().includes(q)));
}

function openStudentModal(s=null) {
  document.getElementById('student-modal-title').textContent = s ? 'Edit Student' : 'Add Student';
  ['s-id','s-name','s-roll','s-reg','s-email','s-phone','s-batch','s-pwd','s-hr','s-lc'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  if(s) {
    document.getElementById('s-id').value=s.id;
    document.getElementById('s-name').value=s.name||'';
    document.getElementById('s-roll').value=s.roll_no||'';
    document.getElementById('s-reg').value=s.reg_no||'';
    document.getElementById('s-email').value=s.email||'';
    document.getElementById('s-phone').value=s.phone||'';
    document.getElementById('s-batch').value=s.batch||'';
    document.getElementById('s-hr').value=s.hackerrank_username||'';
    document.getElementById('s-lc').value=s.leetcode_username||'';
  }
  openModal('modal-student');
}

function editStudent(id) { openStudentModal(allStudents.find(s=>s.id===id)); }

async function deleteStudent(id) {
  if(!confirm('Delete this student and all their submissions?')) return;
  await api(`/api/students/${id}`,{method:'DELETE'});
  toast('Student deleted'); loadStudents();
}

document.getElementById('student-form')?.addEventListener('submit', async(e)=>{
  e.preventDefault();
  const id = document.getElementById('s-id').value;
  const body = {
    name:document.getElementById('s-name').value,
    email:document.getElementById('s-email').value,
    roll_no:document.getElementById('s-roll').value,
    reg_no:document.getElementById('s-reg').value,
    phone:document.getElementById('s-phone')?.value || '',
    batch:document.getElementById('s-batch').value,
    password:document.getElementById('s-pwd').value,
    hackerrank_username:document.getElementById('s-hr').value,
    leetcode_username:document.getElementById('s-lc').value,
  };
  if(id) await api(`/api/students/${id}`,{method:'PUT',body:JSON.stringify(body)});
  else await api('/api/students',{method:'POST',body:JSON.stringify(body)});
  toast(id?'Student updated':'Student added');
  closeModal('modal-student'); loadStudents();
});

// ── Assignments ──
async function loadAssignments() {
  allAssignments = await api('/api/assignments');
  renderAssignments();
  const sel = document.getElementById('sub-filter-assign');
  if(sel) sel.innerHTML = '<option value="">All Assignments</option>' +
    allAssignments.map(a=>`<option value="${a.id}">${a.title}</option>`).join('');
}

function renderAssignments() {
  document.getElementById('assignments-list').innerHTML = allAssignments.length ?
    allAssignments.map(a=>`
    <div class="glass-card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span class="badge ${a.platform==='HackerRank'?'badge-success':a.platform==='LeetCode'?'badge-warning':'badge-primary'}">${a.platform}</span>
            <span class="badge badge-muted">${a.assigned_batch}</span>
          </div>
          <h3 style="font-size:16px;font-weight:700">${a.title}</h3>
          ${a.description?`<p style="font-size:13px;color:var(--text-muted);margin-top:4px">${a.description}</p>`:''}
          <p style="font-size:12px;color:var(--text-dim);margin-top:6px">📅 Due: ${fmtDate(a.due_date)} &nbsp;|&nbsp; 🏆 Max: ${a.max_marks} marks &nbsp;|&nbsp; ${a.allow_upload?'📎 Upload allowed':''}</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${a.platform==='HackerRank'&&a.contest_slug?`<button class="btn btn-success btn-sm" onclick="syncHackerRank(${a.id})">⚡ Sync Scores</button>`:''}
          ${a.external_url?`<a class="btn btn-ghost btn-sm" href="${a.external_url}" target="_blank">🔗 Open</a>`:''}
          <button class="btn-icon" onclick="editAssign(${a.id})">✏️</button>
          <button class="btn-icon" onclick="deleteAssign(${a.id})">🗑️</button>
        </div>
      </div>
    </div>`).join('')
    : '<div class="empty-state"><div class="empty-icon">📋</div><h3>No assignments yet</h3><p>Create your first assignment</p></div>';
}

function togglePlatformFields() {
  const p = document.getElementById('a-platform').value;
  document.getElementById('hr-fields').style.display = p==='HackerRank'?'block':'none';
  document.getElementById('other-url-field').style.display = p==='Other'||p==='LeetCode'?'block':'none';
}

function openAssignModal(a=null) {
  document.getElementById('assign-modal-title').textContent = a ? 'Edit Assignment' : 'New Assignment';
  ['a-id','a-title','a-desc','a-slug','a-url','a-url2'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('a-platform').value='Manual';
  document.getElementById('a-batch').value='all';
  document.getElementById('a-marks').value='100';
  document.getElementById('a-due').value='';
  document.getElementById('a-upload').checked=true;
  if(a){
    document.getElementById('a-id').value=a.id;
    document.getElementById('a-title').value=a.title||'';
    document.getElementById('a-desc').value=a.description||'';
    document.getElementById('a-platform').value=a.platform||'Manual';
    document.getElementById('a-batch').value=a.assigned_batch||'all';
    document.getElementById('a-marks').value=a.max_marks||100;
    document.getElementById('a-due').value=a.due_date||'';
    document.getElementById('a-slug').value=a.contest_slug||'';
    document.getElementById('a-url').value=a.external_url||'';
    document.getElementById('a-upload').checked=!!a.allow_upload;
  }
  togglePlatformFields();
  openModal('modal-assign');
}

function editAssign(id){ openAssignModal(allAssignments.find(a=>a.id===id)); }

async function deleteAssign(id){
  if(!confirm('Delete this assignment?')) return;
  await api(`/api/assignments/${id}`,{method:'DELETE'});
  toast('Assignment deleted'); loadAssignments();
}

async function syncHackerRank(id) {
  toast('Syncing HackerRank scores…','success');
  const r = await api(`/api/sync/hackerrank/${id}`,{method:'POST'});
  if(r.error) toast(r.error,'error');
  else { toast(`✅ Synced ${r.synced} students`); loadSubmissions(); }
}

document.getElementById('assign-form')?.addEventListener('submit',async(e)=>{
  e.preventDefault();
  const id = document.getElementById('a-id').value;
  const p = document.getElementById('a-platform').value;
  const body={
    title:document.getElementById('a-title').value,
    description:document.getElementById('a-desc').value,
    platform:p,
    contest_slug:document.getElementById('a-slug').value||null,
    external_url:(p==='HackerRank'?document.getElementById('a-url').value:document.getElementById('a-url2').value)||null,
    due_date:document.getElementById('a-due').value,
    max_marks:+document.getElementById('a-marks').value,
    assigned_batch:document.getElementById('a-batch').value,
    allow_upload:document.getElementById('a-upload').checked,
    created_by: currentUser?.id||1,
  };
  if(id) await api(`/api/assignments/${id}`,{method:'PUT',body:JSON.stringify(body)});
  else await api('/api/assignments',{method:'POST',body:JSON.stringify(body)});
  toast(id?'Assignment updated':'Assignment created');
  closeModal('modal-assign'); loadAssignments();
});

// ── Submissions ──
async function loadSubmissions() {
  const aid = document.getElementById('sub-filter-assign')?.value||'';
  const status = document.getElementById('sub-filter-status')?.value||'';
  let url='/api/submissions?';
  if(aid) url+=`assignment_id=${aid}&`;
  if(status) url+=`status=${status}`;
  allSubmissions = await api(url);
  const tbody = document.getElementById('submissions-body');
  if(!tbody) return;
  tbody.innerHTML = allSubmissions.length ? allSubmissions.map(s=>`
    <tr>
      <td><strong>${s.student_name}</strong></td>
      <td style="color:var(--text-muted)">${s.roll_no||'—'}</td>
      <td>${s.assignment_title}</td>
      <td>${statusBadge(s.status)}</td>
      <td><strong>${s.marks!=null?s.marks+'/'+(s.max_marks||100):'—'}</strong></td>
      <td>${s.file_name?`<a href="${s.file_path}" target="_blank" class="btn btn-ghost btn-sm">📎 ${s.file_name.substring(0,18)}…</a>`:'—'}</td>
      <td style="color:var(--text-muted)">${fmtDate(s.submitted_at)}</td>
      <td><button class="btn btn-success btn-sm" onclick="openGrade(${s.id},'${s.student_name}','${s.assignment_title}',${s.marks||0},${s.max_marks||100})">✏️ Grade</button></td>
    </tr>`).join('')
    : '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">No submissions found</td></tr>';
}

function openGrade(id,student,assign,marks,max){
  document.getElementById('g-sub-id').value=id;
  document.getElementById('g-marks').max=max;
  document.getElementById('g-marks').value=marks||'';
  document.getElementById('g-notes').value='';
  document.getElementById('grade-info').innerHTML=`<strong>${student}</strong> — ${assign} (Max: ${max})`;
  openModal('modal-grade');
}

async function saveGrade(){
  const id=document.getElementById('g-sub-id').value;
  await api(`/api/submissions/${id}/grade`,{method:'PUT',body:JSON.stringify({marks:+document.getElementById('g-marks').value,notes:document.getElementById('g-notes').value})});
  toast('Grade saved'); closeModal('modal-grade'); loadSubmissions();
}

// ── Overview Charts ──
async function loadOverviewCharts(){
  const subs = await api('/api/submissions');
  // Score distribution
  const scores = subs.filter(s=>s.marks!=null).map(s=>s.marks);
  const buckets=[0,0,0,0,0];
  scores.forEach(s=>{ buckets[Math.min(4,Math.floor(s/20))]++; });
  destroyChart('scores');
  charts['scores'] = new Chart(document.getElementById('chart-scores'),{type:'bar',data:{labels:['0-20','21-40','41-60','61-80','81-100'],datasets:[{label:'Students',data:buckets,backgroundColor:'rgba(124,106,245,0.7)',borderRadius:6}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});

  // Status doughnut
  const st={pending:0,submitted:0,graded:0};
  subs.forEach(s=>st[s.status]=(st[s.status]||0)+1);
  destroyChart('status');
  charts['status'] = new Chart(document.getElementById('chart-status'),{type:'doughnut',data:{labels:['Pending','Submitted','Graded'],datasets:[{data:[st.pending,st.submitted,st.graded],backgroundColor:['#475569','#fbbf24','#4ade80'],borderWidth:0}]},options:{plugins:{legend:{position:'bottom'}},cutout:'65%'}});

  // Avg per assignment
  const assigns = await api('/api/assignments');
  const avgs = assigns.map(a=>{
    const asgSubs = subs.filter(s=>s.assignment_id===a.id&&s.marks!=null);
    return asgSubs.length ? Math.round(asgSubs.reduce((acc,s)=>acc+s.marks,0)/asgSubs.length) : 0;
  });
  destroyChart('avg');
  charts['avg'] = new Chart(document.getElementById('chart-avg'),{type:'bar',data:{labels:assigns.map(a=>a.title.substring(0,20)),datasets:[{label:'Avg Score',data:avgs,backgroundColor:'rgba(62,207,207,0.7)',borderRadius:6}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100}}}});
}

// ── Progress Charts ──
async function loadStudentProgress(){
  const sid = document.getElementById('prog-student').value;
  if(!sid) return;
  const subs = await api(`/api/submissions?student_id=${sid}`);
  const graded = subs.filter(s=>s.marks!=null);
  destroyChart('student-trend');
  charts['student-trend'] = new Chart(document.getElementById('chart-student-trend'),{type:'line',data:{labels:graded.map(s=>s.assignment_title?.substring(0,15)),datasets:[{label:'Score',data:graded.map(s=>s.marks),borderColor:'#7c6af5',backgroundColor:'rgba(124,106,245,0.1)',tension:.4,fill:true,pointBackgroundColor:'#7c6af5'}]},options:{scales:{y:{beginAtZero:true,max:100}}}});

  // Top performers chart
  const allSubs = await api('/api/submissions');
  const byStudent={};
  allSubs.filter(s=>s.marks!=null).forEach(s=>{
    if(!byStudent[s.student_name]) byStudent[s.student_name]={total:0,count:0};
    byStudent[s.student_name].total+=s.marks; byStudent[s.student_name].count++;
  });
  const tops = Object.entries(byStudent).map(([n,v])=>({name:n,avg:Math.round(v.total/v.count)})).sort((a,b)=>b.avg-a.avg).slice(0,5);
  destroyChart('top');
  charts['top'] = new Chart(document.getElementById('chart-top'),{type:'bar',data:{labels:tops.map(t=>t.name.split(' ')[0]),datasets:[{label:'Avg Score',data:tops.map(t=>t.avg),backgroundColor:'rgba(251,191,36,0.7)',borderRadius:6}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100}}}});

  const ranges=[0,0,0,0,0];
  allSubs.filter(s=>s.marks!=null).forEach(s=>ranges[Math.min(4,Math.floor(s.marks/20))]++);
  destroyChart('range');
  charts['range']=new Chart(document.getElementById('chart-range'),{type:'pie',data:{labels:['0-20','21-40','41-60','61-80','81-100'],datasets:[{data:ranges,backgroundColor:['#f87171','#fb923c','#fbbf24','#34d399','#4ade80'],borderWidth:0}]},options:{plugins:{legend:{position:'bottom'}}}});
}

// ── Unread polling ──
async function pollUnread(){
  const r = await api(`/api/chat/unread/${currentUser.id}`);
  const badge = document.getElementById('chat-badge');
  if(r.unread>0){ badge.style.display='inline'; badge.textContent=r.unread; }
  else badge.style.display='none';
  setTimeout(pollUnread, 8000);
}
