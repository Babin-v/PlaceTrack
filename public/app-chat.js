// ── Chat (shared faculty + student) ──────────────────────────────────────────
let activeChatUserId = null;
let mediaRecorder = null;
let audioChunks = [];
let socket = null;

function initSocket() {
  if (socket) return;
  socket = io();
  socket.emit('join', currentUser.id);
  
  socket.on('new_message', async (msg) => {
    // If the message is from the user we are currently chatting with, show it
    if (activeChatUserId === msg.sender_id) {
      appendMessage(msg);
      // Mark as read immediately since we are looking at it
      await api(`/api/chat/messages/${currentUser.id}/${msg.sender_id}`);
    } else {
      // Otherwise just update the side list and unread badge
      if (currentUser.role === 'faculty') loadFacultyChat();
      else loadStudentChat();
      updateUnreadBadge();
    }
  });
}

async function openChatSection() {
  initSocket();
  if (currentUser.role === 'faculty') await loadFacultyChat();
  else await loadStudentChat();
}

// ── FACULTY CHAT ──────────────────────────────────────────────────────────────
async function loadFacultyChat() {
  const students = await api('/api/students');
  const convos = await api(`/api/chat/conversations/${currentUser.id}`);

  const threadEl = document.getElementById('chat-threads-faculty');
  if (!threadEl) return;

  threadEl.innerHTML = students.map(s => {
    const convo = convos.find(c => c.other_id === s.id);
    const last = convo ? (convo.is_voice ? '🎤 Voice message' : convo.file_name ? '📎 ' + convo.file_name : convo.content?.substring(0,30)+'…') : 'No messages yet';
    const unread = convo?.unread || 0;
    return `<div class="chat-thread-item ${activeChatUserId===s.id?'active':''}" onclick="openFacultyChat(${s.id},'${s.name}')">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="chat-thread-avatar">${s.name[0]}</div>
        <div class="chat-thread-meta">
          <strong>${s.name}</strong>
          <span>${last}</span>
        </div>
        ${unread?`<span class="chat-unread">${unread}</span>`:''}
      </div>
    </div>`;
  }).join('');
}

async function openFacultyChat(userId, userName) {
  activeChatUserId = userId;
  await loadFacultyChat(); 

  const win = document.getElementById('chat-window-faculty');
  win.innerHTML = renderChatWindow(userId, userName, 'Student');
  await fetchMessages(userId);
}

// ── STUDENT CHAT ──────────────────────────────────────────────────────────────
async function loadStudentChat() {
  const allUsers = await fetch('/api/faculty').then(r=>r.json()).catch(()=>[{id:1,name:'Dr. Rajesh Kumar'}]);
  const facultyList = allUsers.length ? allUsers : [{id:1,name:'Dr. Rajesh Kumar'}];
  const convos = await api(`/api/chat/conversations/${currentUser.id}`);

  const threadEl = document.getElementById('chat-threads-student');
  if (!threadEl) return;

  threadEl.innerHTML = facultyList.map(f => {
    const convo = convos.find(c => c.other_id === f.id);
    const last = convo ? (convo.is_voice ? '🎤 Voice message' : convo.file_name ? '📎 ' + convo.file_name : convo.content?.substring(0,30)+'…') : 'Start a conversation';
    const unread = convo?.unread || 0;
    return `<div class="chat-thread-item ${activeChatUserId===f.id?'active':''}" onclick="openStudentChat(${f.id},'${f.name}')">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="chat-thread-avatar" style="background:var(--primary)">${f.name[0]}</div>
        <div class="chat-thread-meta">
          <strong>${f.name}</strong>
          <span style="font-size:11px;color:var(--primary)">Faculty</span>
          <span>${last}</span>
        </div>
        ${unread?`<span class="chat-unread">${unread}</span>`:''}
      </div>
    </div>`;
  }).join('');
}

async function openStudentChat(userId, userName) {
  activeChatUserId = userId;
  await loadStudentChat();

  const win = document.getElementById('chat-window-student');
  win.innerHTML = renderChatWindow(userId, userName, 'Faculty');
  await fetchMessages(userId);
}

// ── UI Components ─────────────────────────────────────────────────────────────
function renderChatWindow(userId, userName, role) {
  return `
    <div class="chat-window-header">
      <div class="chat-thread-avatar">${userName[0]}</div>
      <div><strong>${userName}</strong><br/><span style="font-size:11px;color:var(--text-muted)">${role}</span></div>
    </div>
    <div class="chat-messages" id="chat-msgs"></div>
    <div class="chat-input-area">
      <button class="btn-icon" onclick="document.getElementById('chat-file-input').click()" title="Attach File">📎</button>
      <input type="file" id="chat-file-input" style="display:none" onchange="sendFile(${userId})"/>
      <button class="btn-icon" id="voice-btn" onmousedown="startRecording()" onmouseup="stopRecording(${userId})" title="Hold to record voice">🎤</button>
      <input id="chat-inp" placeholder="Type a message…" onkeydown="if(event.key==='Enter')sendMsg(${userId})"/>
      <button class="btn btn-primary btn-sm" onclick="sendMsg(${userId})">Send</button>
    </div>`;
}

