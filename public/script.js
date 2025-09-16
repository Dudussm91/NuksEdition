// =============
// LOGIN
// =============

async function fazerLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value.trim();

    if (!email || !senha) {
        alert('❌ Preencha e-mail e senha!');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`✅ ${data.message}`);
            localStorage.setItem('loggedUser', email); // só salva o e-mail para identificação
            window.location.href = 'home.html';
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Erro de conexão:', error);
        alert('❌ Erro de conexão. Verifique sua internet.');
    }
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

    const codigo = Math.floor(1000 + Math.random() * 9000).toString();

    try {
        const response = await fetch('/api/cadastrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha, codigo })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`✅ ${data.message}`);
            window.location.href = 'confirmar.html';
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Erro de conexão:', error);
        alert('❌ Erro de conexão. Verifique sua internet.');
    }
}

// =============
// CONFIRMAÇÃO DE CÓDIGO
// =============

async function confirmarCodigo() {
    const email = document.getElementById('emailInput').value.trim();
    const codigoDigitado = document.getElementById('codigoInput').value.trim();

    if (!email || !codigoDigitado) {
        alert('❌ Preencha e-mail e código!');
        return;
    }

    try {
        const response = await fetch('/api/confirmar-codigo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, codigo: codigoDigitado })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`✅ ${data.message}`);
            localStorage.setItem('loggedUser', email); // salva no localStorage do navegador atual
            window.location.href = 'home.html';
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Erro de conexão:', error);
        alert('❌ Erro de conexão. Verifique sua internet.');
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
            nome: "Usuário",
            email: emailPendente,
            senha: "senha",
            codigo: novoCodigo
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert(`✅ ${data.message}`);
        } else {
            alert(`❌ ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Erro ao reenviar:', error);
        alert('❌ Erro de conexão. Verifique sua internet.');
    });
}

// =============
// SISTEMA DE AMIGOS
// =============

let friendToRemove = null;

async function addFriend(e) {
    e.preventDefault();
    const loggedUser = localStorage.getItem('loggedUser');
    const friendEmail = document.getElementById('friendEmail').value.trim();

    if (!friendEmail) {
        alert('❌ Digite o e-mail do amigo.');
        return;
    }

    if (!loggedUser) {
        alert('❌ Faça login primeiro.');
        return;
    }

    try {
        const response = await fetch('/api/adicionar-amigo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loggedUser, friendEmail })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`✅ ${data.message}`);
            document.getElementById('friendEmail').value = '';
            loadPendingInvites();
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Erro de conexão:', error);
        alert('❌ Erro de conexão. Verifique sua internet.');
    }
}

async function loadPendingInvites() {
    const loggedUser = localStorage.getItem('loggedUser');
    if (!loggedUser) return;

    try {
        const response = await fetch('/api/convites-pendentes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loggedUser })
        });

        const data = await response.json();

        if (response.ok) {
            const container = document.getElementById('pendingList');
            if (data.invites.length === 0) {
                container.innerHTML = '<p>Nenhum convite pendente.</p>';
                return;
            }

            let html = '';
            data.invites.forEach(invite => {
                html += `
                    <div class="friend-item">
                        <div>
                            <strong>${invite.nome}</strong><br>
                            <small>${invite.email}</small>
                        </div>
                        <div>
                            <button onclick="acceptFriend('${invite.email}')">Aceitar</button>
                            <button onclick="rejectFriend('${invite.email}')">Recusar</button>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
        }
    } catch (error) {
        console.error('Erro ao carregar convites:', error);
    }
}

async function loadFriends() {
    const loggedUser = localStorage.getItem('loggedUser');
    if (!loggedUser) return;

    try {
        const response = await fetch('/api/meus-amigos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loggedUser })
        });

        const data = await response.json();

        if (response.ok) {
            const container = document.getElementById('friendsList');
            if (data.friends.length === 0) {
                container.innerHTML = '<p>Você ainda não tem amigos adicionados.</p>';
                return;
            }

            let html = '';
            data.friends.forEach(friend => {
                html += `
                    <div class="friend-item">
                        <div>
                            <strong>${friend.nome}</strong><br>
                            <small>${friend.email}</small>
                        </div>
                        <button onclick="removeFriend('${friend.email}')">Remover</button>
                    </div>
                `;
            });

            container.innerHTML = html;
        }
    } catch (error) {
        console.error('Erro ao carregar amigos:', error);
    }
}

async function acceptFriend(inviterEmail) {
    const loggedUser = localStorage.getItem('loggedUser');
    if (!loggedUser) return;

    try {
        const response = await fetch('/api/aceitar-amizade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loggedUser, inviterEmail })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`✅ ${data.message}`);
            loadPendingInvites();
            loadFriends();
        }
    } catch (error) {
        console.error('Erro ao aceitar amizade:', error);
    }
}

function rejectFriend(inviterEmail) {
    const loggedUser = localStorage.getItem('loggedUser');
    if (!loggedUser) return;

    const pendingKey = `pending_${loggedUser}`;
    if (global[pendingKey]) {
        global[pendingKey] = global[pendingKey].filter(email => email !== inviterEmail);
    }

    alert('❌ Convite recusado.');
    loadPendingInvites();
}

function removeFriend(friendEmail) {
    friendToRemove = friendEmail;
    document.getElementById('confirmModal').style.display = 'flex';
}

function confirmRemoveFriend(friendEmail) {
    const loggedUser = localStorage.getItem('loggedUser');
    if (!loggedUser) return;

    // Remover amigo da lista do usuário
    if (friends.has(loggedUser)) {
        const myFriends = friends.get(loggedUser);
        friends.set(loggedUser, myFriends.filter(email => email !== friendEmail));
    }

    // Remover usuário da lista do amigo
    if (friends.has(friendEmail)) {
        const friendFriends = friends.get(friendEmail);
        friends.set(friendEmail, friendFriends.filter(email => email !== loggedUser));
    }

    alert('✅ Amigo removido.');
    friendToRemove = null;
    document.getElementById('confirmModal').style.display = 'none';
    loadFriends();
}

// =============
// SISTEMA DE NOTÍCIAS (mantido no localStorage por simplicidade)
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

        const data = await response.json();

        if (response.ok) {
            document.getElementById('codeModal').style.display = 'flex';
            document.getElementById('verificationCode').value = '';
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Erro ao enviar código:', error);
        alert('❌ Erro de conexão. Verifique sua internet.');
    }
}

function deleteAccount(email) {
    // Aqui você precisaria adicionar uma rota no server.js para excluir a conta
    // Por simplicidade, vamos manter no localStorage por enquanto
    localStorage.removeItem('loggedUser');
    alert('✅ Sua conta foi excluída com sucesso!');
    deleteCode = null;
    document.getElementById('codeModal').style.display = 'none';
    window.location.href = 'login.html';
}


