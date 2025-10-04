// server.js — CORRIGIDO PARA RENDER + GMAIL
const express = require('express');
const nodemailer = require('nodemailer');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

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

// Rotas HTML
app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/cadastrar', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cadastrar.html')));
app.get('/confirmar', (req, res) => res.sendFile(path.join(__dirname, 'public', 'confirmar.html')));
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.get('/explorar', (req, res) => res.sendFile(path.join(__dirname, 'public', 'explorar.html')));
app.get('/noticias', (req, res) => res.sendFile(path.join(__dirname, 'public', 'noticia.html')));

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

// ✅ Configuração do Nodemailer — com validação
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASS
  }
});

// Testar configuração do e-mail no início (opcional, mas útil)
transporter.verify((error, success) => {
  if (error) {
    console.error('⚠️ Erro na configuração do e-mail:', error.message);
  } else {
    console.log('✅ Servidor de e-mail pronto para enviar.');
  }
});

const ADMINS = ['nukseditionofc@gmail.com', 'eduardomarangoni36@gmail.com'];

// ✅ CADASTRO — com reenvio e sem bloqueio
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
      // Atualiza usuário não confirmado
      existingUser.username = username;
      existingUser.password = password;
      existingUser.code = code;
      existingUser.confirmed = false;
      await saveUsers(users);

      // Envia e-mail em segundo plano
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: '🔄 Novo Código de Confirmação - NuksEdition',
        text: `Seu novo código: ${code}`
      }).catch(err => {
        console.error(`❌ Falha ao reenviar e-mail para ${email}:`, err.message);
      });

      return res.json({ message: 'Novo código enviado.', email });
    }
  }

  // Novo usuário
  users.push({ email, username, password, code, confirmed: false });
  await saveUsers(users);

  // Responde imediatamente
  res.json({ message: 'Código enviado.', email });

  // Envia e-mail em segundo plano (não bloqueia)
  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: '🔐 Código de Confirmação - NuksEdition',
    text: `Seu código de confirmação é: ${code}`
  }).catch(err => {
    console.error(`❌ Falha ao enviar e-mail para ${email}:`, err.message);
  });
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

  res.json({ message: 'Login bem-sucedido!', username: user.username });
});

// NOTÍCIAS
const upload = multer({ dest: UPLOADS_DIR });

app.post('/api/news/upload', upload.single('image'), async (req, res) => {
  const { email, title, description } = req.body;
  if (!ADMINS.includes(email)) {
    return res.status(403).json({ error: 'Apenas administradores.' });
  }
  if (!title || !req.file) {
    return res.status(400).json({ error: 'Título e imagem obrigatórios.' });
  }

  const news = await readNews();
  news.unshift({
    id: Date.now().toString(),
    email,
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
  const { email } = req.query;
  if (!ADMINS.includes(email)) {
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
  console.log(`📧 EMAIL_USER configurado: ${process.env.EMAIL_USER ? 'Sim' : 'NÃO'}`);
});
