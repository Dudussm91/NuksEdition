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

// ✅ ARMAZENA DADOS NO SERVIDOR
const users = new Map(); // { email: { nome, senha } }
const pendingCodes = new Map(); // { email: { codigo, nome, senha, timestamp } }

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

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`✉️ Bot de e-mail ativo — pronto para enviar códigos reais!`);
});
