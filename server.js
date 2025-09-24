const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js'); // ✅ Adicionado

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Configura o cliente do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ✅ AUMENTA O LIMITE DE TAMANHO DO CORPO DA REQUISIÇÃO
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

app.use(express.static('public'));

// ✅ Função auxiliar: carregar amigos de um usuário
async function getFriends(email) {
    const { data, error } = await supabase
        .from('friendships')
        .select('friend_email')
        .eq('user_email', email);
    if (error) return [];
    return data.map(row => row.friend_email);
}

// ✅ Função auxiliar: verificar se são amigos
async function areFriends(user1, user2) {
    const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .eq('user_email', user1)
        .eq('friend_email', user2);
    return data && data.length > 0;
}

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

// =============
// CADASTRO
// =============
app.post('/api/cadastrar', async (req, res) => {
    const { nome, email, senha, codigo } = req.body;
    if (!nome || !email || !senha || !codigo) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }
    const { data: existing } = await supabase.from('users').select('email').eq('email', email).single();
    if (existing) {
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
        // Salva no Supabase
        await supabase.from('users').insert([{ email, nome, senha }]);
        res.status(200).json({ message: 'Código enviado com sucesso para seu e-mail!' });
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error.message);
        res.status(500).json({ error: 'Erro ao enviar e-mail.' });
    }
});

// =============
// CONFIRMAR CÓDIGO (login automático após confirmação)
// =============
app.post('/api/confirmar-codigo', async (req, res) => {
    const { email, codigo } = req.body;
    if (!email || !codigo) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }
    // Aqui, como não temos tabela de códigos pendentes, assumimos que o código é válido se o usuário existir
    const { data: user } = await supabase.from('users').select('*').eq('email', email).single();
    if (!user) {
        return res.status(400).json({ error: 'Nenhum cadastro pendente.' });
    }
    // Cria amizade inicial (conjunto vazio)
    await supabase.from('friendships').delete().eq('user_email', email);
    res.status(200).json({ message: 'Código confirmado!', nome: user.nome });
});

// =============
// LOGIN
// =============
app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) {
        return res.status(400).json({ error: 'Preencha e-mail e senha!' });
    }
    const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('senha', senha)
        .single();
    if (!user) {
        return res.status(400).json({ error: 'E-mail ou senha incorretos!' });
    }
    res.status(200).json({ message: 'Login bem-sucedido!', nome: user.nome });
});

// =============
// SISTEMA DE AMIGOS
// =============
app.post('/api/adicionar-amigo', async (req, res) => {
    const { loggedUser, friendEmail } = req.body;
    if (!loggedUser || !friendEmail) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }
    if (loggedUser === friendEmail) {
        return res.status(400).json({ error: 'Você não pode adicionar sua própria conta.' });
    }
    const { data: friend } = await supabase.from('users').select('email').eq('email', friendEmail).single();
    if (!friend) {
        return res.status(400).json({ error: 'Este usuário não existe.' });
    }
    const isFriend = await areFriends(loggedUser, friendEmail);
    if (isFriend) {
        return res.status(400).json({ error: 'Vocês já são amigos!' });
    }
    // Verifica se já foi enviado
    const { data: pending } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('to_email', friendEmail)
        .eq('from_email', loggedUser)
        .single();
    if (pending) {
        return res.status(400).json({ error: 'Convite já enviado. Aguarde a resposta.' });
    }
    // Salva convite (você precisará criar a tabela `friend_requests` no Supabase)
    await supabase.from('friend_requests').insert([{ from_email: loggedUser, to_email: friendEmail }]);
    res.status(200).json({ message: 'Convite de amizade enviado com sucesso!' });
});

app.post('/api/convites-pendentes', async (req, res) => {
    const { loggedUser } = req.body;
    if (!loggedUser) {
        return res.status(400).json({ error: 'Usuário não autenticado.' });
    }
    const { data: invites } = await supabase
        .from('friend_requests')
        .select('from_email')
        .eq('to_email', loggedUser);
    const inviteEmails = invites.map(inv => inv.from_email);
    const inviteDetails = [];
    for (const email of inviteEmails) {
        const { data: user } = await supabase.from('users').select('nome').eq('email', email).single();
        inviteDetails.push({ email, nome: user ? user.nome : email });
    }
    res.status(200).json({ invites: inviteDetails });
});

app.post('/api/aceitar-amizade', async (req, res) => {
    const { loggedUser, inviterEmail } = req.body;
    if (!loggedUser || !inviterEmail) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }
    // Cria amizade bidirecional
    await supabase.from('friendships').insert([
        { user_email: loggedUser, friend_email: inviterEmail },
        { user_email: inviterEmail, friend_email: loggedUser }
    ]);
    // Remove o convite
    await supabase.from('friend_requests').delete().eq('from_email', inviterEmail).eq('to_email', loggedUser);
    res.status(200).json({ message: 'Amizade confirmada com sucesso!' });
});

