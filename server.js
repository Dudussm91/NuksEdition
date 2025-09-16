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

// Middleware
app.use(express.json());
app.use(express.static('public'));

// ✅ ARMAZENA CÓDIGOS EM MEMÓRIA (NÃO NO LOCALSTORAGE)
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
        pass: process env 'gamt gmki kozm vlml'
    }
});

// Rota para cadastro + envio de e-mail
app.post('/api/cadastrar', async (req, res) => {
    const { nome, email, senha, codigo } = req.body;

    try {
        await transporter.sendMail({
            from: '"NuksEdition Bot" <nukseditionofc@gmail.com>',
            to: email,
            subject: 'Seu código de confirmação - NuksEdition',
            text: `Olá!\n\nSeu código de confirmação é: ${codigo}\n\nGuarde esse código — você precisará dele para ativar sua conta.\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        // ✅ SALVA CÓDIGO EM MEMÓRIA (NÃO NO LOCALSTORAGE)
        pendingCodes.set(email, {
            codigo: codigo,
            nome: nome,
            senha: senha,
            timestamp: Date.now()
        });

        res.status(200).json({ message: 'E-mail enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error.message);
        res.status(500).json({ error: 'Erro ao enviar e-mail' });
    }
});

// Rota para confirmar código
app.post('/api/confirmar-codigo', (req, res) => {
    const { email, codigo } = req.body;

    const pending = pendingCodes.get(email);
    if (!pending) {
        return res.status(400).json({ error: 'Nenhum cadastro pendente.' });
    }

    if (pending.codigo !== codigo) {
        return res.status(400).json({ error: 'Código incorreto.' });
    }

    // ✅ REMOVE CÓDIGO DE MEMÓRIA
    pendingCodes.delete(email);

    // ✅ RETORNA DADOS PARA O FRONTEND SALVAR
    res.status(200).json({
        message: 'Código confirmado!',
        nome: pending.nome,
        senha: pending.senha
    });
});

// Rota para envio de código de exclusão
app.post('/api/enviar-codigo-exclusao', async (req, res) => {
    const { email, codigo } = req.body;

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
        res.status(500).json({ error: 'Erro ao enviar código' });
    }
});

// ✅ ROTA DE TESTE
app.get('/api/test', (req, res) => {
    res.status(200).json({ message: 'Servidor está funcionando!' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`✉️ Bot de e-mail ativo — pronto para enviar códigos reais!`);
});
