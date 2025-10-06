const express = require('express');
const nodemailer = require('nodemailer');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

// Pasta de uploads
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
    cb(null, name);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas JPG, JPEG e PNG são permitidos'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(session({
  secret: 'nuksedition-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

function normalizeEmail(email) {
  return email.toLowerCase().trim();
}

// Carregar usuários
let users = [];
const verificationCodes = {};

function loadUsers() {
  try {
    if (fs.existsSync('users.json')) {
      const data = fs.readFileSync('users.json', 'utf8').trim();
      users = data ? JSON.parse(data) : [];
    } else {
      users = [];
      saveUsers();
    }
  } catch (e) {
    users = [];
    saveUsers();
  }
}

function saveUsers() {
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
}

loadUsers();

// Carregar notícias
let news = [];

function loadNews() {
  try {
    if (fs.existsSync('news.json')) {
      const data = fs.readFileSync('news.json', 'utf8').trim();
      news = data ? JSON.parse(data) : [];
    } else {
      news = [];
      saveNews();
    }
  } catch (e) {
    news = [];
    saveNews();
  }
}

function saveNews() {
  fs.writeFileSync('news.json', JSON.stringify(news, null, 2));
}

loadNews();

// Email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'nukseditionofc@gmail.com',
    pass: 'srbpbdxhnwlxjueg'
  }
});

// Rotas públicas
app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/cadastro.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cadastro.html')));

app.get('/confirmar.html', (req, res) => {
  const email = req.query.email;
  if (!email || !verificationCodes[normalizeEmail(email)]) {
    return res.send(`
      <script>
        alert("Nenhum email encontrado. Faça o cadastro primeiro.");
        window.location.href = "/cadastro.html";
      </script>
    `);
  }
  res.sendFile(path.join(__dirname, 'public', 'confirmar.html'));
});

// Login
app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  const normEmail = normalizeEmail(email);
  const user = users.find(u => normalizeEmail(u.email) === normEmail && u.senha === senha && u.confirmed);

  if (user) {
    req.session.userId = normEmail;
    return res.redirect('/home');
  } else {
    return res.send(`
      <script>
        alert("Usuário não cadastrado ou não confirmado");
        window.location.href = "/login.html";
      </script>
    `);
  }
});

// Cadastro
app.post('/cadastro', (req, res) => {
  const { username, email, senha } = req.body;
  const normEmail = normalizeEmail(email);

  if (users.some(u => normalizeEmail(u.email) === normEmail)) {
    return res.send(`
      <script>
        alert("Usuário já cadastrado");
        window.location.href = "/cadastro.html";
      </script>
    `);
  }

  users.push({ 
    username: username.trim(), 
    email: normEmail, 
    senha: senha, 
    confirmed: false 
  });
  saveUsers();

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes[normEmail] = code;

  transporter.sendMail({
    from: 'nukseditionofc@gmail.com',
    to: normEmail,
    subject: 'Código de confirmação - NuksEdition',
    text: `Seu código de 6 dígitos é: ${code}`
  }).catch(console.error);

  res.redirect(`/confirmar.html?email=${encodeURIComponent(normEmail)}`);
});

// Confirmação
app.post('/confirmar', (req, res) => {
  const { email, codigo } = req.body;
  const normEmail = normalizeEmail(email);
  const expectedCode = verificationCodes[normEmail];

  if (expectedCode && codigo === expectedCode) {
    const user = users.find(u => normalizeEmail(u.email) === normEmail);
    if (user) {
      user.confirmed = true;
      saveUsers();
      delete verificationCodes[normEmail];
      req.session.userId = normEmail;
      return res.redirect('/home');
    }
  }
  return res.send(`
    <script>
      alert("Código inválido");
      window.location.href = "/confirmar.html?email=${encodeURIComponent(normEmail)}";
    </script>
  `);
});

// Publicar notícia
app.post('/noticias/publicar', upload.single('image'), (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');
  const user = users.find(u => normalizeEmail(u.email) === normalizeEmail(req.session.userId));
  if (!user || user.email !== 'nukseditionofc@gmail.com') {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).send('Acesso negado');
  }

  const { title, description } = req.body;
  if (!title || !req.file) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.send(`
      <script>
        alert("Título e imagem são obrigatórios");
        window.location.href = "/noticias";
      </script>
    `);
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  news.unshift({
    id: Date.now().toString(),
    title: title.trim(),
    imageUrl: imageUrl,
    description: description ? description.trim() : '',
    author: user.username,
    date: new Date().toISOString()
  });
  saveNews();
  res.redirect('/noticias');
});

