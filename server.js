const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ FORÇA CORS PARA TODAS AS ROTAS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

app.use(express.json());
app.use(express.static('public'));

const pendingCodes = new Map();

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

// ✅ VALIDA CREDENCIAIS ANTES DE CRIAR O TRANSPORTER
const gmailUser = 'nukseditionofc@gmail.com';
const gmailPass = process.env.GMAIL_APP_PASSWORD;

if (!gmailPass) {
    console.error('❌ ERRO FATAL: GMAIL_APP_PASSWORD não está definida!');
    process.exit(1); // Impede que o servidor rode sem credenciais
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: gmailUser,
        pass: gmailPass
    }
});

app.post('/api/cadastrar', async (req, res) => {
    console.log('✅ Rota /api/cadastrar chamada');
    const { nome, email, senha, codigo } = req.body;

    if (!nome || !email || !senha || !codigo) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    try {
        console.log('✉️ Tentando enviar e-mail para:', email);
        await transporter.sendMail({
            from: `"NuksEdition Bot" <${gmailUser}>`,
            to: email,
            subject: 'Seu código de confirmação - NuksEdition',
            text: `Olá!\n\nSeu código de confirmação é: ${codigo}\n\nGuarde esse código — você precisará dele para ativar sua conta.\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        console.log('✅ E-mail enviado com sucesso!');
        pendingCodes.set(email, { codigo, nome, senha, timestamp: Date.now() });
        res.status(200).json({ message: 'E-mail enviado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao enviar e-mail:', error.message);
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

    pendingCodes.delete(email);
    res.status(200).json({
        message: 'Código confirmado!',
        nome: pending.nome,
        senha: pending.senha
    });
});

app.post('/api/enviar-codigo-exclusao', async (req, res) => {
    const { email, codigo } = req.body;

    if (!email || !codigo) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    try {
        await transporter.sendMail({
            from: `"NuksEdition Bot" <${gmailUser}>`,
            to: email,
            subject: 'Código de Exclusão de Conta - NuksEdition',
            text: `Olá!\n\nVocê solicitou a exclusão da sua conta.\n\nSeu código de confirmação é: ${codigo}\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        res.status(200).json({ message: 'Código enviado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao enviar código de exclusão:', error.message);
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
