const API = 'https://script.google.com/macros/s/AKfycbzIor9-6dIkRoWNVbGfdpGaqIjYRvswDJDRfeMTbkGcBKsbeoQHHz7tjPVnvA9RousF2g/exec';
const TOKEN = 'nexa-pilot-2026';

async function call(payload) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // dodges CORS preflight
    body: JSON.stringify(Object.assign({ token: TOKEN }, payload))
  });
  return res.json();
}

const read   = (tab)            => call({ action: 'read',   tab });
const append = (tab, row)       => call({ action: 'append', tab, row });
const patch  = (tab, id, patch) => call({ action: 'update', tab, id, patch });
const upload = (name, mime, dataUrl) =>
  call({ action: 'upload', name, mime, dataUrl });
