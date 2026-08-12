let state = { me: null };

const SCREEN_TITLES = {
  '#signIn': () => 'NEXA',
  '#home': () => 'My Projects',
  '#tasks': () => state.project?.title || 'Tasks',
  '#subtasks': () => state.task?.title || 'Subtasks',
  '#capture': () => 'Add Evidence',
  '#review': () => 'Review',
};
const BACK_TARGET = {
  '#tasks': '#home',
  '#subtasks': '#tasks',
  '#capture': '#subtasks',
  '#review': '#subtasks',
};

function show(id) {
  document.querySelectorAll('section').forEach(s => s.hidden = true);
  document.querySelector(id).hidden = false;

  document.getElementById('headerTitle').textContent = SCREEN_TITLES[id] ? SCREEN_TITLES[id]() : 'NEXA';

  const backBtn = document.getElementById('backBtn');
  const backTarget = BACK_TARGET[id];
  if (backTarget) {
    backBtn.style.display = 'inline-flex';
    backBtn.onclick = () => show(backTarget);
  } else {
    backBtn.style.display = 'none';
  }

  const roleEl = document.getElementById('headerRole');
  if (state.me && id !== '#signIn') {
    roleEl.style.display = 'inline-block';
    roleEl.textContent = state.me.role.toUpperCase();
  } else {
    roleEl.style.display = 'none';
  }
}

async function signIn() {
  const entered = document.getElementById('emailInput').value;
  const people = await read('People');
  const me = people.find(p => p.email.toLowerCase() === entered.trim().toLowerCase());
  if (!me) { document.getElementById('notInvited').hidden = false; return; }
  state.me = me;
  localStorage.setItem('nexa.me', JSON.stringify(me));
  await loadProjects();
  show('#home');
}

const saved = localStorage.getItem('nexa.me');
if (saved) {
  state.me = JSON.parse(saved);
  window.addEventListener('DOMContentLoaded', async () => {
    await loadProjects();
    show('#home');
  });
}

state.project = null;
state.task = null;
state.subtask = null;

function statusChip(subtaskId) {
  const matches = (state.reviews || []).filter(r => r.target_id === subtaskId);
  if (matches.length === 0) return '<span class="nexa-chip nexa-chip--todo">Not submitted</span>';
  const latest = matches.sort((a, b) => new Date(b.created) - new Date(a.created))[0];
  return latest.decision === 'accepted'
    ? '<span class="nexa-chip nexa-chip--done">Accepted</span>'
    : '<span class="nexa-chip nexa-chip--changes">Changes</span>';
}

async function loadProjects() {
  const projects = await read('Projects');
  let mine;
  if (state.me.role === 'assessor') {
    mine = projects.filter(p => p.assessor_email.toLowerCase() === state.me.email.toLowerCase());
  } else {
    mine = projects.filter(p => p.learner_email.toLowerCase() === state.me.email.toLowerCase());
  }
  state.projects = mine;

  const el = document.getElementById('projectList');
  if (mine.length === 0) {
    el.innerHTML = '<p class="nexa-muted">No projects yet.</p>';
    return;
  }
  const statusChipClass = { 'in progress': 'nexa-chip--progress', 'complete': 'nexa-chip--done' };
  el.innerHTML = mine.map(p => `
    <div class="nexa-card nexa-card--link" onclick="openProject('${p.id}')">
      <div class="nexa-grow">
        <div class="nexa-card__title">${p.title}</div>
        ${p.unit_standard ? `<span class="nexa-code">${p.unit_standard}</span>` : ''}
      </div>
      <span class="nexa-chip ${statusChipClass[p.status] || 'nexa-chip--todo'}">${p.status || 'not started'}</span>
    </div>
  `).join('');
}

async function openProject(projectId) {
  state.project = state.projects.find(p => p.id === projectId);

  const tasks = await read('Tasks');
  state.tasks = tasks.filter(t => t.project_id === projectId)
                      .sort((a, b) => (a.sort || 0) - (b.sort || 0));

  const el = document.getElementById('taskList');
  el.innerHTML = state.tasks.length === 0
    ? '<p class="nexa-muted">No tasks on this project yet.</p>'
    : state.tasks.map(t => `
        <div class="nexa-card nexa-card--link" onclick="openTask('${t.id}')">
          <div class="nexa-grow"><div class="nexa-card__title">${t.title}</div></div>
        </div>
      `).join('');
  show('#tasks');
}

