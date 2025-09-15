const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
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
        pass: process.env.gamt 'gamt gmki kozm vlml'
    }
});

// Rota para cadastro + envio de e-mail
app.post('/api/cadastrar', async (req, res) => {
    const { nome, email, senha, codigo } = req.body;

    console.log('Tentando enviar e-mail para:', email); // ✅ LOG DE DEBUG

    try {
        await transporter.sendMail({
            from: '"NuksEdition Bot" <nukseditionofc@gmail.com>',
            to: email,
            subject: 'Seu código de confirmação - NuksEdition',
            text: `Olá!\n\nSeu código de confirmação é: ${codigo}\n\nGuarde esse código — você precisará dele para ativar sua conta.\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        console.log('E-mail enviado com sucesso!'); // ✅ LOG DE DEBUG
        res.status(200).json({ message: 'E-mail enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error.message); // ✅ LOG DE ERRO DETALHADO
        res.status(500).json({ error: 'Erro ao enviar e-mail' });
    }
});

// Rota para envio de código de exclusão
app.post('/api/enviar-codigo-exclusao', async (req, res) => {
    const { email, codigo } = req.body;

    console.log('Tentando enviar código de exclusão para:', email); // ✅ LOG DE DEBUG

    try {
        await transporter.sendMail({
            from: '"NuksEdition Bot" <nukseditionofc@gmail.com>',
            to: email,
            subject: 'Código de Exclusão de Conta - NuksEdition',
            text: `Olá!\n\nVocê solicitou a exclusão da sua conta.\n\nSeu código de confirmação é: ${codigo}\n\nAtenciosamente,\nEquipe NuksEdition`
        });

        console.log('Código de exclusão enviado com sucesso!'); // ✅ LOG DE DEBUG
        res.status(200).json({ message: 'Código enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar código de exclusão:', error.message); // ✅ LOG DE ERRO DETALHADO
        res.status500().json({ error: 'Erro ao enviar código' });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`✉️ Bot de e-mail ativo — pronto para enviar códigos reais!`);
});