// ── Shared message functions ──────────────────────────────────────────────────
async function fetchMessages(otherId) {
  const msgs = await api(`/api/chat/messages/${currentUser.id}/${otherId}`);
  const el = document.getElementById('chat-msgs');
  if (!el) return;
  
  const html = msgs.length ? msgs.map(m => {
    const mine = m.sender_id === currentUser.id;
    const time = new Date(m.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    
    let content = `<p>${m.content || ''}</p>`;
    if (m.is_voice) {
      content = `<div class="voice-msg"><audio src="${m.file_path}" controls></audio></div>`;
    } else if (m.file_name) {
      content = `<div class="file-msg"><a href="${m.file_path}" target="_blank" style="color:${mine?'white':'var(--primary)'}">📎 ${m.file_name}</a></div>` + (m.content ? `<p>${m.content}</p>` : '');
    }

    return `<div class="chat-msg ${mine?'mine':''}">
      <div class="chat-msg-avatar" style="${mine?'background:var(--primary)':''}">${m.sender_name[0]}</div>
      <div class="chat-msg-body">
        ${content}
        <time>${mine?'You':m.sender_name.split(' ')[0]} · ${time}</time>
      </div>
    </div>`;
  }).join('') : '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px">No messages yet. Say hello! 👋</div>';
  
  if (el.innerHTML !== html) {
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  }
  updateUnreadBadge();
}

function appendMessage(m) {
  const el = document.getElementById('chat-msgs');
  if (!el) return;
  
  const mine = m.sender_id === currentUser.id;
  const time = new Date(m.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
  
  let content = `<p>${m.content || ''}</p>`;
  if (m.is_voice) {
    content = `<div class="voice-msg"><audio src="${m.file_path}" controls autoplay></audio></div>`;
  } else if (m.file_name) {
    content = `<div class="file-msg"><a href="${m.file_path}" target="_blank" style="color:${mine?'white':'var(--primary)'}">📎 ${m.file_name}</a></div>` + (m.content ? `<p>${m.content}</p>` : '');
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${mine?'mine':''}`;
  msgDiv.innerHTML = `
    <div class="chat-msg-avatar" style="${mine?'background:var(--primary)':''}">${m.sender_name[0]}</div>
    <div class="chat-msg-body">
      ${content}
      <time>${mine?'You':m.sender_name.split(' ')[0]} · ${time}</time>
    </div>`;
  
  el.appendChild(msgDiv);
  el.scrollTop = el.scrollHeight;
}

async function updateUnreadBadge() {
  const r = await api(`/api/chat/unread/${currentUser.id}`);
  const badge = document.getElementById('chat-badge');
  if (badge) {
    if (r.unread > 0) { badge.style.display='inline'; badge.textContent=r.unread; }
    else badge.style.display='none';
  }
}

async function sendMsg(receiverId) {
  const inp = document.getElementById('chat-inp');
  const content = inp?.value?.trim();
  if (!content) return;
  inp.value = '';
  const msg = await api('/api/chat/messages', { method:'POST', body: JSON.stringify({ sender_id: currentUser.id, receiver_id: receiverId, content }) });
  appendMessage(msg);
}

async function sendFile(receiverId) {
  const input = document.getElementById('chat-file-input');
  if (!input.files.length) return;
  const file = input.files[0];
  const fd = new FormData();
  fd.append('sender_id', currentUser.id);
  fd.append('receiver_id', receiverId);
  fd.append('file', file);
  fd.append('is_voice', 'false');
  
  const msg = await fetch('/api/chat/upload', { method: 'POST', body: fd }).then(r=>r.json());
  input.value = '';
  appendMessage(msg);
}

// ── Voice Recording ───────────────────────────────────────────────────────────
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.start();
    
    document.getElementById('voice-btn').style.color = 'var(--danger)';
    document.getElementById('voice-btn').classList.add('recording');

    // Fail-safe: stop recording if mouse leaves button or window loses focus
    const stopHandler = () => {
      if (mediaRecorder && mediaRecorder.state === 'recording') stopRecording(activeChatUserId);
      window.removeEventListener('mouseup', stopHandler);
    };
    window.addEventListener('mouseup', stopHandler);
  } catch (err) {
    toast('Microphone access denied', 'error');
  }
}

async function stopRecording(receiverId) {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  
  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const fd = new FormData();
    fd.append('sender_id', currentUser.id);
    fd.append('receiver_id', receiverId);
    fd.append('file', audioBlob, 'voice_message.webm');
    fd.append('is_voice', 'true');
    
    const msg = await fetch('/api/chat/upload', { method: 'POST', body: fd }).then(r=>r.json());
    appendMessage(msg);
    
    mediaRecorder.stream.getTracks().forEach(t => t.stop());
  };
  
  mediaRecorder.stop();
  document.getElementById('voice-btn').style.color = '';
  document.getElementById('voice-btn').classList.remove('recording');
}
