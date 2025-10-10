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
const PORT = process.env.PORT || 3000;

// Configurações
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = 'nukseditionofc@gmail.com'; // fixo
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Pastas
const VIEWS_DIR = path.join(__dirname, 'views');
const PUBLIC_VIEWS = path.join(VIEWS_DIR, 'public');
const PROTECT_VIEWS = path.join(VIEWS_DIR, 'protect');

// Multer (só para receber o arquivo em memória)
const upload = multer({ storage: multer.memoryStorage() });

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Sessão temporária (em memória)
let pendingConfirmations = {};

// Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Rota raiz
app.get('/', (req, res) => {
  res.redirect('/login');
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

  const {  noticias, error } = await supabase
    .from('noticias')
    .select('*')
    .order('data_publicacao', { ascending: false });

  if (error) {
    console.error('Erro ao buscar notícias:', error);
    return res.status(500).send('Erro ao carregar notícias.');
  }

  let conteudo = '';

  // Formulário só para admin
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

  // Listagem
  conteudo += `
    <div style="text-align:center;margin-top:40px;">
      <h2>Últimas Notícias</h2>
      ${
        noticias && noticias.length > 0
          ? noticias.map(n => {
              // Gera URL pública da imagem no Supabase
              const imageUrl = n.chave_imagem
                ? `${SUPABASE_URL}/storage/v1/object/public/noticias/${n.chave_imagem}`
                : '';
              return `
                <div style="border:1px solid #eee;padding:15px;margin:15px auto;max-width:600px;text-align:left;">
                  <h3>${n.titulo}</h3>
                  ${imageUrl ? `<img src="${imageUrl}" style="max-width:100%;height:auto;">` : ''}
                  ${n.descricao ? `<p>${n.descricao}</p>` : ''}
                  <p style="font-size:12px;color:#666;">📅 Publicado em ${new Date(n.data_publicacao).toLocaleDateString('pt-BR')}</p>
                  ${
                    req.user.email === ADMIN_EMAIL
                      ? `<button onclick="excluirNoticia(${n.id})" style="background:#c0392b;color:white;border:none;padding:5px 10px;cursor:pointer;">Excluir</button>`
                      : ''
                  }
                </div>
              `;
            }).join('')
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

  const {  existingUser } = await supabase
    .from('usuarios')
    .select('email')
    .eq('email', email)
    .single();
  if (existingUser) {
    return res.status(400).json({ error: 'Conta já cadastrada.' });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = await bcrypt.hash(password, 10);
  pendingConfirmations[email] = { code, username, hash };

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Confirme seu cadastro',
      html: `<h2>Seu código: ${code}</h2>`
    });
  } catch (err) {
    console.error('Erro ao enviar e-mail:', err);
    return res.status(500).json({ error: 'Erro ao enviar e-mail.' });
  }

  res.cookie('pending_email', email, { httpOnly: true, maxAge: 600000 });
  res.json({ success: true });
});

app.post('/api/confirm', async (req, res) => {
  const { code } = req.body;
  const email = req.cookies.pending_email;
  if (!email || !code)
    return res.status(400).json({ error: 'Sessão expirada.' });

  const p = pendingConfirmations[email];
  if (!p || p.code !== code)
    return res.status(400).json({ error: 'Código inválido.' });

  const { error } = await supabase
    .from('usuarios')
    .insert({ username: p.username, email, senha_hash: p.hash });

  if (error) {
    console.error('Erro ao inserir usuário:', error);
    return res.status(500).json({ error: 'Erro ao confirmar cadastro.' });
  }

  delete pendingConfirmations[email];
  const token = jwt.sign({ username: p.username, email }, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('token', token, { httpOnly: true, maxAge: 86400000 });
  res.json({ success: true });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const {  user } = await supabase
    .from('usuarios')
    .select('email, senha_hash, username')
    .eq('email', email)
    .single();

  if (!user) {
    return res.status(400).json({ error: 'Conta não cadastrada.' });
  }

  const valid = await bcrypt.compare(password, user.senha_hash);
  if (!valid) return res.status(400).json({ error: 'Senha incorreta.' });

  const token = jwt.sign({ username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('token', token, { httpOnly: true, maxAge: 86400000 });
  res.json({ success: true });
});

// Publicar notícia com upload no Supabase Storage
app.post('/api/noticias', auth, upload.single('imagem'), async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL)
    return res.status(403).json({ error: 'Acesso negado.' });

  const { titulo, descricao } = req.body;
  const imagem = req.file;
  if (!titulo || !imagem)
    return res.status(400).json({ error: 'Título e imagem são obrigatórios.' });

  // Nome único para a imagem
  const ext = path.extname(imagem.originalname);
  const fileName = `noticia_${Date.now()}_${Math.random().toString(36).substring(2, 10)}${ext}`;

  // Upload no bucket "noticias"
  const { data, error: uploadError } = await supabase.storage
    .from('noticias')
    .upload(fileName, imagem.buffer, {
      contentType: imagem.mimetype,
      upsert: false
    });

  if (uploadError) {
    console.error('Erro no upload:', uploadError);
    return res.status(500).json({ error: 'Falha ao enviar imagem.' });
  }

  // Salvar na tabela com a chave (nome do arquivo)
  const { error: dbError } = await supabase
    .from('noticias')
    .insert({
      titulo,
      descricao: descricao || null,
      chave_imagem: fileName, // ← salva só o nome do arquivo
      autor_email: ADMIN_EMAIL
    });

  if (dbError) {
    console.error('Erro ao salvar notícia:', dbError);
    // Opcional: tentar deletar a imagem se falhar o DB
    await supabase.storage.from('noticias').remove([fileName]);
    return res.status(500).json({ error: 'Falha ao publicar notícia.' });
  }

  res.json({ success: true });
});

app.delete('/api/noticias/:id', auth, async (req, res) => {
  if (req.user.email !== ADMIN_EMAIL)
    return res.status(403).json({ error: 'Acesso negado.' });

  const id = parseInt(req.params.id);

  // Primeiro, buscar a chave da imagem para deletar do Storage
  const {  noticia } = await supabase
    .from('noticias')
    .select('chave_imagem')
    .eq('id', id)
    .single();

  if (noticia?.chave_imagem) {
    await supabase.storage.from('noticias').remove([noticia.chave_imagem]);
  }

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

app.use((req, res) => {
  res.status(404).send('<h1>404 - Página não encontrada</h1>');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
