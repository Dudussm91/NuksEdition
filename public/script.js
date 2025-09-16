// =============
// LOGIN
// =============

function fazerLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value.trim();

    if (!email || !senha) {
        alert('❌ Preencha e-mail e senha!');
        return;
    }

    const contaSalva = localStorage.getItem(email);
    if (!contaSalva) {
        alert('❌ E-mail não cadastrado!');
        return;
    }

    const conta = JSON.parse(contaSalva);
    if (conta.senha !== senha) {
        alert('❌ Senha incorreta!');
        return;
    }

    alert(`✅ Bem-vindo, ${conta.nome}!`);

    localStorage.setItem('loggedUser', email);
    window.location.href = 'home.html';
}

// =============
// CADASTRO
// =============

async function cadastrarUsuario() {
    const nome = document.getElementById('cadastroNome').value.trim();
    const email = document.getElementById('cadastroEmail').value.trim();
    const senha = document.getElementById('cadastroSenha').value.trim();
    const confirmar = document.getElementById('cadastroConfirmar').value.trim();

    if (!nome || !email || !senha || !confirmar) {
        alert('❌ Preencha todos os campos!');
        return;
    }

    if (senha.length < 6) {
        alert('❌ A senha deve ter pelo menos 6 caracteres!');
        return;
    }

    if (senha !== confirmar) {
        alert('❌ As senhas não coincidem!');
        return;
    }

    if (localStorage.getItem(email)) {
        alert('❌ Este e-mail já está cadastrado!');
        return;
    }

    const codigo = Math.floor(1000 + Math.random() * 9000).toString();

    try {
        const response = await fetch('/api/cadastrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha, codigo })
        });

        if (response.ok) {
            alert(`✅ Enviamos um código para ${email}`);
            // ✅ SALVA SÓ O E-MAIL PARA IDENTIFICAÇÃO (NÃO O CÓDIGO)
            localStorage.setItem('pendingEmail', email);
            window.location.href = 'confirmar.html';
        } else {
            const error = await response.json();
            alert(`❌ Falha ao enviar e-mail: ${error.error}`);
        }
    } catch (error) {
        console.error("Erro de conexão DETALHADO:", error);
        alert('❌ Erro de conexão. Detalhes no console (F12 → Console).');
    }
}

// =============
// CONFIRMAÇÃO DE CÓDIGO
// =============

async function confirmarCodigo() {
    const codigoDigitado = document.getElementById('codigoInput').value.trim();
    const email = localStorage.getItem('pendingEmail');

    if (!email) {
        alert('❌ Nenhum cadastro pendente.');
        window.location.href = 'cadastro.html';
        return;
    }

    try {
        const response = await fetch('/api/confirmar-codigo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, codigo: codigoDigitado })
        });

        if (response.ok) {
            const data = await response.json();
            // ✅ SALVA A CONTA APENAS APÓS CONFIRMAÇÃO
            localStorage.setItem(email, JSON.stringify({
                nome: data.nome,
                senha: data.senha
            }));
            localStorage.setItem('loggedUser', email);
            localStorage.removeItem('pendingEmail');
            alert(`🎉 Código confirmado! Bem-vindo, ${data.nome}!`);
            window.location.href = 'home.html';
        } else {
            const error = await response.json();
            alert(`❌ ${error.error}`);
        }
    } catch (error) {
        console.error("Erro ao confirmar código:", error);
        alert('❌ Erro de conexão. Tente novamente.');
    }
}

// =============
// REENVIAR CÓDIGO
// =============

function reenviarCodigo() {
    const emailPendente = localStorage.getItem('pendingEmail');
    if (!emailPendente) {
        alert('❌ Nenhum cadastro pendente.');
        return;
    }

    const novoCodigo = Math.floor(1000 + Math.random() * 9000).toString();

    fetch('/api/cadastrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nome: "Usuário", // não usado, mas necessário
            email: emailPendente,
            senha: "senha", // não usado, mas necessário
            codigo: novoCodigo
        })
    })
    .then(response => {
        if (response.ok) {
            alert(`✅ Novo código reenviado para ${emailPendente}! Verifique sua caixa de entrada.`);
        } else {
            alert('❌ Falha ao reenviar código. Tente novamente.');
        }
    })
    .catch(error => {
        console.error("Erro ao reenviar:", error);
        alert('❌ Erro de conexão. Verifique se o servidor está rodando.');
    });
}

// =============
// SISTEMA DE AMIGOS
// =============

let friendToRemove = null;

