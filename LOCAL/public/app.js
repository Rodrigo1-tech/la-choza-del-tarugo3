const state = { value: null };
const euro = (value) => `${Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dateLabel = (value) => new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const initials = (name) => name.slice(0, 2).toUpperCase();
const $ = (selector) => document.querySelector(selector);

let socket;
let currentForm = null;

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${protocol}://${location.host}`);
  socket.addEventListener('open', () => { $('#sync-dot').classList.add('online'); $('#sync-text').textContent = 'Sincronizado'; });
  socket.addEventListener('close', () => { $('#sync-dot').classList.remove('online'); $('#sync-text').textContent = 'Sin conexión'; setTimeout(connect, 2500); });
  socket.addEventListener('message', (event) => { const message = JSON.parse(event.data); if (message.type === 'state') { state.value = message.state; render(); } });
}

function send(message) { if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); else showToast('Sin conexión con la choza'); }
function totalOutgoings(data) { return [...data.expenses, ...data.withdrawals, ...data.bills].reduce((sum, item) => sum + Number(item.amount || 0), 0); }
function getBalance(data) { return Number(data.initialBalance || 0) + data.payments.reduce((sum, item) => sum + Number(item.amount || 0), 0) - totalOutgoings(data); }
function render() {
  if (!state.value) return;
  const data = state.value;
  const balance = getBalance(data);
  $('#balance').textContent = euro(balance);
  $('#balance-note').textContent = balance < 0 ? 'Ojo: la choza está en números rojos' : balance === 0 ? 'Aún no hay movimientos' : 'Todo tranquilo por aquí';
  $('#last-updated').textContent = `Actualizado ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  renderMembers(data); renderActivity(data); renderMovements(data); renderBills(data); renderCleaning(data);
}
function renderMembers(data) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const payments = data.payments.filter((item) => (item.date || '').slice(0, 7) === currentMonth);
  const paidNames = new Set(payments.map((item) => item.person));
  $('#member-grid').innerHTML = data.members.map((member) => {
    const payment = payments.find((item) => item.person === member);
    return `<article class="member ${payment ? 'paid' : ''}"><div class="avatar">${initials(member)}</div><div><div class="member-name">${member}</div><div class="member-amount">${payment ? euro(payment.amount) : '—'}</div><div class="member-status">${payment ? 'Pagado este mes' : 'Pendiente'}</div></div></article>`;
  }).join('');
  const total = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  $('#month-total').textContent = euro(total); $('#month-count').textContent = `${paidNames.size} de ${data.members.length} han pagado`; $('#month-progress').style.width = `${(paidNames.size / data.members.length) * 100}%`;
}
function recordLine(item, kind) {
  const label = kind === 'payment' ? `${item.person} ha pagado` : kind === 'bill' ? `${item.name} · recibo` : `${item.person} · ${item.reason}`;
  const amount = kind === 'payment' ? Number(item.amount) : -Number(item.amount);
  return `<div class="activity"><div class="avatar">${kind === 'payment' ? initials(item.person) : kind === 'bill' ? '€' : '↘'}</div><strong>${label}</strong><small>${amount > 0 ? '+' : ''}${euro(amount)}</small></div>`;
}
function renderActivity(data) {
  const records = [
    ...data.payments.map((item) => ({ ...item, kind: 'payment' })),
    ...data.expenses.map((item) => ({ ...item, kind: 'expense' })),
    ...data.withdrawals.map((item) => ({ ...item, kind: 'withdrawal' })),
    ...data.bills.map((item) => ({ ...item, kind: 'bill' }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
  $('#recent-activity').innerHTML = records.length ? records.map((item) => recordLine(item, item.kind)).join('') : '<div class="empty">Todavía no hay actividad.</div>';
}
function renderMovements(data) {
  const records = [...data.expenses.map((item) => ({ ...item, kind: 'expense', label: 'Gasto' })), ...data.withdrawals.map((item) => ({ ...item, kind: 'withdrawal', label: 'Retirada' })), ...data.payments.map((item) => ({ ...item, kind: 'payment', label: 'Aportación' }))].sort((a, b) => new Date(b.date) - new Date(a.date));
  $('#movement-total').textContent = `${records.length} movimiento${records.length === 1 ? '' : 's'}`;
  $('#movement-list').innerHTML = records.length ? records.map((item) => `<div class="movement ${item.kind}"><div class="movement-icon">${item.kind === 'payment' ? '↗' : '↘'}</div><div><div class="movement-title">${item.kind === 'payment' ? item.person : item.reason}</div><div class="movement-meta">${item.label} · ${dateLabel(item.date)}</div></div><div class="movement-amount">${item.kind === 'payment' ? '+' : '-'}${euro(item.amount)}</div><button class="delete" data-remove="${item.kind === 'payment' ? 'payments' : item.kind + 's'}" data-id="${item.id}" title="Eliminar">×</button></div>`).join('') : '<div class="empty">Añade el primer movimiento para empezar.</div>';
}
function renderBills(data) {
  const icons = { Luz: '⌁', Agua: '≈', Alquiler: '⌂' };
  $('#bill-grid').innerHTML = data.bills.length ? data.bills.map((item) => `<article class="bill"><div class="bill-top"><h3>${item.name}</h3><span class="bill-symbol">${icons[item.name] || '€'}</span></div><div class="bill-amount">${euro(item.amount)}</div><small>${dateLabel(item.date)} · ${item.note || 'Sin nota'}</small><button class="delete" data-remove="bills" data-id="${item.id}">×</button></article>`).join('') : '<div class="paper-card empty">Registra aquí luz, agua y alquiler.</div>';
}
function renderCleaning(data) {
  const today = new Date(); const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  $('#week-range').textContent = `${dateLabel(monday)} — ${dateLabel(sunday)}`;
  $('#cleaning-list').innerHTML = data.cleaning.length ? data.cleaning.map((item) => `<div class="cleaning-item ${item.done ? 'done' : ''}"><div class="cleaning-date">${dateLabel(item.date)}</div><div><div class="cleaning-people">${item.people.join(' + ')}</div><div class="cleaning-reason">${item.note || 'Limpieza general'}</div></div><button class="cleaning-check" data-cleaning="${item.id}">${item.done ? '✓' : '○'}</button><button class="delete" data-remove="cleaning" data-id="${item.id}">×</button></div>`).join('') : '<div class="empty">Aún no hay turnos. Organizad el primero.</div>';
}

const fields = {
  payment: { eyebrow: 'Aportación mensual', title: 'Añadir pago', collection: 'payments', html: (data) => `<div class="field"><label>Quién paga</label><select name="person" required>${data.members.map((member) => `<option>${member}</option>`).join('')}</select></div><div class="field"><label>Importe</label><input name="amount" type="number" min="0" step="0.01" placeholder="30" required></div>` },
  expense: { eyebrow: 'Salida de dinero', title: 'Añadir gasto', collection: 'expenses', html: () => `<div class="field"><label>Quién lo ha pagado</label><input name="person" placeholder="Nombre" required></div><div class="field"><label>Para qué</label><input name="reason" placeholder="Compra de material" required></div><div class="field"><label>Importe</label><input name="amount" type="number" min="0" step="0.01" required></div>` },
  withdrawal: { eyebrow: 'Dinero que sale', title: 'Registrar retirada', collection: 'withdrawals', html: (data) => `<div class="field"><label>Quién lo coge</label><select name="person" required>${data.members.map((member) => `<option>${member}</option>`).join('')}</select></div><div class="field"><label>Para qué lo coge</label><input name="reason" placeholder="Comprar hielo" required></div><div class="field"><label>Importe</label><input name="amount" type="number" min="0" step="0.01" required></div>` },
  bill: { eyebrow: 'Gasto fijo', title: 'Añadir recibo', collection: 'bills', html: () => `<div class="field"><label>Tipo de recibo</label><select name="name"><option>Luz</option><option>Agua</option><option>Alquiler</option></select></div><div class="field"><label>Importe</label><input name="amount" type="number" min="0" step="0.01" required></div><div class="field"><label>Nota</label><input name="note" placeholder="Septiembre"></div>` },
  cleaning: { eyebrow: 'Organización', title: 'Nuevo turno', collection: 'cleaning', html: (data) => `<div class="field"><label>Personas</label><select name="people" multiple size="${Math.min(7, data.members.length)}" required>${data.members.map((member) => `<option>${member}</option>`).join('')}</select></div><div class="field"><label>Día</label><input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></div><div class="field"><label>Nota</label><input name="note" placeholder="Limpieza general"></div>` }
};
function openForm(type) { currentForm = fields[type]; $('#form-eyebrow').textContent = currentForm.eyebrow; $('#form-title').textContent = currentForm.title; $('#form-fields').innerHTML = currentForm.html(state.value); $('#entry-dialog').showModal(); }
function closeForm() { $('#entry-dialog').close(); currentForm = null; }
function showToast(text) { const toast = $('#toast'); toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2400); }

document.addEventListener('click', (event) => {
  const tab = event.target.closest('.tab'); if (tab) { document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active')); document.querySelectorAll('.section').forEach((item) => item.classList.remove('active')); tab.classList.add('active'); $(`#section-${tab.dataset.section}`).classList.add('active'); }
  const opener = event.target.closest('[data-open-form]'); if (opener) openForm(opener.dataset.openForm);
  const remove = event.target.closest('[data-remove]'); if (remove && confirm('¿Eliminar este registro?')) send({ type: 'remove', collection: remove.dataset.remove, id: remove.dataset.id });
  const cleaning = event.target.closest('[data-cleaning]'); if (cleaning) { const item = state.value.cleaning.find((record) => record.id === cleaning.dataset.cleaning); if (item) send({ type: 'remove', collection: 'cleaning', id: item.id }); if (item) send({ type: 'add', collection: 'cleaning', record: { ...item, done: !item.done, id: undefined } }); }
});
$('#entry-form').addEventListener('submit', (event) => { event.preventDefault(); const formData = new FormData(event.target); const record = Object.fromEntries(formData.entries()); record.amount = Number(record.amount || 0); record.date = record.date || new Date().toISOString(); if (currentForm.collection === 'cleaning') record.people = formData.getAll('people'); send({ type: 'add', collection: currentForm.collection, record }); closeForm(); showToast('Guardado y compartido con la cuadrilla'); });
$('#close-dialog').addEventListener('click', closeForm); $('#cancel-dialog').addEventListener('click', closeForm);
$('#initial-balance-button').addEventListener('click', () => { const value = prompt('¿Cuál es el saldo inicial de la choza?', state.value ? state.value.initialBalance : 0); if (value !== null) send({ type: 'setInitialBalance', value }); });
connect();