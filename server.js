// server.js — COM SESSÃO REAL (SEM sessionStorage)
const express = require('express');
const session = require('express-session');
const nodemailer = require('nodemailer');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessão (armazenada no servidor, cookie no navegador com ID da sessão)
app.use(session({
  secret: process.env.SESSION_SECRET || 'nuksedition-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.RENDER ? true : false, // HTTPS no Render
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24h
  }
}));

// Pastas
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const DATA_DIR = process.env.RENDER 
  ? '/opt/render/project/src/data' 
  : __dirname;

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');

// Criar pastas
const fsSync = require('fs');
if (!fsSync.existsSync(UPLOADS_DIR)) {
  fsSync.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fsSync.existsSync(DATA_DIR)) {
  fsSync.mkdirSync(DATA_DIR, { recursive: true });
}

app.use('/uploads', express.static(UPLOADS_DIR));

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (req.session.user) {
    return next();
  }
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    return res.redirect('/login');
  }
  return res.status(401).json({ error: 'Não autenticado.' });
}

// Rotas HTML
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/cadastrar', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cadastrar.html')));
app.get('/confirmar', (req, res) => res.sendFile(path.join(__dirname, 'public', 'confirmar.html')));

app.get('/home', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/explorar', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'explorar.html'));
});

app.get('/noticias', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'noticia.html'));
});

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

// Funções de leitura/escrita
async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function readNews() {
  try {
    const data = await fs.readFile(NEWS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveNews(news) {
  await fs.writeFile(NEWS_FILE, JSON.stringify(news, null, 2));
}

// Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASS
  }
});

transporter.verify((err) => {
  if (err) console.error('📧 Erro no e-mail:', err.message);
  else console.log('✅ E-mail configurado.');
});

const ADMINS = ['nukseditionofc@gmail.com', 'eduardomarangoni36@gmail.com'];

// CADASTRO
app.post('/api/cadastrar', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });
  }

  const users = await readUsers();
  const existingUser = users.find(u => u.email === email);

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  if (existingUser) {
    if (existingUser.confirmed) {
      return res.status(400).json({ error: 'Email já cadastrado. Faça login.' });
    } else {
      // Reutiliza usuário não confirmado
      existingUser.username = username;
      existingUser.password = password;
      existingUser.code = code;
      existingUser.confirmed = false;
      await saveUsers(users);

      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: '🔄 Novo Código - NuksEdition',
        text: `Seu novo código: ${code}`
      }).catch(err => console.error('Falha ao reenviar:', err.message));

      return res.json({ message: 'Novo código enviado.', email });
    }
  }

  users.push({ email, username, password, code, confirmed: false });
  await saveUsers(users);

  res.json({ message: 'Código enviado.', email });

  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: '🔐 Código de Confirmação - NuksEdition',
    text: `Seu código: ${code}`
  }).catch(err => console.error('Falha ao enviar e-mail:', err.message));
});

// CONFIRMAR
app.post('/api/confirmar', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email e código são obrigatórios.' });
  }

  const users = await readUsers();
  const userIndex = users.findIndex(u => u.email === email && u.code === code && !u.confirmed);

  if (userIndex === -1) {
    return res.status(400).json({ error: 'Código inválido ou já usado.' });
  }

  users[userIndex].confirmed = true;
  delete users[userIndex].code;
  await saveUsers(users);

  // Login automático após confirmação
  req.session.user = {
    email: users[userIndex].email,
    username: users[userIndex].username
  };

  res.json({ message: 'Conta confirmada!', username: users[userIndex].username });
});

// LOGIN
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }

  const users = await readUsers();
  const user = users.find(u => u.email === email && u.password === password && u.confirmed);

  if (!user) {
    return res.status(400).json({ error: 'Email não cadastrado ou senha incorreta.' });
  }

  req.session.user = { email: user.email, username: user.username };
  res.json({ message: 'Login bem-sucedido!', username: user.username });
});

// LOGOUT
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logout realizado.' });
  });
});

// DADOS DO USUÁRIO (para frontend)
app.get('/api/user', (req, res) => {
  if (req.session.user) {
    res.json({ 
      isLoggedIn: true,
      username: req.session.user.username,
      email: req.session.user.email,
      isAdmin: ADMINS.includes(req.session.user.email)
    });
  } else {
    res.json({ isLoggedIn: false });
  }
});

// NOTÍCIAS
const upload = multer({ dest: UPLOADS_DIR });

app.post('/api/news/upload', upload.single('image'), async (req, res) => {
  if (!req.session.user || !ADMINS.includes(req.session.user.email)) {
    return res.status(403).json({ error: 'Apenas administradores.' });
  }
  const { title, description } = req.body;
  if (!title || !req.file) {
    return res.status(400).json({ error: 'Título e imagem obrigatórios.' });
  }

  const news = await readNews();
  news.unshift({
    id: Date.now().toString(),
    email: req.session.user.email,
    title,
    description: description || '',
    imageUrl: req.file.filename,
    date: new Date().toISOString().split('T')[0]
  });
  await saveNews(news);
  res.json({ message: 'Notícia publicada!' });
});

app.get('/api/news', async (req, res) => {
  const news = await readNews();
  res.json(news);
});

app.delete('/api/news/:id', async (req, res) => {
  if (!req.session.user || !ADMINS.includes(req.session.user.email)) {
    return res.status(403).json({ error: 'Apenas administradores.' });
  }
  const news = await readNews();
  const filtered = news.filter(n => n.id !== req.params.id);
  await saveNews(filtered);
  res.json({ message: 'Notícia apagada.' });
});

app.use((req, res) => {
  res.status(404).send('Página não encontrada');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`📧 EMAIL_USER: ${process.env.EMAIL_USER ? 'OK' : 'FALTA!'}`);
});
