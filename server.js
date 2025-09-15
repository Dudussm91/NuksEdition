const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// ✅ SERVE ARQUIVOS ESTÁTICOS DA PASTA PUBLIC
app.use(express.static('public'));

// ✅ ROTA PARA PÁGINA INICIAL (login.html)
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

// ✉️ Configura transporte com Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'nukseditionofc@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD || 'sua_senha_de_app_aqui' // Substitua ou use variável de ambiente
    }
});

// 📥 Rota para cadastro + envio de e-mail
app.post('/api/cadastrar', async (req, res) => {
    const { nome, email, senha, codigo } = req.body;

    try {
        await transporter.sendMail({
            from: '"NuksEdition Bot" <nukseditionofc@gmail.com>',
            to: email,
            subject: 'Seu código de confirmação - NuksEdition',
            text: `Olá!\n\nSeu código de confirmação é: ${codigo}\n\nGuarde esse código — você precisará dele para ativar sua conta.\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        res.status(200).json({ message: 'E-mail enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        res.status(500).json({ error: 'Erro ao enviar e-mail' });
    }
});

// 📥 Rota para envio de código de exclusão
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
        console.error('Erro ao enviar código de exclusão:', error);
        res.status(500).json({ error: 'Erro ao enviar código' });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`✉️ Bot de e-mail ativo — pronto para enviar códigos reais!`);
});