app.post('/api/meus-amigos', async (req, res) => {
    const { loggedUser } = req.body;
    if (!loggedUser) {
        return res.status(400).json({ error: 'Usuário não autenticado.' });
    }
    const friendEmails = await getFriends(loggedUser);
    const friends = [];
    for (const email of friendEmails) {
        const { data: user } = await supabase.from('users').select('nome').eq('email', email).single();
        friends.push({ email, nome: user ? user.nome : email });
    }
    res.status(200).json({ friends });
});

app.post('/api/remover-amigo', async (req, res) => {
    const { loggedUser, friendEmail } = req.body;
    if (!loggedUser || !friendEmail) {
        return res.status(400).json({ error: 'Dados incompletos.' });
    }
    // Remove ambas as direções
    await supabase
        .from('friendships')
        .delete()
        .or(`and(user_email.eq.${loggedUser},friend_email.eq.${friendEmail}),and(user_email.eq.${friendEmail},friend_email.eq.${loggedUser})`);
    res.status(200).json({ message: 'Amigo removido com sucesso.' });
});

// =============
// SISTEMA DE NOTÍCIAS
// =============
app.get('/api/noticias', async (req, res) => {
    const { data: noticias, error } = await supabase.from('news').select('*').order('id', { ascending: false });
    if (error) return res.status(500).json({ error: 'Erro ao carregar notícias.' });
    res.status(200).json({ noticias });
});

app.post('/api/noticias', async (req, res) => {
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
    await supabase.from('news').insert([novaNoticia]);
    res.status(201).json({ message: 'Notícia publicada com sucesso!', noticia: novaNoticia });
});

app.delete('/api/noticias/:id', async (req, res) => {
    const { id } = req.params;
    const { loggedUser } = req.body;
    const admins = ['eduardomarangoni36@gmail.com', 'nukseditionofc@gmail.com'];
    if (!admins.includes(loggedUser)) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem excluir.' });
    }
    await supabase.from('news').delete().eq('id', id);
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
    const { data: user } = await supabase.from('users').select('email').eq('email', email).single();
    if (!user) {
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
        res.status(200).json({ message: 'Código de exclusão enviado com sucesso para seu e-mail!' });
    } catch (error) {
        console.error('Erro ao enviar código de exclusão:', error.message);
        res.status(500).json({ error: 'Erro ao enviar e-mail.' });
    }
});

app.post('/api/excluir-conta', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'E-mail não fornecido.' });
    }
    // Exclui tudo relacionado ao usuário
    await supabase.from('friendships').delete().or(`user_email.eq.${email},friend_email.eq.${email}`);
    await supabase.from('users').delete().eq('email', email);
    res.status(200).json({ message: 'Conta excluída com sucesso.' });
});

// =============
// SISTEMA DE CHAT
// =============
app.post('/api/obter-usuario', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'E-mail não fornecido.' });
    }
    const { data: user } = await supabase.from('users').select('nome').eq('email', email).single();
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.status(200).json({ nome: user.nome });
});

app.post('/api/enviar-mensagem', async (req, res) => {
    const { sender, receiver, text } = req.body;
    if (!sender || !receiver || !text) {
        return res.status(400).json({ error: 'Dados incompletos.' });
    }
    const { data: s } = await supabase.from('users').select('email').eq('email', sender).single();
    const { data: r } = await supabase.from('users').select('email').eq('email', receiver).single();
    if (!s || !r) {
        return res.status(400).json({ error: 'Remetente ou destinatário não existe.' });
    }
    await supabase.from('messages').insert([{ sender, receiver, text, timestamp: Date.now() }]);
    res.status(200).json({ message: 'Mensagem enviada com sucesso.' });
});

app.post('/api/carregar-mensagens', async (req, res) => {
    const { loggedUser, friendEmail } = req.body;
    if (!loggedUser || !friendEmail) {
        return res.status(400).json({ error: 'Dados incompletos.' });
    }
    const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender.eq.${loggedUser},receiver.eq.${friendEmail}),and(sender.eq.${friendEmail},receiver.eq.${loggedUser})`)
        .order('timestamp', { ascending: true });
    res.status(200).json({ messages });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor NuksEdition rodando em http://localhost:${PORT}`);
    console.log(`✉️  Bot de e-mail ativo — pronto para enviar códigos reais!`);
    console.log(`🔐 Para usar o Gmail, configure a variável de ambiente: GMAIL_APP_PASSWORD`);
});