// Excluir notícia
app.post('/noticias/excluir/:id', (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');
  const user = users.find(u => normalizeEmail(u.email) === normalizeEmail(req.session.userId));
  if (!user || user.email !== 'nukseditionofc@gmail.com') {
    return res.status(403).send('Acesso negado');
  }

  const newsId = req.params.id;
  const index = news.findIndex(n => n.id === newsId);
  if (index !== -1) {
    const imagePath = path.join(__dirname, 'uploads', path.basename(news[index].imageUrl));
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    news.splice(index, 1);
    saveNews();
  }
  res.redirect('/noticias');
});

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.send(`
      <script>
        alert("Você precisa estar cadastrado e logado");
        window.location.href = "/login.html";
      </script>
    `);
  }
  const user = users.find(u => normalizeEmail(u.email) === normalizeEmail(req.session.userId));
  if (!user || !user.confirmed) {
    req.session.destroy(() => {
      res.send(`
        <script>
          alert("Conta não confirmada. Verifique seu email.");
          window.location.href = "/login.html";
        </script>
      `);
    });
    return;
  }
  next();
}

// Servir páginas protegidas
function serveProtectedPage(pageName, req, res) {
  const user = users.find(u => normalizeEmail(u.email) === normalizeEmail(req.session.userId));
  if (!user) return res.status(403).send('Usuário não encontrado');

  const filePath = path.join(__dirname, 'protected', pageName);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(404).send('Página não encontrada');

    let html = data.replace(/{{username}}/g, user.username);

    if (pageName === 'noticias.html') {
      let publishSection = '';
      let newsList = '';

      if (user.email === 'nukseditionofc@gmail.com') {
        publishSection = `
          <div id="publish-section">
            <h2>Publicar Nova Notícia</h2>
            <form method="post" action="/noticias/publicar" enctype="multipart/form-data">
              <div class="form-group">
                <label for="title">Título *</label>
                <input type="text" id="title" name="title" required>
              </div>
              <div class="form-group">
                <label for="image">Imagem *</label>
                <input type="file" id="image" name="image" accept="image/jpeg,image/png" required>
              </div>
              <div class="form-group">
                <label for="description">Descrição (opcional)</label>
                <textarea id="description" name="description" rows="3"></textarea>
              </div>
              <button type="submit">Publicar</button>
            </form>
          </div>
        `;
      }

      if (news.length > 0) {
        newsList = news.map(item => {
          let actions = '';
          if (user.email === 'nukseditionofc@gmail.com') {
            actions = `
              <div class="news-actions">
                <form method="post" action="/noticias/excluir/${item.id}" style="display:inline;" onsubmit="return confirm('Excluir esta notícia?');">
                  <button type="submit" class="btn-delete">Excluir</button>
                </form>
              </div>
            `;
          }
          return `
            <div class="news-item">
              <div class="news-title">${item.title}</div>
              <img src="${item.imageUrl}" alt="Imagem da notícia" class="news-image">
              ${item.description ? `<div class="news-desc">${item.description}</div>` : ''}
              ${actions}
            </div>
          `;
        }).join('');
      } else {
        newsList = '<p>Nenhuma notícia publicada ainda.</p>';
      }

      html = html
        .replace('<div id="publish-section"></div>', publishSection)
        .replace('<div id="news-list"></div>', `<div id="news-list">${newsList}</div>`);
    }

    res.send(html);
  });
}

// Rotas protegidas
app.get('/home', requireAuth, (req, res) => {
  serveProtectedPage('home.html', req, res);
});

app.get('/explorar', requireAuth, (req, res) => {
  serveProtectedPage('explorar.html', req, res);
});

app.get('/noticias', requireAuth, (req, res) => {
  serveProtectedPage('noticias.html', req, res);
});

// 404
app.use((req, res) => {
  res.status(404).send('Página não encontrada');
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});