async function openTask(taskId) {
  state.task = state.tasks.find(t => t.id === taskId);

  const subtasks = await read('Subtasks');
  state.subtasks = subtasks.filter(s => s.task_id === taskId);

  const reviews = await read('Reviews');
  state.reviews = reviews.filter(r => r.target_type === 'subtask');

  const el = document.getElementById('subtaskList');
  el.innerHTML = state.subtasks.length === 0
    ? '<p class="nexa-muted">No subtasks here yet.</p>'
    : state.subtasks.map(s => `
        <div class="nexa-card nexa-card--link" onclick="openSubtask('${s.id}')">
          <div class="nexa-grow">
            <div class="nexa-card__title">${s.title}</div>
            <div class="nexa-req">Needs: ${s.requires}</div>
          </div>
          ${statusChip(s.id)}
        </div>
      `).join('');
  show('#subtasks');
}

async function openSubtask(subtaskId) {
  state.subtask = state.subtasks.find(s => s.id === subtaskId);

  if (state.me.role === 'assessor') {
    await openReview(state.subtask);
  } else {
    document.getElementById('captureSubtaskTitle').textContent = state.subtask.title;
    document.getElementById('status').textContent = '';

    const matches = state.reviews.filter(r => r.target_id === subtaskId);
    let feedback = '';
    if (matches.length > 0) {
      const latest = matches.sort((a, b) => new Date(b.created) - new Date(a.created))[0];
      const bannerClass = latest.decision === 'accepted' ? 'nexa-banner--ok' : 'nexa-banner--warn';
      const label = latest.decision === 'accepted' ? '✅ Accepted' : '↩️ Changes requested';
      feedback = `<div class="nexa-banner ${bannerClass}">${label}${latest.comment ? ' — ' + latest.comment : ''}</div>`;
    }
    document.getElementById('captureFeedback').innerHTML = feedback;

    show('#capture');
  }
}

function shrink(file, maxDim) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round(height * (maxDim / width));
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round(width * (maxDim / height));
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById('cam').onchange = async () => {
  if (!state.subtask) {
    document.getElementById('status').textContent = 'Pick a subtask first.';
    return;
  }
  const file = document.getElementById('cam').files[0];
  if (!file) return;

  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Shrinking…';
  const dataUrl = await shrink(file, 1400);

  statusEl.textContent = 'Uploading…';
  const uploadResult = await upload(file.name, 'image/jpeg', dataUrl);

  if (uploadResult.error) {
    statusEl.textContent = '❌ Upload failed: ' + uploadResult.error;
    console.error('Upload error:', uploadResult.error, uploadResult.stack);
    return;
  }

  const url = uploadResult.url;

  statusEl.textContent = 'Saving…';
  const row = await append('Evidence', {
    subtask_id: state.subtask.id,
    type: 'photo',
    url,
    by_email: state.me.email
  });

  statusEl.textContent = '✅ Uploaded';
  console.log('Evidence row:', row);
};

async function openReview(subtask) {
  const evidence = await read('Evidence');
  const items = evidence.filter(e => e.subtask_id === subtask.id);

  const el = document.getElementById('evidenceList');
  el.innerHTML = items.length === 0
    ? '<p class="nexa-muted">No evidence submitted yet.</p>'
    : items.map(e => `
        <div class="nexa-evidence" style="align-items:flex-start;">
          <div class="nexa-grow">
            <div class="nexa-evidence__label">${e.type} evidence</div>
            <div class="nexa-evidence__meta">By ${e.by_email} · ${new Date(e.created).toLocaleString()}</div>
            ${e.type === 'photo'
              ? `<img src="${e.url}" style="width:100%;border-radius:11px;margin-top:8px;">`
              : `<a href="${e.url}" target="_blank">${e.url}</a>`}
            ${e.note ? `<p class="nexa-muted">${e.note}</p>` : ''}
          </div>
        </div>
      `).join('');

  document.getElementById('reviewActions').innerHTML = `
    <button class="nexa-btn nexa-btn--accent" onclick="decide('accepted')">Accept</button>
    <button class="nexa-btn nexa-btn--danger" onclick="decide('changes')">Request changes</button>
  `;
  document.getElementById('reviewStatus').textContent = '';
  show('#review');
}

async function decide(decision) {
  const statusEl = document.getElementById('reviewStatus');
  const comment = document.getElementById('reviewComment').value.trim();
  statusEl.textContent = 'Saving…';

  const result = await append('Reviews', {
    target_type: 'subtask',
    target_id: state.subtask.id,
    decision,
    comment,
    by_email: state.me.email
  });

  if (result.error) {
    statusEl.textContent = '❌ ' + result.error;
    return;
  }

  statusEl.textContent = decision === 'accepted' ? '✅ Accepted' : '↩️ Changes requested';
  document.getElementById('reviewComment').value = '';
}
