// ✅ URL DO SEU SERVIÇO NO VERCEL
const API_URL = 'https://nuksedition.vercel.app'; // <-- ALTERE SE PRECISAR

async function fazerLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value.trim();

    if (!email || !senha) {
        alert('❌ Preencha e-mail e senha!');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`✅ ${data.message}`);
            localStorage.setItem('loggedUser', email);
            localStorage.setItem('nomeUsuario', data.nome);
            window.location.href = 'home.html';
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Erro de conexão:', error);
        alert('❌ Erro de conexão. Verifique sua internet.');
    }
}

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

    localStorage.setItem('pendingEmail', email);

    try {
        const response = await fetch(`${API_URL}/api/cadastrar`, {
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

async function confirmarCodigo() {
    const email = localStorage.getItem('pendingEmail');
    const codigoDigitado = document.getElementById('codigoInput').value.trim();

    if (!email || !codigoDigitado) {
        alert('❌ Preencha e-mail e código!');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/confirmar-codigo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, codigo: codigoDigitado })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`✅ ${data.message}`);
            localStorage.setItem('loggedUser', email);
            localStorage.setItem('nomeUsuario', data.nome);
            window.location.href = 'home.html';
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Erro de conexão:', error);
        alert('❌ Erro de conexão. Verifique sua internet.');
    }
}

