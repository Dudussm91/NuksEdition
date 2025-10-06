const express = require('express');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 Configuração do Supabase
const supabaseUrl = 'https://spyeukuqawmwaufynzzb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNweWV1a3VxYXdtd2F1ZnluenpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MDcxNTcsImV4cCI6MjA3NTI4MzE1N30.6jLzCmqPLDan4xgWhwxcUnQNKyITvB2YBDHEL_GNkMQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'nuksedition-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

function normalizeEmail(email) {
  return email.toLowerCase().trim();
}

// Rotas públicas
app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/cadastro.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cadastro.html')));
app.get('/confirmar.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'confirmar.html')));

// Cadastro
app.post('/cadastro', async (req, res) => {
  const { username, email, senha } = req.body;
  const normEmail = normalizeEmail(email);

  const { data: existing } = await supabase
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

  console.log(`[TESTE] Código para ${normEmail}: ${code}`);
  res.redirect(`/confirmar.html?email=${encodeURIComponent(normEmail)}`);
});

// Confirmação
app.post('/confirmar', async (req, res) => {
  const { email, codigo } = req.body;
  const normEmail = normalizeEmail(email);

  const { data: user } = await supabase
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

    req.session.userId = normEmail;
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
  const normEmail = normalizeEmail(email);

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', normEmail)
    .eq('senha', senha)
    .eq('confirmed', true)
    .single();

  if (user) {
    req.session.userId = normEmail;
    return res.redirect('/home');
  }

  return res.send(`
    <script>
      alert("Usuário não cadastrado ou não confirmado");
      window.location.href = "/login.html";
    </script>
  `);
});

// Publicar notícia (só admin)
app.post('/noticias/publicar', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');

  const { data: user } = await supabase
    .from('users')
    .select('email, username')
    .eq('email', req.session.userId)
    .single();

  if (!user || user.email !== 'nukseditionofc@gmail.com') {
    return res.status(403).send('Acesso negado');
  }

  const { title, description } = req.body;
  // Simula URL de imagem (em produção, use Supabase Storage)
  const imageUrl = 'https://via.placeholder.com/600x400?text=Imagem+da+Noticia';

  await supabase.from('news').insert({
    id: Date.now().toString(),
    title: title.trim(),
    image_url: imageUrl,
    description: description ? description.trim() : null,
    author: user.username
  });

  res.redirect('/noticias');
});

// Excluir notícia (só admin)
app.post('/noticias/excluir/:id', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login.html');

  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('email', req.session.userId)
    .single();

  if (!user || user.email !== 'nukseditionofc@gmail.com') {
    return res.status(403).send('Acesso negado');
  }

  await supabase.from('news').delete().eq('id', req.params.id);
  res.redirect('/noticias');
});

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  next();
}

// Servir páginas protegidas com nome do usuário
function serveProtectedPage(pageName, req, res) {
  supabase
    .from('users')
    .select('username')
    .eq('email', req.session.userId)
    .single()
    .then(({ data: user }) => {
      if (!user) return res.redirect('/login.html');

      const filePath = path.join(__dirname, 'protected', pageName);
      let html = fs.readFileSync(filePath, 'utf8');
      html = html.replace(/{{username}}/g, user.username);

      if (pageName === 'noticias.html') {
        // Carregar notícias
        supabase
          .from('news')
          .select('*')
          .order('created_at', { ascending: false })
          .then(({ data: news }) => {
            let newsList = '';
            if (news.length > 0) {
              newsList = news.map(item => {
                let actions = '';
                if (req.session.userId === 'nukseditionofc@gmail.com') {
                  actions = `
                    <div class="news-actions">
                      <form method="post" action="/noticias/excluir/${item.id}" style="display:inline;" onsubmit="return confirm('Excluir?');">
                        <button type="submit" class="btn-delete">Excluir</button>
                      </form>
                    </div>
                  `;
                }
                return `
                  <div class="news-item">
                    <div class="news-title">${item.title}</div>
                    <img src="${item.image_url}" class="news-image">
                    ${item.description ? `<div class="news-desc">${item.description}</div>` : ''}
                    ${actions}
                  </div>
                `;
              }).join('');
            } else {
              newsList = '<p>Nenhuma notícia publicada ainda.</p>';
            }

            let publishSection = '';
            if (req.session.userId === 'nukseditionofc@gmail.com') {
              publishSection = `
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
              `;
            }

            html = html
              .replace('<div id="publish-section"></div>', publishSection)
              .replace('<div id="news-list"></div>', `<div id="news-list">${newsList}</div>`);
            res.send(html);
          });
      } else {
        res.send(html);
      }
    });
}

const fs = require('fs');

app.get('/home', requireAuth, (req, res) => serveProtectedPage('home.html', req, res));
app.get('/explorar', requireAuth, (req, res) => serveProtectedPage('explorar.html', req, res));
app.get('/noticias', requireAuth, (req, res) => serveProtectedPage('noticias.html', req, res));

app.use((req, res) => res.status(404).send('Página não encontrada'));

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
