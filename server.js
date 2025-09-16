const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');

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

// ✅ ARMAZENA DADOS NO SERVIDOR
const users = new Map(); // { email: { nome, senha } }
const pendingCodes = new Map(); // { email: { codigo, nome, senha, timestamp } }

// ✅ DADOS PARA SISTEMA DE AMIGOS
const pendingFriendRequests = new Map(); // { destinatarioEmail: [array de remetenteEmail] }
const friendships = new Map(); // { email: new Set([array de amigos]) }

// ✅ DADOS PARA SISTEMA DE NOTÍCIAS
let news = []; // Array de objetos de notícias

// ✅ DADOS PARA EXCLUSÃO DE CONTA
const deleteCodes = new Map(); // { email: codigo }

// ✅ ROTA RAIZ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ✅ CONFIGURAÇÃO DO NODemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'nukseditionofc@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD // ⚠️ Configure esta variável de ambiente!
    }
});

// =============
// CADASTRO
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
        await transporter.sendMail({
            from: '"NuksEdition Bot" <nukseditionofc@gmail.com>',
            to: email,
            subject: 'Seu código de confirmação - NuksEdition',
            text: `Olá!\n\nSeu código de confirmação é: ${codigo}\n\nGuarde esse código — você precisará dele para ativar sua conta.\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        pendingCodes.set(email, { codigo, nome, senha, timestamp: Date.now() });
        res.status(200).json({ message: 'E-mail enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error.message);
        res.status(500).json({ error: 'Erro ao enviar e-mail: ' + error.message });
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
    // Inicializa listas de amigos
    friendships.set(email, new Set());
    pendingFriendRequests.set(email, []);
    pendingCodes.delete(email);

    res.status(200).json({
        message: 'Código confirmado!',
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

// Adicionar Amigo
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

// Carregar Convites Pendentes
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

// Aceitar Amizade
app.post('/api/aceitar-amizade', (req, res) => {
    const { loggedUser, inviterEmail } = req.body;

    if (!loggedUser || !inviterEmail) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    // Remove da lista de pendentes
    let pendingList = pendingFriendRequests.get(loggedUser) || [];
    pendingList = pendingList.filter(email => email !== inviterEmail);
    pendingFriendRequests.set(loggedUser, pendingList);

    // Adiciona à lista de amigos de ambos
    if (!friendships.has(loggedUser)) friendships.set(loggedUser, new Set());
    if (!friendships.has(inviterEmail)) friendships.set(inviterEmail, new Set());

    friendships.get(loggedUser).add(inviterEmail);
    friendships.get(inviterEmail).add(loggedUser);

    res.status(200).json({ message: 'Amizade confirmada com sucesso!' });
});

// =============
// SISTEMA DE NOTÍCIAS
// =============

app.get('/api/noticias', (req, res) => {
    // Retorna todas as notícias, ordenadas por ID (mais recente primeiro)
    const sortedNews = [...news].sort((a, b) => b.id - a.id);
    res.status(200).json({ noticias: sortedNews });
});

app.post('/api/noticias', (req, res) => {
    const { title, description, image, loggedUser } = req.body;

    const admins = ['eduardomarangoni36@gmail.com', 'nukseditionofc@gmail.com'];
    if (!admins.includes(loggedUser)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem publicar.' });
    }

    if (!title || !description || !image) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    const novaNoticia = {
        id: Date.now().toString(),
        title,
        description,
        image,
        date: new Date().toLocaleDateString('pt-BR'),
        author: loggedUser
    };

    news.push(novaNoticia);
    res.status(201).json({ message: 'Notícia publicada com sucesso!', noticia: novaNoticia });
});

app.delete('/api/noticias/:id', (req, res) => {
    const { id } = req.params;
    const { loggedUser } = req.body;

    const admins = ['eduardomarangoni36@gmail.com', 'nukseditionofc@gmail.com'];
    if (!admins.includes(loggedUser)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem excluir.' });
    }

    const tamanhoAnterior = news.length;
    news = news.filter(n => n.id !== id);

    if (news.length === tamanhoAnterior) {
        return res.status(404).json({ error: 'Notícia não encontrada.' });
    }

    res.status(200).json({ message: 'Notícia excluída com sucesso!' });
});

// =============
// EXCLUSÃO DE CONTA
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
        await transporter.sendMail({
            from: '"NuksEdition Bot" <nukseditionofc@gmail.com>',
            to: email,
            subject: 'Código de Exclusão de Conta - NuksEdition',
            text: `Olá!\n\nVocê solicitou a exclusão da sua conta.\n\nSeu código de confirmação é: ${codigo}\n\nSe você não solicitou isso, ignore este e-mail.\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        deleteCodes.set(email, codigo);
        res.status(200).json({ message: 'Código de exclusão enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar código de exclusão:', error.message);
        res.status(500).json({ error: 'Erro ao enviar e-mail: ' + error.message });
    }
});

// =============
// INICIA O SERVIDOR
// =============
app.listen(PORT, () => {
    console.log(`🚀 Servidor NuksEdition rodando em http://localhost:${PORT}`);
    console.log(`✉️  Bot de e-mail ativo — pronto para enviar códigos reais!`);
    console.log(`🔐 Para usar o Gmail, configure a variável de ambiente: GMAIL_APP_PASSWORD`);
});

// =============
// EXCLUSÃO DE CONTA (FINAL)
// =============
app.post('/api/excluir-conta', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'E-mail não fornecido.' });
    }

    if (!users.has(email)) {
        return res.status(404).json({ error: 'Conta não encontrada.' });
    }

    // Remove o usuário
    users.delete(email);

    // Remove amigos e convites
    friendships.delete(email);
    pendingFriendRequests.delete(email);

    res.status(200).json({ message: 'Conta excluída com sucesso.' });
});
