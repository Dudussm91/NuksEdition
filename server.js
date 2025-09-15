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

// ✅ LOG DE DEBUG: Verifica se a rota está sendo chamada
app.post('/api/cadastrar', async (req, res) => {
    console.log('✅ Rota /api/cadastrar chamada');
    console.log('📧 Dados recebidos:', req.body);

    const { nome, email, senha, codigo } = req.body;

    try {
        console.log('✉️ Tentando enviar e-mail para:', email);
        await transporter.sendMail({
            from: '"NuksEdition Bot" <nukseditionofc@gmail.com>',
            to: email,
            subject: 'Seu código de confirmação - NuksEdition',
            text: `Olá!\n\nSeu código de confirmação é: ${codigo}\n\nGuarde esse código — você precisará dele para ativar sua conta.\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        console.log('✅ E-mail enviado com sucesso!');
        res.status(200).json({ message: 'E-mail enviado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao enviar e-mail:', error.message);
        res.status(500).json({ error: 'Erro ao enviar e-mail' });
    }
});

// ✅ LOG DE DEBUG: Verifica se a rota de exclusão está sendo chamada
app.post('/api/enviar-codigo-exclusao', async (req, res) => {
    console.log('✅ Rota /api/enviar-codigo-exclusao chamada');
    console.log('📧 Dados recebidos:', req.body);

    const { email, codigo } = req.body;

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
        res.status(500).json({ error: 'Erro ao enviar código' });
    }
});

// ✅ ROTA DE TESTE — para verificar se o servidor está respondendo
app.get('/api/test', (req, res) => {
    console.log('✅ Rota /api/test chamada');
    res.status(200).json({ message: 'Servidor está funcionando!' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`✉️ Bot de e-mail ativo — pronto para enviar códigos reais!`);
});
