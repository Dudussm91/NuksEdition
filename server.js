const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ AUMENTA O LIMITE DE TAMANHO DO CORPO DA REQUISIÇÃO
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

// ✅ SERVE ARQUIVOS ESTÁTICOS (CSS, JS, IMAGENS, HTML) — NÃO MEXA AQUI!
app.use(express.static('public'));

// ✅ LISTA DE PÁGINAS QUE EXIGEM LOGIN
const paginasProtegidas = [
    '/home.html',
    '/amigos.html',
    '/chat.html',
    '/noticias.html',
    '/configuracoes.html',
    '/explorar.html'
];

// ✅ INTERCEPTA REQUISIÇÕES PARA PÁGINAS PROTEGIDAS (SEM BARRA NO FINAL)
paginasProtegidas.forEach(pagina => {
    app.get(pagina, (req, res) => {
        const loggedUser = localStorage.getItem('loggedUser'); // <-- ISSO NÃO FUNCIONA NO SERVER!
        // ✅ Vamos corrigir isso: verificamos via header enviado pelo script.js
        const userHeader = req.headers['x-logged-user'];
        const isUserLoggedIn = userHeader && global.users && global.users.has(userHeader);

        if (!isUserLoggedIn) {
            // ✅ Redireciona para login com uma mensagem
            return res.redirect('/login.html?error=login_required');
        } else {
            // ✅ Entrega o arquivo normalmente
            res.sendFile(path.join(__dirname, 'public', pagina.replace('/', '')));
        }
    });

    // ✅ TRATA TAMBÉM A VERSÃO COM BARRA NO FINAL (ex: /home.html/)
    app.get(pagina + '/', (req, res) => {
        res.redirect(pagina); // Redireciona para a versão sem barra
    });
});

// Estruturas de dados em memória
const users = new Map();
const pendingCodes = new Map();
const pendingFriendRequests = new Map();
const friendships = new Map();
let news = [];
const deleteCodes = new Map();

// ✅ Torna 'users' global para ser acessado nas rotas protegidas
global.users = users;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'nukseditionofc@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

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
            text: `Olá, ${nome}!
Seu código de confirmação é: ${codigo}
Guarde esse código — você precisará dele para ativar sua conta.
Atenciosamente,
Equipe NuksEdition`
        });
        pendingCodes.set(email, { codigo, nome, senha, timestamp: Date.now() });
        res.status(200).json({ message: 'Código enviado com sucesso para seu e-mail!' });
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error.message);
        res.status(500).json({ error: 'Erro ao enviar e-mail. Verifique a senha de app do Gmail.' });
    }
});

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
        message: 'Código confirmado!',
        nome: pending.nome
    });
});

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
// SISTEMA DE NOTÍCIAS
// =============

app.get('/api/noticias', (req, res) => {
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
            text: `Olá!
Você solicitou a exclusão da sua conta.
Seu código de confirmação é: ${codigo}
Se você não solicitou isso, ignore este e-mail.
Atenciosamente,
Equipe NuksEdition`
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
// SISTEMA DE CHAT
// =============

app.post('/api/obter-usuario', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'E-mail não fornecido.' });
    }
    const user = users.get(email);
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.status(200).json({ nome: user.nome });
});

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

app.listen(PORT, () => {
    console.log(`🚀 Servidor NuksEdition rodando em http://localhost:${PORT}`);
    console.log(`✉️  Bot de e-mail ativo — pronto para enviar códigos reais!`);
    console.log(`🔐 Para usar o Gmail, configure a variável de ambiente: GMAIL_APP_PASSWORD`);
});
