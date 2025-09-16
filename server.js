const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

app.use(express.json());
app.use(express.static('public'));

// ✅ DADOS NO SERVIDOR
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

// ✅ CONFIGURAÇÃO DO NODemailer (ENVIA E-MAIL REAL)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'nukseditionofc@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD // <-- USA A SENHA DE APP DO GMAIL
    }
});

// =============
// CADASTRO (ENVIA E-MAIL REAL)
// =============
app.post('/api/cadastrar', async (req, res) => {
    const { nome, email, senha, codigo } = req.body;

    if (!nome || !email || !senha || !codigo) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    if (users.has(email)) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado!' });
    }

    try {
        // ✅ ENVIA E-MAIL REAL PARA O GMAIL DA PESSOA
        await transporter.sendMail({
            from: '"NuksEdition Bot" <nukseditionofc@gmail.com>',
            to: email,
            subject: 'Seu código de confirmação - NuksEdition',
            text: `Olá, ${nome}!\n\nSeu código de confirmação é: ${codigo}\n\nGuarde esse código — você precisará dele para ativar sua conta.\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        pendingCodes.set(email, { codigo, nome, senha, timestamp: Date.now() });
        res.status(200).json({ message: 'Código enviado com sucesso para seu e-mail!' });
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error.message);
        res.status(500).json({ error: 'Erro ao enviar e-mail. Verifique a senha de app do Gmail.' });
    }
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
// SISTEMA DE CHAT
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
// EXCLUSÃO DE CONTA (ENVIA E-MAIL REAL)
// =============

app.post('/api/enviar-codigo-exclusao', async (req, res) => {
    const { email, codigo } = req.body;

    if (!email || !codigo) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    if (!users.has(email)) {
        return res.status(400).json({ error: 'Usuário não encontrado.' });
    }

    try {
        // ✅ ENVIA E-MAIL REAL PARA O GMAIL DA PESSOA
        await transporter.sendMail({
            from: '"NuksEdition Bot" <nukseditionofc@gmail.com>',
            to: email,
            subject: 'Código de Exclusão de Conta - NuksEdition',
            text: `Olá!\n\nVocê solicitou a exclusão da sua conta.\n\nSeu código de confirmação é: ${codigo}\n\nSe você não solicitou isso, ignore este e-mail.\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        deleteCodes.set(email, codigo);
        res.status(200).json({ message: 'Código de exclusão enviado com sucesso para seu e-mail!' });
    } catch (error) {
        console.error('Erro ao enviar código de exclusão:', error.message);
        res.status(500).json({ error: 'Erro ao enviar e-mail. Verifique a senha de app do Gmail.' });
    }
});

app.post('/api/excluir-conta', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'E-mail não fornecido.' });
    }

    if (!users.has(email)) {
        return res.status(404).json({ error: 'Conta não encontrada.' });
    }

    users.delete(email);
    friendships.delete(email);
    pendingFriendRequests.delete(email);

    res.status(200).json({ message: 'Conta excluída com sucesso.' });
});

// =============
// INICIA O SERVIDOR
// =============
app.listen(PORT, () => {
    console.log(`🚀 Servidor NuksEdition rodando em http://localhost:${PORT}`);
    console.log(`✉️  Bot de e-mail REAL ativo — enviando códigos para o Gmail dos usuários!`);
});
