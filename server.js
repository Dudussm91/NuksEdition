const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

// 🔑 Supabase
const supabaseUrl = 'https://spyeukuqawmwaufynzzb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNweWV1a3VxYXdtd2F1ZnluenpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MDcxNTcsImV4cCI6MjA3NTI4MzE1N30.6jLzCmqPLDan4xgWhwxcUnQNKyITvB2YBDHEL_GNkMQ';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ✅ Nodemailer configurado para Render + Gmail
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'nukseditionofc@gmail.com',
    pass: 'srbpbdxhnwlxjueg'
  },
  tls: {
    rejectUnauthorized: false
  }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());

function setAuthCookie(res, email) {
  res.cookie('nuks_auth', email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });
}

async function requireAuth(req, res, next) {
  const email = req.cookies?.nuks_auth;
  if (!email) return res.redirect('/login.html');

  const {  user, error } = await supabase
    .from('users')
    .select('email, username')
    .eq('email', email)
    .eq('confirmed', true)
    .single();

  if (error || !user) return res.redirect('/login.html');

  req.user = user;
  next();
}

app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/cadastro.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cadastro.html')));
app.get('/confirmar.html', (req, res) => {
  const email = req.query.email;
  if (!email) return res.redirect('/cadastro.html');
  res.sendFile(path.join(__dirname, 'public', 'confirmar.html'));
});

// ✅ CADASTRO COM EMAIL REAL
app.post('/cadastro', async (req, res) => {
  const { username, email, senha } = req.body;
  const normEmail = email.toLowerCase().trim();

  const {  users, error: checkError } = await supabase
    .from('users')
    .select('email')
    .eq('email', normEmail);

  if (checkError) {
    console.error('Erro ao verificar email:', checkError);
    return res.status(500).send('Erro interno');
  }

  if (users.length > 0) {
    return res.send(`
      <script>
        alert("Usuário já cadastrado");
        window.location.href = "/cadastro.html";
      </script>
    `);
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // ✅ Envia email REAL para o usuário
  try {
    await transporter.sendMail({
      from: '"NuksEdition" <nukseditionofc@gmail.com>',
      to: normEmail,
      subject: 'Código de Confirmação - NuksEdition',
      text: `Olá! Seu código de confirmação é: ${code}\n\nNão compartilhe este código.`
    });
  } catch (emailError) {
    console.error('Erro ao enviar email:', emailError);
    return res.status(500).send('Erro ao enviar código de confirmação');
  }

  const { error: insertError } = await supabase.from('users').insert({
    username: username.trim(),
    email: normEmail,
    senha: senha,
    confirmed: false,
    verification_code: code
  });

  if (insertError) {
    console.error('Erro ao inserir usuário:', insertError);
    return res.status(500).send('Erro ao criar conta');
  }

  res.redirect(`/confirmar.html?email=${encodeURIComponent(normEmail)}`);
});

// ✅ CONFIRMAÇÃO
app.post('/confirmar', async (req, res) => {
  const { email, codigo } = req.body;
  const normEmail = email.toLowerCase().trim();

  const {  users, error: confirmError } = await supabase
    .from('users')
    .select('*')
    .eq('email', normEmail)
    .eq('verification_code', codigo);

  if (confirmError) {
    console.error('Erro na confirmação:', confirmError);
    return res.status(500).send('Erro na confirmação');
  }

  if (users.length === 0) {
    return res.send(`
      <script>
        alert("Código inválido");
        window.location.href = "/confirmar.html?email=${encodeURIComponent(normEmail)}";
      </script>
    `);
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ confirmed: true, verification_code: null })
    .eq('id', users[0].id);

  if (updateError) {
    console.error('Erro ao confirmar:', updateError);
    return res.status(500).send('Erro ao confirmar conta');
  }

  setAuthCookie(res, normEmail);
  res.redirect('/home');
});

// ✅ LOGIN
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  const normEmail = email.toLowerCase().trim();

  const {  users, error: loginError } = await supabase
    .from('users')
    .select('email')
    .eq('email', normEmail)
    .eq('senha', senha)
    .eq('confirmed', true);

  if (loginError) {
    console.error('Erro no login:', loginError);
    return res.status(500).send('Erro no login');
  }

  if (users.length === 0) {
    return res.send(`
      <script>
        alert("Usuário não cadastrado ou não confirmado");
        window.location.href = "/login.html";
      </script>
    `);
  }

  setAuthCookie(res, normEmail);
  res.redirect('/home');
});

app.get('/logout', (req, res) => {
  res.clearCookie('nuks_auth');
  res.redirect('/login.html');
});

async function serveProtectedPage(pageName, req, res) {
  const filePath = path.join(__dirname, 'protected', pageName);
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/{{username}}/g, req.user.username);

  if (pageName === 'noticias.html') {
    const {  news, error } = await supabase
      .from('news')
      .select('*')
      .order('created_at', { ascending: false });

    const newsList = (news || []).map(item => `
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
    `).join('') || '<p>Nenhuma notícia publicada ainda.</p>';

    const publishSection = req.user.email === 'nukseditionofc@gmail.com' ? `
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
  }

  res.send(html);
}

app.get('/home', requireAuth, (req, res) => serveProtectedPage('home.html', req, res));
app.get('/explorar', requireAuth, (req, res) => serveProtectedPage('explorar.html', req, res));
app.get('/noticias', requireAuth, (req, res) => serveProtectedPage('noticias.html', req, res));

app.post('/noticias/publicar', requireAuth, async (req, res) => {
  if (req.user.email !== 'nukseditionofc@gmail.com') {
    return res.status(403).send('Acesso negado');
  }
  await supabase.from('news').insert({
    id: Date.now().toString(),
    title: req.body.title.trim(),
    image_url: 'https://via.placeholder.com/600x400?text=Noticia',
    description: req.body.description?.trim() || null,
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