function reenviarCodigo() {
    const emailPendente = localStorage.getItem('pendingEmail');
    if (!emailPendente) {
        alert('❌ Nenhum cadastro pendente.');
        return;
    }

    const novoCodigo = Math.floor(1000 + Math.random() * 9000).toString();

    fetch(`${API_URL}/api/cadastrar`, {
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

let friendToRemove = null;

async function addFriend() {
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

    try {
        const response = await fetch(`${API_URL}/api/adicionar-amigo`, {
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
        console.error('Erro:', error);
        alert('❌ Erro de conexão.');
    }
}

async function loadPendingInvites() {
    const loggedUser = localStorage.getItem('loggedUser');
    if (!loggedUser) return;

    try {
        const response = await fetch(`${API_URL}/api/convites-pendentes`, {
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
        const response = await fetch(`${API_URL}/api/meus-amigos`, {
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
                        <div>
                            <button onclick="openChat('${friend.email}')">Chat</button>
                            <button onclick="removeFriend('${friend.email}')">Remover</button>
                        </div>
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
        const response = await fetch(`${API_URL}/api/aceitar-amizade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loggedUser, inviterEmail })
        });

        const data = await response.json();

        if (response.ok) {
            alert('✅ Amizade confirmada!');
            loadPendingInvites();
            loadFriends();
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Erro ao aceitar amizade:', error);
    }
}

function rejectFriend(inviterEmail) {
    alert('❌ Convite recusado.');
    loadPendingInvites();
}

function removeFriend(friendEmail) {
    friendToRemove = friendEmail;
    document.getElementById('confirmModal').style.display = 'flex';
}

async function removeFriendConfirmed(friendEmail) {
    const loggedUser = localStorage.getItem('loggedUser');
    if (!loggedUser) return;

    try {
        const response = await fetch(`${API_URL}/api/remover-amigo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loggedUser, friendEmail })
        });

        const data = await response.json();

        if (response.ok) {
            alert('✅ Amigo removido.');
            loadFriends();
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Erro ao remover amigo:', error);
    }
}

function openChat(friendEmail) {
    window.location.href = `chat.html?friend=${encodeURIComponent(friendEmail)}`;
}

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
        const loggedUser = localStorage.getItem('loggedUser');

        fetch(`${API_URL}/api/noticias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                description: description,
                image: imageUrl,
                loggedUser: loggedUser
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                alert('✅ Notícia publicada com sucesso!');
                document.getElementById('newsForm').reset();
                loadNews();
            } else {
                alert(`❌ ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Erro ao publicar notícia:', error);
            alert('❌ Erro de conexão.');
        });
    };

    reader.readAsDataURL(file);
}

function loadNews() {
    fetch(`${API_URL}/api/noticias`)
    .then(response => response.json())
    .then(data => {
        const loggedUser = localStorage.getItem('loggedUser');
        const admins = ['eduardomarangoni36@gmail.com', 'nukseditionofc@gmail.com'];
        const isAdmin = admins.includes(loggedUser);

        const newsList = data.noticias || [];
        const container = document.getElementById('newsList');

        if (newsList.length === 0) {
            container.innerHTML = '<p>Nenhuma notícia publicada ainda.</p>';
            return;
        }

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
    })
    .catch(error => {
        console.error('Erro ao carregar notícias:', error);
        document.getElementById('newsList').innerHTML = '<p>❌ Erro ao carregar notícias.</p>';
    });
}

function deleteNews(newsId) {
    newsToDelete = newsId;
    document.getElementById('confirmDeleteModal').style.display = 'flex';
}

function confirmDeleteNews() {
    if (!newsToDelete) return;

    const loggedUser = localStorage.getItem('loggedUser');

    fetch(`${API_URL}/api/noticias/${newsToDelete}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loggedUser: loggedUser })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert('✅ Notícia excluída com sucesso!');
            newsToDelete = null;
            document.getElementById('confirmDeleteModal').style.display = 'none';
            loadNews();
        } else {
            alert(`❌ ${data.error}`);
        }
    })
    .catch(error => {
        console.error('Erro ao excluir notícia:', error);
        alert('❌ Erro de conexão.');
    });
}

let deleteCode = null;

async function sendVerificationCode(email) {
    deleteCode = Math.floor(1000 + Math.random() * 9000).toString();

    try {
        const response = await fetch(`${API_URL}/api/enviar-codigo-exclusao`, {
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

async function deleteAccount(email) {
    try {
        const response = await fetch(`${API_URL}/api/excluir-conta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            alert('✅ Sua conta foi excluída com sucesso!');
            localStorage.removeItem('loggedUser');
            localStorage.removeItem('nomeUsuario');
            deleteCode = null;
            document.getElementById('codeModal').style.display = 'none';
            window.location.href = 'login.html';
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Erro ao excluir conta:', error);
        alert('❌ Erro de conexão. Tente novamente.');
    }
}

async function loadMessages() {
    const loggedUser = localStorage.getItem('loggedUser');
    const urlParams = new URLSearchParams(window.location.search);
    const currentFriend = urlParams.get('friend');

    if (!loggedUser || !currentFriend) return;

    try {
        const response = await fetch(`${API_URL}/api/carregar-mensagens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loggedUser, friendEmail: currentFriend })
        });

        const data = await response.json();

        if (response.ok) {
            const container = document.getElementById('chatMessages');
            container.innerHTML = '';

            if (data.messages.length === 0) {
                container.innerHTML = '<p>Nenhuma mensagem ainda. Seja o primeiro a enviar!</p>';
                return;
            }

            data.messages.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = 'message ' + (msg.sender === loggedUser ? 'sent' : 'received');
                const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                messageDiv.innerHTML = `
                    <div>${msg.text}</div>
                    <div style="font-size: 0.8rem; color: #666; text-align: ${msg.sender === loggedUser ? 'right' : 'left'};">${time}</div>
                `;
                container.appendChild(messageDiv);
            });

            container.scrollTop = container.scrollHeight;
        }
    } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
    }
}

async function sendMessage() {
    const loggedUser = localStorage.getItem('loggedUser');
    const urlParams = new URLSearchParams(window.location.search);
    const currentFriend = urlParams.get('friend');

    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text || !loggedUser || !currentFriend) return;

    try {
        const response = await fetch(`${API_URL}/api/enviar-mensagem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: loggedUser,
                receiver: currentFriend,
                text: text
            })
        });

        const data = await response.json();

        if (response.ok) {
            input.value = '';
            loadMessages();
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        alert('❌ Erro de conexão. Verifique sua internet.');
    }
}

