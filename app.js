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
