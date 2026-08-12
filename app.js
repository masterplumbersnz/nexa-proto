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
  show('#home');
}

// stay signed in on reload
const saved = localStorage.getItem('nexa.me');
if (saved) {
  state.me = JSON.parse(saved);
  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('welcome').textContent = `Kia ora, ${state.me.name} (${state.me.role})`;
    show('#home');
  });
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
  subtask_id: 'test-subtask',
  type: 'photo',
  url,
  by_email: state.me.email
});

statusEl.textContent = '✅ Uploaded';
console.log('Evidence row:', row);
};
