require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3000;

// Configurações do .env
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Diretórios
const VIEWS_DIR = path.join(__dirname, 'views');
const PUBLIC_VIEWS = path.join(VIEWS_DIR, 'public');
const PROTECT_VIEWS = path.join(VIEWS_DIR, 'protect');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer para uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({ storage });

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Rotas públicas
app.get('/cadastro', (req, res) => {
  res.sendFile(path.join(PUBLIC_VIEWS, 'cadastro.html'));
});
app.get('/login', (req, res) => {
  res.sendFile(path.join(PUBLIC_VIEWS, 'login.html'));
});
app.get('/confirmar', (req, res) => {
  if (!req.cookies.pending_email) return res.redirect('/cadastro');
  res.sendFile(path.join(PUBLIC_VIEWS, 'confirmar.html'));
});

// Middleware de autenticação
function auth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');
  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      res.clearCookie('token');
      return res.redirect('/login');
    }
    try {
      const { data: user, error } = await supabase
        .from('usuarios')
        .select('username, email')
        .eq('email', decoded.email)
        .single();
      if (error || !user) {
        res.clearCookie('token');
        return res.redirect('/login');
      }
      req.user = user;
      next();
    } catch {
      res.clearCookie('token');
      res.redirect('/login');
    }
  });
}

// Rotas protegidas
app.get('/home', auth, (req, res) => {
  let html = fs.readFileSync(path.join(PROTECT_VIEWS, 'home.html'), 'utf8');
  html = html.replace('Nome de usuario', req.user.username);
  res.send(html);
});
app.get('/explorar', auth, (req, res) => {
  let html = fs.readFileSync(path.join(PROTECT_VIEWS, 'explorar.html'), 'utf8');
  html = html.replace('Nome de usuario', req.user.username);
  res.send(html);
});
app.get('/noticias', auth, async (req, res) => {
  let html = fs.readFileSync(path.join(PROTECT_VIEWS, 'noticias.html'), 'utf8');
  html = html.replace('Nome de usuario', req.user.username);

  const { data: noticias, error } = await supabase
    .from('noticias')
    .select('*')
    .order('data_publicacao', { ascending: false });

  if (error) {
    console.error('Erro ao buscar notícias:', error);
    return res.status(500).send('Erro ao carregar notícias.');
  }

  let conteudo = '';

  // Formulário de publicação (só admin)
  if (req.user.email === ADMIN_EMAIL) {
    conteudo += `
      <div style="max-width:600px;margin:40px auto;padding:20px;border:1px solid #ccc;text-align:left;">
        <h2>Publicar Notícia</h2>
        <form id="form-noticia" enctype="multipart/form-data">
          <input type="text" id="titulo" name="titulo" placeholder="Título" required style="width:100%;padding:8px;margin:5px 0;">
          <input type="file" id="imagem" name="imagem" accept="image/*" required style="margin:5px 0;">
          <textarea id="descricao" name="descricao" placeholder="Descrição (opcional)" style="width:100%;padding:8px;margin:5px 0;height:80px;"></textarea>
          <button type="submit" style="background:#808080;color:white;padding:10px;border:none;cursor:pointer;">Publicar</button>
        </form>
      </div>
    `;
  }

  // Listagem de notícias
  conteudo += `
    <div style="text-align:center;margin-top:40px;">
      <h2>Últimas Notícias</h2>
      ${
        noticias && noticias.length > 0
          ? noticias.map(n => `
            <div style="border:1px solid #eee;padding:15px;margin:15px auto;max-width:600px;text-align:left;">
              <h3>${n.titulo}</h3>
              <img src="${n.imagem_url}" style="max-width:100%;height:auto;">
              ${n.descricao ? `<p>${n.descricao}</p>` : ''}
              <p style="font-size:12px;color:#666;">📅 Publicado em ${new Date(n.data_publicacao).toLocaleDateString('pt-BR')}</p>
              ${
                req.user.email === ADMIN_EMAIL
                  ? `<button onclick="excluirNoticia(${n.id})" style="background:#c0392b;color:white;border:none;padding:5px 10px;cursor:pointer;">Excluir</button>`
                  : ''
              }
            </div>
          `).join('')
          : '<p>Nenhuma notícia no momento.</p>'
      }
    </div>
  `;

  html = html.replace('<p>Nenhuma notícia no momento.</p>', conteudo);
  res.send(html);
});

