const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const defaultState = {
	initialBalance: 0,
	members: ['Alba', 'Miki', 'Viti', 'Use', 'Teje', 'Pipi', 'Pollete'],
	payments: [], expenses: [], withdrawals: [], bills: [], cleaning: []
};

function readState() {
	try {
		return { ...defaultState, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
	} catch {
		fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState, null, 2));
		return { ...defaultState };
	}
}

let state = readState();
function saveState() { fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2)); }
function sendState(socket) {
	if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'state', state }));
}
function broadcast() { wss.clients.forEach(sendState); }
function addRecord(collection, record) {
	if (!Array.isArray(state[collection])) return;
	state[collection].unshift({ ...record, id: `${Date.now()}-${Math.random().toString(16).slice(2)}` });
	saveState(); broadcast();
}
function removeRecord(collection, id) {
	if (!Array.isArray(state[collection])) return;
	state[collection] = state[collection].filter((record) => record.id !== id);
	saveState(); broadcast();
}

const server = http.createServer((request, response) => {
	const requested = request.url === '/' ? '/index.html' : request.url.split('?')[0];
	const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
	if (!filePath.startsWith(PUBLIC_DIR)) { response.writeHead(403); response.end('Forbidden'); return; }
	const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
	fs.readFile(filePath, (error, content) => {
		if (error) { response.writeHead(404); response.end('Not found'); return; }
		response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
		response.end(content);
	});
});

const wss = new WebSocketServer({ server });
wss.on('connection', (socket) => {
	sendState(socket);
	socket.on('message', (raw) => {
		try {
			const message = JSON.parse(raw.toString());
			if (message.type === 'add') addRecord(message.collection, message.record);
			else if (message.type === 'remove') removeRecord(message.collection, message.id);
			else if (message.type === 'setInitialBalance') {
				state.initialBalance = Number(message.value) || 0;
				saveState(); broadcast();
			}
		} catch (error) { console.error('Mensaje inválido:', error.message); }
	});
});

server.listen(PORT, '0.0.0.0', () => {
	console.log(`La Choza del Tarugo disponible en http://localhost:${PORT}`);
	console.log('Para móviles en la misma red, usa la IP local de este equipo.');
});
