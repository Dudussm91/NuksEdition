const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs'); // ✅ Adicionado para salvar/carregar o banco

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

// ✅ Serve arquivos públicos SEM verificação (login, cadastro, confirmar, CSS, JS, imagens)
app.use('/login.html', express.static('public'));
app.use('/cadastro.html', express.static('public'));
app.use('/confirmar.html', express.static('public'));
app.use('/style.css', express.static('public'));
app.use('/script.js', express.static('public'));
app.use('/images', express.static('public'));

// Estruturas de dados em memória
const users = new Map();
const pendingCodes = new Map();
const pendingFriendRequests = new Map();
const friendships = new Map();
let news = [];
const deleteCodes = new Map();

// ✅ Estrutura para mensagens de chat
if (!global.chats) global.chats = {};

// ✅ Função para salvar o banco de dados em um arquivo
function saveDatabase() {
    const data = {
        users: Array.from(users.entries()).map(([email, userData]) => ({
            email,
            nome: userData.nome,
            senha: userData.senha,
            createdAt: userData.createdAt // ✅ Salva a data de criação
        })),
        pendingCodes: Array.from(pendingCodes.entries()).map(([email, data]) => ({
            email,
            codigo: data.codigo,
            nome: data.nome,
            senha: data.senha,
            timestamp: data.timestamp
        })),
        pendingFriendRequests: Array.from(pendingFriendRequests.entries()).map(([email, requests]) => ({
            email,
            requests: requests
        })),
        friendships: Array.from(friendships.entries()).map(([email, friendsSet]) => ({
            email,
            friends: Array.from(friendsSet)
        })),
        news: news,
        deleteCodes: Array.from(deleteCodes.entries()).map(([email, codigo]) => ({
            email,
            codigo
        })),
        chats: global.chats // ✅ Salva as mensagens de chat
    };
    fs.writeFileSync('database.json', JSON.stringify(data, null, 2), 'utf8');
    console.log('✅ Banco de dados salvo em database.json');
}

// ✅ Função para carregar o banco de dados do arquivo
function loadDatabase() {
    try {
        if (!fs.existsSync('database.json')) {
            console.log('ℹ️  Nenhum arquivo database.json encontrado. Iniciando com banco de dados vazio.');
            return;
        }

        const rawData = fs.readFileSync('database.json', 'utf8');
        const data = JSON.parse(rawData);

        // Recarrega 'users'
        users.clear();
        data.users.forEach(user => {
            users.set(user.email, { 
                nome: user.nome, 
                senha: user.senha,
                createdAt: user.createdAt // ✅ Carrega a data de criação
            });
        });

        // Recarrega 'pendingCodes'
        pendingCodes.clear();
        data.pendingCodes.forEach(item => {
            pendingCodes.set(item.email, {
                codigo: item.codigo,
                nome: item.nome,
                senha: item.senha,
                timestamp: item.timestamp
            });
        });

        // Recarrega 'pendingFriendRequests'
        pendingFriendRequests.clear();
        data.pendingFriendRequests.forEach(item => {
            pendingFriendRequests.set(item.email, item.requests);
        });

        // Recarrega 'friendships'
        friendships.clear();
        data.friendships.forEach(item => {
            friendships.set(item.email, new Set(item.friends));
        });

        // Recarrega 'news'
        news = data.news || [];

        // Recarrega 'deleteCodes'
        deleteCodes.clear();
        data.deleteCodes.forEach(item => {
            deleteCodes.set(item.email, item.codigo);
        });

        // Recarrega 'chats'
        global.chats = data.chats || {};

        console.log('✅ Banco de dados carregado com sucesso de database.json');
    } catch (error) {
        console.error('❌ Erro ao carregar o banco de dados:', error.message);
        console.log('⚠️  Iniciando com banco de dados vazio.');
    }
}

// ✅ Carrega o banco de dados assim que o servidor inicia
loadDatabase();

// ✅ Garante que o arquivo database.json exista após um deploy limpo
if (!fs.existsSync('database.json')) {
    saveDatabase(); // Cria um arquivo vazio na primeira inicialização
}

// ✅ Rotas protegidas — exigem login
const paginasProtegidas = ['home.html', 'amigos.html', 'chat.html', 'noticias.html', 'configuracoes.html', 'explorar.html'];
paginasProtegidas.forEach(pagina => {
    app.get(`/${pagina}`, (req, res) => {
        // Verifica se o usuário está logado via header
        const loggedUserEmail = req.headers['x-logged-user'];
        const isUserLoggedIn = loggedUserEmail && users.has(loggedUserEmail);

        if (!isUserLoggedIn) {
            // ✅ Envia uma página HTML com a mensagem solicitada
            res.status(403).send(`
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Acesso Negado</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            background: #f0f2f5;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                        }
                        .message-box {
                            background: white;
                            padding: 40px;
                            border-radius: 15px;
                            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                            text-align: center;
                            max-width: 400px;
                        }
                        .message-box h2 {
                            color: #f44336;
                            margin-bottom: 20px;
                        }
                        .message-box p {
                            font-size: 1.1rem;
                            margin-bottom: 30px;
                        }
                        .btn {
                            background: #6a5acd;
                            color: white;
                            padding: 12px 24px;
                            text-decoration: none;
                            border-radius: 8px;
                            font-weight: bold;
                        }
                        .btn:hover {
                            background: #5a4abb;
                        }
                    </style>
                    <!-- Redireciona automaticamente para login após 5 segundos -->
                    <meta http-equiv="refresh" content="5;url=/login.html">
                </head>
                <body>
                    <div class="message-box">
                        <h2>🔒 Acesso Restrito</h2>
                        <p>Você precisa se logar ou cadastrar para acessar esta página.</p>
                        <p><em>Você será redirecionado para a página de login em 5 segundos...</em></p>
                        <a href="/login.html" class="btn">Ir para Login Agora</a>
                    </div>
                </body>
                </html>
            `);
        } else {
            // Se estiver logado, entrega o arquivo normalmente
            res.sendFile(path.join(__dirname, 'public', pagina));
        }
    });
});

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
        saveDatabase(); // ✅ Salva após alteração
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
    users.set(email, { 
        nome: pending.nome, 
        senha: pending.senha,
        createdAt: new Date().toISOString() // ✅ Define a data de criação aqui
    });
    friendships.set(email, new Set());
    pendingFriendRequests.set(email, []);
    pendingCodes.delete(email);
    saveDatabase(); // ✅ Salva após alteração
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
        nome: user.nome,
        createdAt: user.createdAt // ✅ Opcional: envia a data para o frontend
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
    saveDatabase(); // ✅ Salva após alteração
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

    saveDatabase(); // ✅ Salva após alteração
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
    saveDatabase(); // ✅ Salva após alteração
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
    saveDatabase(); // ✅ Salva após alteração
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
    saveDatabase(); // ✅ Salva após alteração
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
        saveDatabase(); // ✅ Salva após alteração
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
    saveDatabase(); // ✅ Salva após alteração
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
    saveDatabase(); // ✅ Salva após alteração
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
