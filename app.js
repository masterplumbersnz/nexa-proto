let state = { me: null };

        function show(id) {
            document.querySelectorAll('section').forEach(s => s.hidden = true);
            document.querySelector(id).hidden = false;
        }

        async function signIn() {
            const entered = document.getElementById('emailInput').value;
            const people = await read('People');
            const me = people.find(p => p.email.toLowerCase() === entered.trim().toLowerCase());
            if (!me) { document.getElementById('notInvited').hidden = false; return; }
            state.me = me;
            localStorage.setItem('nexa.me', JSON.stringify(me));
            document.getElementById('welcome').textContent = `Kia ora, ${me.name} (${me.role})`;
            await loadProjects();
            show('#home');
        }

        // stay signed in on reload
        const saved = localStorage.getItem('nexa.me');
        if (saved) {
            state.me = JSON.parse(saved);
            window.addEventListener('DOMContentLoaded', async () => {
                document.getElementById('welcome').textContent = `Kia ora, ${state.me.name} (${state.me.role})`;
                await loadProjects();
                show('#home');
            });
        }

        // keep the current selection in state as we drill down
        state.project = null;
        state.task = null;
        state.subtask = null;

        async function loadProjects() {
            const projects = await read('Projects');
            const mine = projects.filter(p => p.learner_email.toLowerCase() === state.me.email.toLowerCase());

            const el = document.getElementById('projectList');
            if (mine.length === 0) {
                el.innerHTML = '<p>No projects assigned yet.</p>';
                return;
            }
            el.innerHTML = mine.map(p => `
    <button onclick="openProject('${p.id}')">${p.title} — ${p.status || 'not started'}</button>
  `).join('');
            state.projects = mine; // cache for lookups
        }

        async function openProject(projectId) {
            state.project = state.projects.find(p => p.id === projectId);
            document.getElementById('projectTitle').textContent = state.project.title;

            const tasks = await read('Tasks');
            state.tasks = tasks.filter(t => t.project_id === projectId)
                .sort((a, b) => (a.sort || 0) - (b.sort || 0));

            const el = document.getElementById('taskList');
            if (state.tasks.length === 0) {
                el.innerHTML = '<p>No tasks on this project yet.</p>';
            } else {
                el.innerHTML = state.tasks.map(t => `
      <button onclick="openTask('${t.id}')">${t.title}</button>
    `).join('');
            }
            show('#tasks');
        }

        async function openTask(taskId) {
            state.task = state.tasks.find(t => t.id === taskId);
            document.getElementById('taskTitle').textContent = state.task.title;

            const subtasks = await read('Subtasks');
            state.subtasks = subtasks.filter(s => s.task_id === taskId);

            const el = document.getElementById('subtaskList');
            if (state.subtasks.length === 0) {
                el.innerHTML = '<p>No subtasks here yet.</p>';
            } else {
                el.innerHTML = state.subtasks.map(s => `
      <button onclick="openSubtask('${s.id}')">${s.title} <small>(needs: ${s.requires})</small></button>
    `).join('');
            }
            show('#subtasks');
        }

        function openSubtask(subtaskId) {
            state.subtask = state.subtasks.find(s => s.id === subtaskId);
            document.getElementById('captureTitle').textContent = 'Add evidence: ' + state.subtask.title;
            document.getElementById('status').textContent = '';
            show('#capture');
        }
        // Resize an image file down to maxDim on its longest edge, return a JPEG data URL
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
            const { url } = await upload(file.name, 'image/jpeg', dataUrl);

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
