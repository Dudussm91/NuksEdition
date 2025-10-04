// server.js — COM CRIAÇÃO AUTOMÁTICA DE TABELAS
const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Client } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Pasta de uploads
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Conexão com PostgreSQL
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Função para criar tabelas
async function createTables() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      confirmed BOOLEAN DEFAULT false,
      confirmation_code TEXT
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS news (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      image_url TEXT NOT NULL,
      date TEXT NOT NULL
    );
  `);
  console.log('✅ Tabelas verificadas/criadas');
}

// Conectar e criar tabelas
client.connect()
  .then(() => {
    console.log('✅ Conectado ao PostgreSQL');
    return createTables();
  })
  .catch(err => {
    console.error('❌ Erro ao conectar ou criar tabelas:', err);
    process.exit(1);
  });

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

// === API: CADASTRAR ===
app.post('/api/cadastrar', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    const check = await client.query('SELECT email FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado. Faça login.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await client.query(
      `INSERT INTO users (email, username, password, confirmation_code, confirmed)
       VALUES ($1, $2, $3, $4, false)`,
      [email, username, password, code]
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Código de Confirmação - NuksEdition',
      text: `Seu código: ${code}`
    });

    res.json({ message: 'Código enviado.', email });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// === API: CONFIRMAR ===
app.post('/api/confirmar', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email e código são obrigatórios.' });
  }

  try {
    const result = await client.query(
      'SELECT * FROM users WHERE email = $1 AND confirmation_code = $2',
      [email, code]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Código inválido.' });
    }

    await client.query(
      'UPDATE users SET confirmed = true, confirmation_code = NULL WHERE email = $1',
      [email]
    );

    res.json({ message: 'Conta confirmada!', username: result.rows[0].username });
  } catch (err) {
    console.error('Erro na confirmação:', err);
    res.status(500).json({ error: 'Erro ao confirmar conta.' });
  }
});

// === API: LOGIN ===
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }

  try {
    const result = await client.query(
      'SELECT * FROM users WHERE email = $1 AND password = $2 AND confirmed = true',
      [email, password]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Email não cadastrado ou senha incorreta.' });
    }

    res.json({ message: 'Login bem-sucedido!', username: result.rows[0].username });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// === API: NOTÍCIAS ===
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
    await client.query(
      `INSERT INTO news (id, email, title, description, image_url, date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, email, title, description || '', req.file.filename, date]
    );
    res.json({ message: 'Notícia publicada!' });
  } catch (err) {
    console.error('Erro ao publicar notícia:', err);
    res.status(500).json({ error: 'Erro ao salvar notícia.' });
  }
});

app.get('/api/news', async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM news ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao carregar notícias:', err);
    res.status(500).json({ error: 'Erro ao carregar notícias.' });
  }
});

app.delete('/api/news/:id', async (req, res) => {
  const { email } = req.query;
  if (!ADMINS.includes(email)) {
    return res.status(403).json({ error: 'Apenas administradores.' });
  }

  try {
    await client.query('DELETE FROM news WHERE id = $1', [req.params.id]);
    res.json({ message: 'Notícia apagada.' });
  } catch (err) {
    console.error('Erro ao apagar notícia:', err);
    res.status(500).json({ error: 'Erro ao apagar notícia.' });
  }
});

// 404 geral
app.use((req, res) => {
  res.status(404).send('Página não encontrada');
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