function addFriend(e) {
    e.preventDefault();
    const loggedUser = localStorage.getItem('loggedUser');
    const friendEmail = document.getElementById('friendEmail').value.trim();

    if (!friendEmail) {
        alert('❌ Digite o e-mail do amigo.');
        return;
    }

    if (friendEmail === loggedUser) {
        alert('❌ Você não pode adicionar sua própria conta.');
        return;
    }

    const friendAccount = localStorage.getItem(friendEmail);
    if (!friendAccount) {
        alert('❌ Este usuário não existe.');
        return;
    }

    const friendsKey = `friends_${loggedUser}`;
    const friends = JSON.parse(localStorage.getItem(friendsKey) || '[]');
    if (friends.includes(friendEmail)) {
        alert('✅ Vocês já são amigos!');
        return;
    }

    const pendingKey = `pending_${friendEmail}`;
    let pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    if (pending.includes(loggedUser)) {
        alert('⏳ Convite já enviado. Aguarde a resposta.');
        return;
    }

    pending.push(loggedUser);
    localStorage.setItem(pendingKey, JSON.stringify(pending));

    alert('✅ Amizade adicionada com sucesso!');
    document.getElementById('friendEmail').value = '';
    loadPendingInvites();
}

function loadPendingInvites() {
    const loggedUser = localStorage.getItem('loggedUser');
    const pendingKey = `pending_${loggedUser}`;
    const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    const container = document.getElementById('pendingList');

    if (pending.length === 0) {
        container.innerHTML = '<p>Nenhum convite pendente.</p>';
        return;
    }

    let html = '';
    pending.forEach(inviterEmail => {
        const inviterAccount = JSON.parse(localStorage.getItem(inviterEmail));
        const inviterName = inviterAccount ? inviterAccount.nome : inviterEmail;
        html += `
            <div class="friend-item">
                <div>
                    <strong>${inviterName}</strong><br>
                    <small>${inviterEmail}</small>
                </div>
                <div>
                    <button onclick="acceptFriend('${inviterEmail}')">Aceitar</button>
                    <button onclick="rejectFriend('${inviterEmail}')">Recusar</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function loadFriends() {
    const loggedUser = localStorage.getItem('loggedUser');
    const friendsKey = `friends_${loggedUser}`;
    const friends = JSON.parse(localStorage.getItem(friendsKey) || '[]');
    const container = document.getElementById('friendsList');

    if (friends.length === 0) {
        container.innerHTML = '<p>Você ainda não tem amigos adicionados.</p>';
        return;
    }

    let html = '';
    friends.forEach(friendEmail => {
        const friendAccount = JSON.parse(localStorage.getItem(friendEmail));
        const friendName = friendAccount ? friendAccount.nome : friendEmail;
        html += `
            <div class="friend-item">
                <div>
                    <strong>${friendName}</strong><br>
                    <small>${friendEmail}</small>
                </div>
                <button onclick="removeFriend('${friendEmail}')">Remover</button>
            </div>
        `;
    });

    container.innerHTML = html;
}

function acceptFriend(inviterEmail) {
    const loggedUser = localStorage.getItem('loggedUser');

    const myFriendsKey = `friends_${loggedUser}`;
    let myFriends = JSON.parse(localStorage.getItem(myFriendsKey) || '[]');
    if (!myFriends.includes(inviterEmail)) {
        myFriends.push(inviterEmail);
        localStorage.setItem(myFriendsKey, JSON.stringify(myFriends));
    }

    const inviterFriendsKey = `friends_${inviterEmail}`;
    let inviterFriends = JSON.parse(localStorage.getItem(inviterFriendsKey) || '[]');
    if (!inviterFriends.includes(loggedUser)) {
        inviterFriends.push(loggedUser);
        localStorage.setItem(inviterFriendsKey, JSON.stringify(inviterFriends));
    }

    const pendingKey = `pending_${loggedUser}`;
    let pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    pending = pending.filter(email => email !== inviterEmail);
    localStorage.setItem(pendingKey, JSON.stringify(pending));

    alert('✅ Amizade confirmada!');
    loadPendingInvites();
    loadFriends();
}

function rejectFriend(inviterEmail) {
    const loggedUser = localStorage.getItem('loggedUser');
    const pendingKey = `pending_${loggedUser}`;
    let pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
    pending = pending.filter(email => email !== inviterEmail);
    localStorage.setItem(pendingKey, JSON.stringify(pending));

    alert('❌ Convite recusado.');
    loadPendingInvites();
}

function removeFriend(friendEmail) {
    friendToRemove = friendEmail;
    document.getElementById('confirmModal').style.display = 'flex';
}

function confirmRemoveFriend(friendEmail) {
    const loggedUser = localStorage.getItem('loggedUser');

    const myFriendsKey = `friends_${loggedUser}`;
    let myFriends = JSON.parse(localStorage.getItem(myFriendsKey) || '[]');
    myFriends = myFriends.filter(email => email !== friendEmail);
    localStorage.setItem(myFriendsKey, JSON.stringify(myFriends));

    const friendFriendsKey = `friends_${friendEmail}`;
    let friendFriends = JSON.parse(localStorage.getItem(friendFriendsKey) || '[]');
    friendFriends = friendFriends.filter(email => email !== loggedUser);
    localStorage.setItem(friendFriendsKey, JSON.stringify(friendFriends));

    alert('✅ Amigo removido.');
    loadFriends();
}

// =============
// SISTEMA DE NOTÍCIAS
// =============

let newsToDelete = null;

function createNews(e) {
    e.preventDefault();
    const fileInput = document.getElementById('newsImageFile');
    const title = document.getElementById('newsTitle').value.trim();
    const description = document.getElementById('newsDescription').value.trim();

    if (!fileInput.files[0] || !title || !description) {
        alert('❌ Preencha todos os campos!');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const imageUrl = e.target.result;
        const id = Date.now().toString();
        const date = new Date().toLocaleDateString('pt-BR');

        const newsItem = {
            id: id,
            image: imageUrl,
            title: title,
            description: description,
            date: date
        };

        const newsKey = 'nuks_news';
        let newsList = JSON.parse(localStorage.getItem(newsKey) || '[]');
        newsList.push(newsItem);
        localStorage.setItem(newsKey, JSON.stringify(newsList));

        alert('✅ Notícia publicada com sucesso!');
        document.getElementById('newsForm').reset();
        loadNews();
    };

    reader.readAsDataURL(file);
}

function loadNews() {
    const loggedUser = localStorage.getItem('loggedUser');
    const admins = ['eduardomarangoni36@gmail.com', 'nukseditionofc@gmail.com'];
    const isAdmin = admins.includes(loggedUser);

    const newsKey = 'nuks_news';
    const newsList = JSON.parse(localStorage.getItem(newsKey) || '[]');
    const container = document.getElementById('newsList');

    if (newsList.length === 0) {
        container.innerHTML = '<p>Nenhuma notícia publicada ainda.</p>';
        return;
    }

    newsList.sort((a, b) => b.id - a.id);

    let html = '';
    newsList.forEach(news => {
        html += `
            <div class="news-item">
                <img src="${news.image}" alt="${news.title}" style="width:100%; max-height:300px; object-fit:cover; border-radius:10px; margin-bottom:20px;">
                <h3>${news.title}</h3>
                <p>${news.description}</p>
                <p class="date">Publicado em: ${news.date}</p>
        `;

        if (isAdmin) {
            html += `<button class="delete-btn" onclick="deleteNews('${news.id}')">Excluir</button>`;
        }

        html += `</div>`;
    });

    container.innerHTML = html;
}

function deleteNews(newsId) {
    newsToDelete = newsId;
    document.getElementById('confirmDeleteModal').style.display = 'flex';
}

function confirmDeleteNews() {
    if (!newsToDelete) return;

    const newsKey = 'nuks_news';
    let newsList = JSON.parse(localStorage.getItem(newsKey) || '[]');
    newsList = newsList.filter(news => news.id !== newsToDelete);
    localStorage.setItem(newsKey, JSON.stringify(newsList));

    alert('✅ Notícia excluída com sucesso!');
    newsToDelete = null;
    document.getElementById('confirmDeleteModal').style.display = 'none';
    loadNews();
}

// =============
// EXCLUSÃO DE CONTA
// =============

let deleteCode = null;

async function sendVerificationCode(email) {
    deleteCode = Math.floor(1000 + Math.random() * 9000).toString();

    try {
        const response = await fetch('/api/enviar-codigo-exclusao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, codigo: deleteCode })
        });

        if (response.ok) {
            document.getElementById('codeModal').style.display = 'flex';
            document.getElementById('verificationCode').value = '';
        } else {
            alert('❌ Falha ao enviar código. Tente novamente.');
        }
    } catch (error) {
        console.error('Erro ao enviar código:', error);
        alert('❌ Erro de conexão. Verifique se o servidor está rodando.');
    }
}

function deleteAccount(email) {
    localStorage.removeItem(email);
    localStorage.removeItem('loggedUser');

    const friendsKey = `friends_${email}`;
    localStorage.removeItem(friendsKey);

    alert('✅ Sua conta foi excluída com sucesso!');
    deleteCode = null;
    document.getElementById('codeModal').style.display = 'none';
    window.location.href = 'login.html';
}
