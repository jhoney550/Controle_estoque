function usuarioLogado(){
  try { return JSON.parse(localStorage.getItem('gel_user') || 'null'); }
  catch(e){ return null; }
}

function usuarioLogadoAdmin(){
  const u = usuarioLogado();
  return !!u && String(u.user || '').trim().toLowerCase() === 'admin';
}

function nomeUsuarioLogado(){
  const u=usuarioLogado();
  return u?(u.nome||u.user||'Usuário'):'Usuário';
}

<!-- função para inicializar o banco de dados com um usuário admin padrão -->
function initDB(){
   
}

// LINHA 329 - Substituir a função efetuarLogin inteira por esta:
// LINHA 329 - Substituir a função efetuarLogin inteira por esta:
async function efetuarLogin() {
  const u = document.getElementById('login-username').value.trim();
  const s = document.getElementById('login-password').value;

  if(!u || !s){
    toast('Informe usuário e senha!', 'warning');
    return;
  }

  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('*')
    .ilike('user', u)
    .maybeSingle();

  if(error){
    console.error(error);
    toast('Erro ao validar login no banco.', 'danger');
    return;
  }

  if(!data){
    toast('Usuário não encontrado!', 'danger');
    return;
  }

 const senhaBanco = String(data.senha || '');
const senhaDigitadaCriptografada = enc(s);

if(senhaBanco !== senhaDigitadaCriptografada){
  toast('Senha incorreta!', 'danger');
  return;
}

  const statusAtual = (data.status || 'Ativo').toString().trim().toLowerCase();

  if(statusAtual !== 'ativo'){
    toast('Seu usuário está inativo! Contate o administrador.', 'danger');
    return;
  }

  localStorage.setItem('gel_user', JSON.stringify(data));
  await carregarPermissoesUsuario(data);
  aplicarMenuPermissoes();

  toast(`Bem-vindo de volta, ${data.nome || data.user}!`, 'success');

  document.getElementById('login-screen').style.display = 'none';

  nav(primeiraTelaPermitida());
}

function efetuarLogout() {
    if(telaEmEdicao()){
      toast('a Tela esta em Edição, finalize o lançamento ou cancela a operação','warning');
      return;
    }
    localStorage.removeItem('gel_user');
    permissoesUsuarioLogado = [];
    aplicarMenuPermissoes();
    const userField = document.getElementById('login-username');
    const passField = document.getElementById('login-password');
    const eyeIcon = document.getElementById('login-eye-icon');
    if (userField) userField.value = '';
    if (passField) {
      passField.value = '';
      passField.type = 'password';
    }
    if (eyeIcon) {
      eyeIcon.classList.remove('fa-eye-slash');
      eyeIcon.classList.add('fa-eye');
    }
    // Mostra a tela de login novamente
    document.getElementById('login-screen').style.display = 'flex';
    setTimeout(()=>userField&&userField.focus(),50);
}

async function recuperarSenha() {
  const userInp = prompt("Digite o 'Nome de Usuário' que deseja recuperar:");
  if(!userInp) return;

  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('*')
    .ilike('user', userInp.trim())
    .maybeSingle();

  if(error){
    console.error(error);
    alert('Erro ao buscar usuário no banco.');
    return;
  }

  if(data) {
    alert(`Instruções enviadas para o e-mail:\n👉 ${data.email || 'sem e-mail cadastrado'}\n\n(Simulação: Senha atual é: ${dec(data.senha)})`);
  } else {
    alert("Usuário não encontrado!");
  }
}

// Vincula o "Enter" do teclado no campo de senha da tela de login
// Coloque esta linha logo abaixo das funções ou dentro da inicialização
setTimeout(() => {
    const passField = document.getElementById('login-password');
    if(passField) {
        passField.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                efetuarLogin();
            }
        });
    }
}, 500);
