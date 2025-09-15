const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve arquivos da pasta public

// ✉️ Configuração do Gmail — SUBSTITUA 'sua_senha_de_app_aqui' pela senha de 16 dígitos!
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'nukseditionofc@gmail.com',
        pass: 'gamt gmki kozm vlml' // ⬅️ COLOQUE AQUI SUA SENHA DE APP!
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

        console.log(`[✅ CADASTRO] ${email} | Código: ${codigo}`);
        res.status(200).json({ message: 'E-mail enviado com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao enviar e-mail:', error.message);
        res.status(500).json({ error: 'Erro ao enviar e-mail' });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:3000`);
    console.log(`✉️ Bot de e-mail ativo — pronto para enviar códigos reais!`);
});

// Rota para enviar código de exclusão de conta
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