// APIs
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres.' });

  // Verificar se já existe
  const { data: existingUser, error: fetchError } = await supabase
    .from('usuarios')
    .select('email')
    .eq('email', email)
    .single();
  if (existingUser) {
    return res.status(400).json({ error: 'Conta já cadastrada.' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = await bcrypt.hash(password, 10);

  // Salvar na tabela persistente
  const { error: insertError } = await supabase
    .from('cadastros_pendentes')
    .insert({
      email,
      username,
      senha_hash: hash,
      codigo_confirmacao: code
    });

  if (insertError) {
    console.error('Erro ao salvar cadastro pendente:', insertError);
    return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Confirme seu cadastro',
      html: `<h2>Seu código de confirmação: <strong>${code}</strong></h2><p>Este código expira em 10 minutos.</p>`
    });
  } catch (err) {
    console.error('Erro ao enviar e-mail:', err);
    // Opcional: remover o registro pendente se falhar o e-mail
    await supabase.from('cadastros_pendentes').delete().eq('email', email);
    return res.status(500).json({ error: 'Erro ao enviar e-mail.' });
  }

  res.cookie('pending_email', email, { httpOnly: true, maxAge: 600000 }); // 10 minutos
  res.json({ success: true });
});

app.post('/api/confirm', async (req, res) => {
  const { code } = req.body;
  const email = req.cookies.pending_email;

  if (!email || !code)
    return res.status(400).json({ error: 'Sessão expirada.' });

  // Buscar cadastro pendente
  const { data: pending, error } = await supabase
    .from('cadastros_pendentes')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !pending) {
    return res.status(400).json({ error: 'Sessão expirada ou inválida.' });
  }

  // Verificar expiração
  if (new Date(pending.expira_em) < new Date()) {
    await supabase.from('cadastros_pendentes').delete().eq('email', email);
    return res.status(400).json({ error: 'Código expirado. Cadastre-se novamente.' });
  }

  // Verificar código
  if (pending.codigo_confirmacao !== code) {
    return res.status(400).json({ error: 'Código inválido.' });
  }

  // Criar usuário
  const { error: insertUserError } = await supabase
    .from('usuarios')
    .insert({
      username: pending.username,
      email: pending.email,
      senha_hash: pending.senha_hash
    });

  if (insertUserError) {
    console.error('Erro ao criar usuário:', insertUserError);
    return res.status(500).json({ error: 'Erro ao confirmar cadastro.' });
  }

  // Remover pendente
  await supabase.from('cadastros_pendentes').delete().eq('email', email);

  // Gerar token
  const token = jwt.sign({ username: pending.username, email: pending.email }, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('token', token, { httpOnly: true, maxAge: 86400000 });
  res.json({ success: true });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const { data: user, error } = await supabase
    .from('usuarios')
    .select('email, senha_hash, username')
    .eq('email', email)
    .single();

  if (error || !user) {
    return res.status(400).json({ error: 'Conta não cadastrada.' });
  }

  const valid = await bcrypt.compare(password, user.senha_hash);
  if (!valid) return res.status(400).json({ error: 'Senha incorreta.' });

  const token = jwt.sign({ username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('token', token, { httpOnly: true, maxAge: 86400000 });
  res.json({ success: true });
});

app.post('/api/noticias', auth, upload.single('imagem'), async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL)
    return res.status(403).json({ error: 'Acesso negado.' });

  const { titulo, descricao } = req.body;
  const imagem = req.file;
  if (!titulo || !imagem)
    return res.status(400).json({ error: 'Título e imagem são obrigatórios.' });

  const { error } = await supabase
    .from('noticias')
    .insert({
      titulo,
      descricao: descricao || null,
      imagem_url: `/uploads/${imagem.filename}`,
      autor_email: ADMIN_EMAIL
    });

  if (error) {
    console.error('Erro ao publicar notícia:', error);
    return res.status(500).json({ error: 'Falha ao publicar notícia.' });
  }

  res.json({ success: true });
});

app.delete('/api/noticias/:id', auth, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL)
    return res.status(403).json({ error: 'Acesso negado.' });

  const id = parseInt(req.params.id);
  const { error } = await supabase
    .from('noticias')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir notícia:', error);
    return res.status(500).json({ error: 'Falha ao excluir notícia.' });
  }

  res.json({ success: true });
});

app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

// 404
app.use((req, res) => {
  res.status(404).send('<h1>404 - Página não encontrada</h1>');
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});