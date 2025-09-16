const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ FORÇA CORS PARA TODAS AS ROTAS (ANTES DE QUALQUER OUTRA COISA)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

// ✅ TRATA REQUISIÇÕES OPTIONS (CORS PRE-FLIGHT)
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.sendStatus(200);
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// ✅ ARMAZENA CÓDIGOS EM MEMÓRIA
const pendingCodes = new Map();

// Rota para página inicial
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

// Configura transporte com Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'nukseditionofc@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

// ✅ ROTA DE TESTE — VERIFICA SE O SERVIDOR ESTÁ VIVO
app.get('/api/test', (req, res) => {
    console.log('✅ Rota /api/test chamada');
    res.status(200).json({ message: 'Servidor está funcionando!' });
});

// ✅ ROTA PARA CADASTRO — COM LOGS DETALHADOS
app.post('/api/cadastrar', async (req, res) => {
    console.log('✅ Rota /api/cadastrar chamada');
    console.log('📧 Corpo da requisição:', req.body);

    const { nome, email, senha, codigo } = req.body;

    if (!nome || !email || !senha || !codigo) {
        console.log('❌ Dados incompletos');
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    try {
        console.log('✉️ Tentando enviar e-mail para:', email);
        await transporter.sendMail({
            from: '"NuksEdition Bot" <nukseditionofc@gmail.com>',
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

// ✅ ROTA PARA CONFIRMAR CÓDIGO
app.post('/api/confirmar-codigo', (req, res) => {
    console.log('✅ Rota /api/confirmar-codigo chamada');
    console.log('📧 Corpo da requisição:', req.body);

    const { email, codigo } = req.body;

    if (!email || !codigo) {
        console.log('❌ Dados incompletos');
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    const pending = pendingCodes.get(email);
    if (!pending) {
        console.log('❌ Nenhum cadastro pendente para:', email);
        return res.status(400).json({ error: 'Nenhum cadastro pendente.' });
    }

    if (pending.codigo !== codigo) {
        console.log('❌ Código incorreto:', codigo, 'esperado:', pending.codigo);
        return res.status(400).json({ error: 'Código incorreto.' });
    }

    console.log('✅ Código confirmado para:', email);
    pendingCodes.delete(email);
    res.status(200).json({
        message: 'Código confirmado!',
        nome: pending.nome,
        senha: pending.senha
    });
});

// ✅ ROTA PARA EXCLUSÃO DE CONTA
app.post('/api/enviar-codigo-exclusao', async (req, res) => {
    console.log('✅ Rota /api/enviar-codigo-exclusao chamada');
    console.log('📧 Corpo da requisição:', req.body);

    const { email, codigo } = req.body;

    if (!email || !codigo) {
        console.log('❌ Dados incompletos');
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    try {
        console.log('✉️ Tentando enviar código de exclusão para:', email);
        await transporter.sendMail({
            from: '"NuksEdition Bot" <nukseditionofc@gmail.com>',
            to: email,
            subject: 'Código de Exclusão de Conta - NuksEdition',
            text: `Olá!\n\nVocê solicitou a exclusão da sua conta.\n\nSeu código de confirmação é: ${codigo}\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        console.log('✅ Código de exclusão enviado com sucesso!');
        res.status(200).json({ message: 'Código enviado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao enviar código de exclusão:', error.message);
        res.status(500).json({ error: 'Erro ao enviar código: ' + error.message });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`✉️ Bot de e-mail ativo — pronto para enviar códigos reais!`);
});
