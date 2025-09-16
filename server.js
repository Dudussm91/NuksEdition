const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ FORÇA CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

app.use(express.json());
app.use(express.static('public'));

// ✅ ARMAZENA DADOS NO SERVIDOR (NÃO NO localStorage)
const users = new Map(); // { email: { nome, senha } }
const pendingCodes = new Map(); // { email: { codigo, nome, senha, timestamp } }
const friends = new Map(); // { email: [amigo1, amigo2] }

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'nukseditionofc@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

// ✅ ROTA PARA CADASTRO
app.post('/api/cadastrar', async (req, res) => {
    const { nome, email, senha, codigo } = req.body;

    if (!nome || !email || !senha || !codigo) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    // ✅ VERIFICA SE JÁ EXISTE
    if (users.has(email)) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado!' });
    }

    try {
        await transporter.sendMail({
            from: '"NuksEdition Bot" <nukseditionofc@gmail.com>',
            to: email,
            subject: 'Seu código de confirmação - NuksEdition',
            text: `Olá!\n\nSeu código de confirmação é: ${codigo}\n\nGuarde esse código — você precisará dele para ativar sua conta.\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        // ✅ SALVA DADOS NO SERVIDOR
        pendingCodes.set(email, { codigo, nome, senha, timestamp: Date.now() });
        res.status(200).json({ message: 'E-mail enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error.message);
        res.status(500).json({ error: 'Erro ao enviar e-mail: ' + error.message });
    }
});

// ✅ ROTA PARA CONFIRMAR CÓDIGO
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

    // ✅ SALVA CONTA NO SERVIDOR
    users.set(email, { nome: pending.nome, senha: pending.senha });
    pendingCodes.delete(email);

    // ✅ INICIALIZA LISTA DE AMIGOS
    if (!friends.has(email)) {
        friends.set(email, []);
    }

    res.status(200).json({
        message: 'Código confirmado!',
        nome: pending.nome
    });
});

// ✅ ROTA PARA LOGIN
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

// ✅ ROTA PARA VERIFICAR SE USUÁRIO ESTÁ LOGADO
app.post('/api/check-login', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'E-mail não fornecido' });
    }

    const user = users.get(email);
    if (!user) {
        return res.status(400).json({ error: 'Usuário não encontrado' });
    }

    res.status(200).json({ nome: user.nome });
});

// ✅ ROTA PARA ADICIONAR AMIGO
app.post('/api/adicionar-amigo', (req, res) => {
    const { loggedUser, friendEmail } = req.body;

    if (!loggedUser || !friendEmail) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    if (loggedUser === friendEmail) {
        return res.status(400).json({ error: 'Você não pode adicionar a si mesmo.' });
    }

    const friend = users.get(friendEmail);
    if (!friend) {
        return res.status(400).json({ error: 'Este usuário não existe.' });
    }

    // ✅ ADICIONA CONVITE
    const pendingKey = `pending_${friendEmail}`;
    let pending = [];
    if (global[pendingKey]) {
        pending = global[pendingKey];
    }
    if (!pending.includes(loggedUser)) {
        pending.push(loggedUser);
        global[pendingKey] = pending;
    }

    res.status(200).json({ message: 'Amizade adicionada com sucesso!' });
});

// ✅ ROTA PARA CARREGAR CONVITES PENDENTES
app.post('/api/convites-pendentes', (req, res) => {
    const { loggedUser } = req.body;

    if (!loggedUser) {
        return res.status(400).json({ error: 'Usuário não fornecido' });
    }

    const pendingKey = `pending_${loggedUser}`;
    const pending = global[pendingKey] || [];

    const invites = pending.map(inviterEmail => {
        const inviter = users.get(inviterEmail);
        return {
            email: inviterEmail,
            nome: inviter ? inviter.nome : inviterEmail
        };
    });

    res.status(200).json({ invites });
});

// ✅ ROTA PARA ACEITAR AMIZADE
app.post('/api/aceitar-amizade', (req, res) => {
    const { loggedUser, inviterEmail } = req.body;

    if (!loggedUser || !inviterEmail) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    // ✅ ADICIONA AMIZADE PARA AMBOS
    if (!friends.has(loggedUser)) friends.set(loggedUser, []);
    if (!friends.has(inviterEmail)) friends.set(inviterEmail, []);

    const myFriends = friends.get(loggedUser);
    const inviterFriends = friends.get(inviterEmail);

    if (!myFriends.includes(inviterEmail)) {
        myFriends.push(inviterEmail);
    }
    if (!inviterFriends.includes(loggedUser)) {
        inviterFriends.push(loggedUser);
    }

    // ✅ REMOVE CONVITE
    const pendingKey = `pending_${loggedUser}`;
    if (global[pendingKey]) {
        global[pendingKey] = global[pendingKey].filter(email => email !== inviterEmail);
    }

    res.status(200).json({ message: 'Amizade confirmada!' });
});

// ✅ ROTA PARA CARREGAR AMIGOS
app.post('/api/meus-amigos', (req, res) => {
    const { loggedUser } = req.body;

    if (!loggedUser) {
        return res.status(400).json({ error: 'Usuário não fornecido' });
    }

    const myFriends = friends.get(loggedUser) || [];
    const friendsList = myFriends.map(friendEmail => {
        const friend = users.get(friendEmail);
        return {
            email: friendEmail,
            nome: friend ? friend.nome : friendEmail
        };
    });

    res.status(200).json({ friends: friendsList });
});

app.post('/api/enviar-codigo-exclusao', async (req, res) => {
    const { email, codigo } = req.body;

    if (!email || !codigo) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    try {
        await transporter.sendMail({
            from: '"NuksEdition Bot" <nukseditionofc@gmail.com>',
            to: email,
            subject: 'Código de Exclusão de Conta - NuksEdition',
            text: `Olá!\n\nVocê solicitou a exclusão da sua conta.\n\nSeu código de confirmação é: ${codigo}\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        res.status(200).json({ message: 'Código enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar código de exclusão:', error.message);
        res.status(500).json({ error: 'Erro ao enviar código: ' + error.message });
    }
});

app.get('/api/test', (req, res) => {
    res.status(200).json({ message: 'Servidor está funcionando!' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`✉️ Bot de e-mail ativo — pronto para enviar códigos reais!`);
});
