// server.js — COM SUPABASE (funciona no Render)
const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 10000; // Render usa 10000

app.use(cors());
app.use(express.json());

// Pasta de uploads
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!require('fs').existsSync(UPLOADS_DIR)) {
  require('fs').mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Conexão com Supabase
const supabaseUrl = 'https://qkvglgggwmjnqeperhar.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrdmdsZ2dnd21qbnFlcGVyaGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MjI1ODUsImV4cCI6MjA3NTA5ODU4NX0.-khMRh9WvF5jXQYA86YlwRuO9x7bawcQS-RouzkE4dM';
const supabase = createClient(supabaseUrl, supabaseKey);

// Rotas HTML
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/cadastrar', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cadastrar.html')));
app.get('/confirmar', (req, res) => res.sendFile(path.join(__dirname, 'public', 'confirmar.html')));
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/explorar', (req, res) => res.sendFile(path.join(__dirname, 'public', 'explorar.html')));
app.get('/noticias', (req, res) => res.sendFile(path.join(__dirname, 'public', 'noticias.html')));

// Bloquear acesso direto a .html
app.get(/\.html$/, (req, res) => {
  res.status(404).send(`
    <html>
    <head><title>404 - Página não encontrada</title></head>
    <body style="font-family: Arial; text-align: center; padding: 50px; background: #f9f9f9;">
        <h1>❌ Página não encontrada</h1>
        <p>A URL que você tentou acessar não existe.</p>
        <p><a href="/login" style="color: gray; text-decoration: none; font-weight: bold;">← Voltar para o login</a></p>
    </body>
    </html>
  `);
});

// Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASS
  }
});

const ADMINS = [
  'nukseditionofc@gmail.com',
  'eduardomarangoni36@gmail.com'
];

// API: Cadastro
app.post('/api/cadastrar', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    // Verifica se o email já existe
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado. Faça login.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        { email, username, password, code, confirmed: false }
      ])
      .select()
      .maybeSingle();

    if (insertError) throw insertError;

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Código de Confirmação - NuksEdition',
        text: `Seu código: ${code}`
      });
      res.json({ message: 'Código enviado.', email });
    } catch (emailErr) {
      console.error('Erro no email:', emailErr.message);
      res.json({ message: 'Usuário criado. Código: ' + code, email });
    }
  } catch (err) {
    console.error('Erro no cadastro:', err.message);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// API: Confirmar
app.post('/api/confirmar', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email e código são obrigatórios.' });
  }

  try {
    const { data: user, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('confirmed', false)
      .maybeSingle();

    if (selectError) throw selectError;
    if (!user) {
      return res.status(400).json({ error: 'Código inválido ou já usado.' });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ confirmed: true, code: null })
      .eq('email', email);

    if (updateError) throw updateError;

    res.json({ message: 'Conta confirmada!', username: user.username });
  } catch (err) {
    console.error('Erro na confirmação:', err.message);
    res.status(500).json({ error: 'Erro ao confirmar conta.' });
  }
});

// API: Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }

  try {
    const { data: user, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .eq('confirmed', true)
      .maybeSingle();

    if (selectError) throw selectError;
    if (!user) {
      return res.status(400).json({ error: 'Email não cadastrado ou senha incorreta.' });
    }

    res.json({ message: 'Login bem-sucedido!', username: user.username });
  } catch (err) {
    console.error('Erro no login:', err.message);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// API: Notícias
const upload = multer({ dest: UPLOADS_DIR });

app.post('/api/news/upload', upload.single('image'), async (req, res) => {
  const { email, title, description } = req.body;
  if (!ADMINS.includes(email)) {
    return res.status(403).json({ error: 'Apenas administradores.' });
  }
  if (!title || !req.file) {
    return res.status(400).json({ error: 'Título e imagem obrigatórios.' });
  }

  try {
    const id = Date.now().toString();
    const date = new Date().toISOString().split('T')[0];
    const { error: insertError } = await supabase
      .from('news')
      .insert([
        { id, email, title, description: description || '', image_url: req.file.filename, date }
      ]);

    if (insertError) throw insertError;

    res.json({ message: 'Notícia publicada!' });
  } catch (err) {
    console.error('Erro ao publicar notícia:', err.message);
    res.status(500).json({ error: 'Erro ao salvar notícia.' });
  }
});

app.get('/api/news', async (req, res) => {
  try {
    const { data: news, error } = await supabase
      .from('news')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;

    res.json(news);
  } catch (err) {
    console.error('Erro ao carregar notícias:', err.message);
    res.status(500).json({ error: 'Erro ao carregar notícias.' });
  }
});

app.delete('/api/news/:id', async (req, res) => {
  const { email } = req.query;
  if (!ADMINS.includes(email)) {
    return res.status(403).json({ error: 'Apenas administradores.' });
  }

  try {
    const { error } = await supabase
      .from('news')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ message: 'Notícia apagada.' });
  } catch (err) {
    console.error('Erro ao apagar notícia:', err.message);
    res.status(500).json({ error: 'Erro ao apagar notícia.' });
  }
});

// 404 geral
app.use((req, res) => {
  res.status(404).send('Página não encontrada');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
