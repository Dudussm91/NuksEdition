const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000; // Render usa a porta 10000 por padrão

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

app.use(express.json());
app.use(express.static('public'));

// ✅ DADOS NO SERVIDOR (CLOUD)
const users = new Map();
const pendingCodes = new Map();
const pendingFriendRequests = new Map();
const friendships = new Map();
let news = [];
const deleteCodes = new Map();

// ✅ ROTA RAIZ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// =============
// CADASTRO (SIMULADO)
// =============
app.post('/api/cadastrar', (req, res) => {
    const { nome, email, senha, codigo } = req.body;

    if (!nome || !email || !senha || !codigo) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    if (users.has(email)) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado!' });
    }

    // ✅ SIMULA ENVIO DE CÓDIGO (MOSTRA NO CONSOLE)
    console.log(`[SIMULADO] Seu código de confirmação é: ${codigo} (para o e-mail: ${email})`);

    pendingCodes.set(email, { codigo, nome, senha, timestamp: Date.now() });
    res.status(200).json({ message: 'Cadastro iniciado com sucesso! Verifique o console do servidor para o código.' });
});

// =============
// CONFIRMAÇÃO DE CÓDIGO
// =============
app.post('/api/confirmar-codigo', (req, res) => {
    const { email, codigo } = req.body;

    if (!email || !codigo) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    const pending = pendingCodes.get(email);
    if (!pending) {
        return res.status(400).json({ error: 'Nenhum cadastro pendente.' });
    }

    if (pending.codigo !== codigo) {
        return res.status(400).json({ error: 'Código incorreto.' });
    }

    users.set(email, { nome: pending.nome, senha: pending.senha });
    friendships.set(email, new Set());
    pendingFriendRequests.set(email, []);
    pendingCodes.delete(email);

    res.status(200).json({
        message: 'Conta ativada com sucesso!',
        nome: pending.nome
    });
});

// =============
// LOGIN
// =============
app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ error: 'Preencha e-mail e senha!' });
    }

    const user = users.get(email);
    if (!user) {
        return res.status(400).json({ error: 'E-mail não cadastrado!' });
    }

    if (user.senha !== senha) {
        return res.status(400).json({ error: 'Senha incorreta!' });
    }

    res.status(200).json({
        message: 'Login bem-sucedido!',
        nome: user.nome
    });
});

// =============
// SISTEMA DE AMIGOS
// =============

app.post('/api/adicionar-amigo', (req, res) => {
    const { loggedUser, friendEmail } = req.body;

    if (!loggedUser || !friendEmail) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    if (loggedUser === friendEmail) {
        return res.status(400).json({ error: 'Você não pode adicionar sua própria conta.' });
    }

    if (!users.has(friendEmail)) {
        return res.status(400).json({ error: 'Este usuário não existe.' });
    }

    if (friendships.get(loggedUser)?.has(friendEmail)) {
        return res.status(400).json({ error: 'Vocês já são amigos!' });
    }

    let pendingList = pendingFriendRequests.get(friendEmail) || [];
    if (pendingList.includes(loggedUser)) {
        return res.status(400).json({ error: 'Convite já enviado. Aguarde a resposta.' });
    }

    pendingList.push(loggedUser);
    pendingFriendRequests.set(friendEmail, pendingList);

    res.status(200).json({ message: 'Convite de amizade enviado com sucesso!' });
});

app.post('/api/convites-pendentes', (req, res) => {
    const { loggedUser } = req.body;

    if (!loggedUser) {
        return res.status(400).json({ error: 'Usuário não autenticado.' });
    }

    const pendingList = pendingFriendRequests.get(loggedUser) || [];

    const invites = pendingList.map(email => {
        const user = users.get(email);
        return {
            email: email,
            nome: user ? user.nome : email
        };
    });

    res.status(200).json({ invites: invites });
});

app.post('/api/aceitar-amizade', (req, res) => {
    const { loggedUser, inviterEmail } = req.body;

    if (!loggedUser || !inviterEmail) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    let pendingList = pendingFriendRequests.get(loggedUser) || [];
    pendingList = pendingList.filter(email => email !== inviterEmail);
    pendingFriendRequests.set(loggedUser, pendingList);

    if (!friendships.has(loggedUser)) friendships.set(loggedUser, new Set());
    if (!friendships.has(inviterEmail)) friendships.set(inviterEmail, new Set());

    friendships.get(loggedUser).add(inviterEmail);
    friendships.get(inviterEmail).add(loggedUser);

    res.status(200).json({ message: 'Amizade confirmada com sucesso!' });
});

app.post('/api/meus-amigos', (req, res) => {
    const { loggedUser } = req.body;

    if (!loggedUser) {
        return res.status(400).json({ error: 'Usuário não autenticado.' });
    }

    const friendEmails = Array.from(friendships.get(loggedUser) || []);

    const friends = friendEmails.map(email => {
        const user = users.get(email);
        return {
            email: email,
            nome: user ? user.nome : email
        };
    });

    res.status(200).json({ friends: friends });
});

app.post('/api/remover-amigo', (req, res) => {
    const { loggedUser, friendEmail } = req.body;

    if (!loggedUser || !friendEmail) {
        return res.status(400).json({ error: 'Dados incompletos.' });
    }

    if (friendships.has(loggedUser)) {
        const friends = friendships.get(loggedUser);
        friends.delete(friendEmail);
    }

    if (friendships.has(friendEmail)) {
        const friends = friendships.get(friendEmail);
        friends.delete(loggedUser);
    }

    res.status(200).json({ message: 'Amigo removido com sucesso.' });
});

// =============
// SISTEMA DE CHAT (FUNCIONA NA INTERNET!)
// =============

app.post('/api/enviar-mensagem', (req, res) => {
    const { sender, receiver, text } = req.body;

    if (!sender || !receiver || !text) {
        return res.status(400).json({ error: 'Dados incompletos.' });
    }

    if (!users.has(sender) || !users.has(receiver)) {
        return res.status(400).json({ error: 'Remetente ou destinatário não existe.' });
    }

    const chatKey = [sender, receiver].sort().join('_');

    if (!global.chats) global.chats = {};
    if (!global.chats[chatKey]) global.chats[chatKey] = [];

    global.chats[chatKey].push({
        sender: sender,
        text: text,
        timestamp: Date.now()
    });

    res.status(200).json({ message: 'Mensagem enviada com sucesso.' });
});

app.post('/api/carregar-mensagens', (req, res) => {
    const { loggedUser, friendEmail } = req.body;

    if (!loggedUser || !friendEmail) {
        return res.status(400).json({ error: 'Dados incompletos.' });
    }

    const chatKey = [loggedUser, friendEmail].sort().join('_');

    if (!global.chats) global.chats = {};
    const messages = global.chats[chatKey] || [];

    res.status(200).json({ messages: messages });
});

// =============
// INICIA O SERVIDOR
// =============
app.listen(PORT, () => {
    console.log(`🚀 Servidor NuksEdition rodando em http://localhost:${PORT}`);
    console.log(`✅ Tudo salvo no servidor (cloud) — funciona na internet!`);
    console.log(`✅ Para se cadastrar, veja o console para o código de confirmação.`);
});
