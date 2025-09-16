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
            localStorage.setItem('loggedUser', email);
            localStorage.setItem('nomeUsuario', data.nome); // Salva o nome vindo do servidor
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

    localStorage.setItem('pendingEmail', email); // Salva para usar na confirmação

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
            localStorage.setItem('loggedUser', email);
            localStorage.setItem('nomeUsuario', data.nome); // ✅ Salva o nome real
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


