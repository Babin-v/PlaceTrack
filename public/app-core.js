// ── Auth & Shared Utilities ──────────────────────────────────────────────────
const API = '';
let currentUser = null;

function getUser() {
  const u = localStorage.getItem('pt_user');
  if (!u) { window.location.href='/'; return null; }
  return JSON.parse(u);
}

function logout() {
  localStorage.removeItem('pt_user');
  window.location.href = '/';
}

async function api(path, opts={}) {
  try {
    const res = await fetch(API + path, { headers:{'Content-Type':'application/json'}, ...opts });
    const data = await res.json();
    if (!res.ok) return { error: data.error || `Server Error (${res.status})` };
    return data;
  } catch (e) {
    return { error: 'Network connection failed' };
  }
}

async function apiForm(path, formData) {
  const res = await fetch(API + path, { method:'POST', body: formData });
  return res.json();
}

function toast(msg, type='success') {
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type==='success'?'✅':'❌'}</span> ${msg}`;
  c.appendChild(t);
  setTimeout(()=>t.remove(), 3500);
}

function showSection(id) {
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const sec = document.getElementById('sec-'+id);
  if (sec) sec.classList.add('active');
  const navs = document.querySelectorAll('.nav-item');
  navs.forEach(n=>{ if(n.getAttribute('onclick')&&n.getAttribute('onclick').includes(`'${id}'`)) n.classList.add('active'); });
  if (id==='chat') openChatSection();
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openModal(id) { document.getElementById(id).classList.add('open'); }

function statusBadge(s) {
  const map={pending:'badge-muted',submitted:'badge-warning',graded:'badge-success'};
  return `<span class="badge ${map[s]||'badge-muted'}">${s}</span>`;
}

function fmtDate(d) {
  if(!d) return '—';
  return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}

function downloadCSV() {
  window.open('/api/reports/csv','_blank');
}

// Chart defaults
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = 'Inter';

let charts = {};
function destroyChart(id) { if(charts[id]) { charts[id].destroy(); delete charts[id]; } }
