const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Supabase
const supabaseUrl = 'https://spyeukuqawmwaufynzzb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNweWV1a3VxYXdtd2F1ZnluenpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MDcxNTcsImV4cCI6MjA3NTI4MzE1N30.6jLzCmqPLDan4xgWhwxcUnQNKyITvB2YBDHEL_GNkMQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Função para definir cookie seguro
function setAuthCookie(res, email) {
  res.cookie('nuks_auth', email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 1 dia
    sameSite: 'lax'
  });
}

// Função para obter usuário do cookie
async function getAuthUser(req) {
  const email = req.cookies?.nuks_auth;
  if (!email) return null;
  
  const {  user } = await supabase
    .from('users')
    .select('email, username')
    .eq('email', email)
    .eq('confirmed', true)
    .single();
  
  return user;
}

// Middleware de autenticação
function requireAuth(req, res, next) {
  getAuthUser(req).then(user => {
    if (!user) {
      return res.redirect('/login.html');
    }
    req.user = user;
    next();
  }).catch(() => res.redirect('/login.html'));
}

// Rotas públicas
app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/cadastro.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cadastro.html')));
app.get('/confirmar.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'confirmar.html')));

// Cadastro
app.post('/cadastro', async (req, res) => {
  const { username, email, senha } = req.body;
  const normEmail = email.toLowerCase().trim();

  const {  existing } = await supabase
    .from('users')
    .select('email')
    .eq('email', normEmail);

  if (existing.length > 0) {
    return res.send(`
      <script>
        alert("Usuário já cadastrado");
        window.location.href = "/cadastro.html";
      </script>
    `);
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await supabase.from('users').insert({
    username: username.trim(),
    email: normEmail,
    senha: senha,
    confirmed: false,
    verification_code: code
  });

  // ✅ Em vez de enviar email, mostra no console (para teste)
  console.log(`[CÓDIGO DE TESTE] Para ${normEmail}: ${code}`);
  
  // Redireciona com email na URL
  res.redirect(`/confirmar.html?email=${encodeURIComponent(normEmail)}`);
});

// Confirmação
app.post('/confirmar', async (req, res) => {
  const { email, codigo } = req.body;
  const normEmail = email.toLowerCase().trim();

  const {  user } = await supabase
    .from('users')
    .select('*')
    .eq('email', normEmail)
    .eq('verification_code', codigo)
    .single();

  if (user) {
    await supabase
      .from('users')
      .update({ confirmed: true, verification_code: null })
      .eq('id', user.id);

    // ✅ Define cookie de autenticação
    setAuthCookie(res, normEmail);
    return res.redirect('/home');
  }

  return res.send(`
    <script>
      alert("Código inválido");
      window.location.href = "/confirmar.html?email=${encodeURIComponent(normEmail)}";
    </script>
  `);
});

// Login
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  const normEmail = email.toLowerCase().trim();

  const {  user } = await supabase
    .from('users')
    .select('email')
    .eq('email', normEmail)
    .eq('senha', senha)
    .eq('confirmed', true)
    .single();

  if (user) {
    setAuthCookie(res, normEmail);
    return res.redirect('/home');
  }

  return res.send(`
    <script>
      alert("Usuário não cadastrado ou não confirmado");
      window.location.href = "/login.html";
    </script>
  `);
});

// Logout
app.get('/logout', (req, res) => {
  res.clearCookie('nuks_auth');
  res.redirect('/login.html');
});

// Servir páginas protegidas
function serveProtectedPage(pageName, req, res) {
  const filePath = path.join(__dirname, 'protected', pageName);
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/{{username}}/g, req.user.username);

  if (pageName === 'noticias.html') {
    // Carregar notícias
    supabase
      .from('news')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({  news }) => {
        let newsList = news.length > 0 ? 
          news.map(item => `
            <div class="news-item">
              <div class="news-title">${item.title}</div>
              <img src="${item.image_url}" class="news-image">
              ${item.description ? `<div class="news-desc">${item.description}</div>` : ''}
              ${req.user.email === 'nukseditionofc@gmail.com' ? `
                <div class="news-actions">
                  <form method="post" action="/noticias/excluir/${item.id}" style="display:inline;" onsubmit="return confirm('Excluir?');">
                    <button type="submit" class="btn-delete">Excluir</button>
                  </form>
                </div>
              ` : ''}
            </div>
          `).join('') : '<p>Nenhuma notícia publicada ainda.</p>';

        let publishSection = req.user.email === 'nukseditionofc@gmail.com' ? `
          <div id="publish-section">
            <h2>Publicar Nova Notícia</h2>
            <form method="post" action="/noticias/publicar">
              <div class="form-group">
                <label>Título *</label>
                <input type="text" name="title" required>
              </div>
              <div class="form-group">
                <label>Descrição (opcional)</label>
                <textarea name="description" rows="3"></textarea>
              </div>
              <button type="submit">Publicar</button>
            </form>
          </div>
        ` : '';

        html = html
          .replace('<div id="publish-section"></div>', publishSection)
          .replace('<div id="news-list"></div>', `<div id="news-list">${newsList}</div>`);
        res.send(html);
      });
  } else {
    res.send(html);
  }
}

const fs = require('fs');
const cookieParser = require('cookie-parser');
app.use(cookieParser());

app.get('/home', requireAuth, (req, res) => serveProtectedPage('home.html', req, res));
app.get('/explorar', requireAuth, (req, res) => serveProtectedPage('explorar.html', req, res));
app.get('/noticias', requireAuth, (req, res) => serveProtectedPage('noticias.html', req, res));

// Publicar e excluir notícias (só admin)
app.post('/noticias/publicar', requireAuth, async (req, res) => {
  if (req.user.email !== 'nukseditionofc@gmail.com') {
    return res.status(403).send('Acesso negado');
  }
  const { title, description } = req.body;
  await supabase.from('news').insert({
    id: Date.now().toString(),
    title: title.trim(),
    image_url: 'https://via.placeholder.com/600x400?text=Noticia',
    description: description?.trim() || null,
    author: req.user.username
  });
  res.redirect('/noticias');
});

app.post('/noticias/excluir/:id', requireAuth, async (req, res) => {
  if (req.user.email !== 'nukseditionofc@gmail.com') {
    return res.status(403).send('Acesso negado');
  }
  await supabase.from('news').delete().eq('id', req.params.id);
  res.redirect('/noticias');
});

app.use((req, res) => res.status(404).send('Página não encontrada'));

app.listen(PORT, () => {
  console.log(`✅ Rodando em http://localhost:${PORT}`);
});
