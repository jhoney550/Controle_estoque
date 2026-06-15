// ===========================================================
// ===========================================================
// USUÁRIOS
// ===========================================================
// ===========================================================
let uState = { sel: null, mode: null };
let usuariosCache = [];

const camposAuditoriaUsuario = [
  ['nome', 'nome'],
  ['user', 'login'],
  ['data', 'data'],
  ['email', 'email'],
  ['status', 'status']
];

async function loadUsuariosSupabase(){
  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('*')
    .order('nome', { ascending: true });

  if(error){
    console.error(error);
    toast('Erro ao carregar usuários do banco.', 'danger');
    usuariosCache = [];
    return [];
  }

  usuariosCache = data || [];
  return usuariosCache;
}

function ordenarUsuariosCache(){
  usuariosCache.sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR',{sensitivity:'base'}));
}

function atualizarUsuarioCache(usuario){
  const idx = usuariosCache.findIndex(u => String(u.id) === String(usuario.id));
  if(idx >= 0){
    usuariosCache[idx] = { ...usuariosCache[idx], ...usuario };
  }else{
    usuariosCache.push(usuario);
  }
  ordenarUsuariosCache();
}

function refreshUsuariosCadastro(){
  renderUTable();
  uRestaurarSelecao();
  uResetBtns();
}

async function loadU(){
  await loadUsuariosSupabase();
  renderUTable();
  uRestaurarSelecao();
  uResetBtns();
}

function renderUTable(){
  const tb = document.getElementById('u-tbody');
  tb.innerHTML = '';

  usuariosCache.forEach(u => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${escHtml(u.user)}</td>
      <td>${escHtml(u.nome)}</td>
    `;

    if(String(uState.sel) === String(u.id)){
      tr.classList.add('sel');
    }

    tr.onclick = () => uSelect(u.id);
    tb.appendChild(tr);
  });
}

function uSelect(id){
  if(uState.mode) return;

  const u = usuariosCache.find(x => String(x.id) === String(id));
  if(!u) return;

  uState.sel = u.id;

  document.getElementById('u-nome').value = u.nome || '';
  document.getElementById('u-user').value = u.user || '';
  document.getElementById('u-data').value = u.data || today();
  document.getElementById('u-senha').value = '';
  document.getElementById('u-email').value = u.email || '';
  document.getElementById('u-status').value = u.status || 'Ativo';

  document.getElementById('u-btn-alt').disabled = false;
  document.getElementById('u-btn-exc').disabled = false;
  document.getElementById('u-btn-grav').disabled = true;

  renderUTable();
}

function uEnableFields(on,isNew=false){
  document.getElementById('u-status').value = 'Ativo';
  document.getElementById('u-status').disabled=!on;
  document.getElementById('u-nome').disabled=!on;
  document.getElementById('u-user').disabled=!on||!isNew;
  document.getElementById('u-senha').disabled=!on;
  document.getElementById('u-eye-btn').disabled=!on;
  document.getElementById('u-email').disabled=!on;
  document.getElementById('u-data').disabled=true; // always readonly
}

function uRestaurarSelecao(){
  if(!uState.sel){
    uClearForm();
    return;
  }

  const u = usuariosCache.find(x => String(x.id) === String(uState.sel));
  if(!u){
    uState.sel = null;
    uClearForm();
    return;
  }

  document.getElementById('u-nome').value = u.nome || '';
  document.getElementById('u-user').value = u.user || '';
  document.getElementById('u-data').value = u.data || today();
  document.getElementById('u-senha').value = '';
  document.getElementById('u-email').value = u.email || '';
  document.getElementById('u-status').value = u.status || 'Ativo';
  document.getElementById('u-senha').placeholder = "Senha";
}

function uIncluir(){
  if(telaEmEdicao()){
    toast('a Tela esta em Edição, finalize o lançamento ou cancela a operação','warning');
    return;
  }

  uState.mode = 'incluir';
  uState.sel = null;

  uClearForm();

  document.getElementById('u-data').value = today();

  uEnableFields(true, true);

  document.getElementById('u-btn-grav').disabled = false;
  document.getElementById('u-btn-alt').disabled = true;
  document.getElementById('u-btn-exc').disabled = true;
  document.getElementById('u-btn-can').style.display = '';

  renderUTable();
  setTimeout(() => document.getElementById('u-nome').focus(), 50);
}

function uAlterar(){
  if(!uState.sel) return;

  uState.mode = 'alterar';

  uEnableFields(true);

  document.getElementById('u-btn-grav').disabled = false;
  document.getElementById('u-btn-alt').disabled = true;
  document.getElementById('u-btn-exc').disabled = true;
  document.getElementById('u-btn-can').style.display = '';
}

async function uGravar(){
  const nome = document.getElementById('u-nome').value.trim();
  const user = document.getElementById('u-user').value.trim();
  const senha = document.getElementById('u-senha').value;
  const data = document.getElementById('u-data').value;
  const email = document.getElementById('u-email').value.trim();
  const status = document.getElementById('u-status').value;

  if(!nome || !user){
    toast('Nome e usuário são obrigatórios!', 'danger');
    return;
  }

  const userExiste = usuariosCache.find(u =>
    u.user === user && String(u.id) !== String(uState.sel)
  );

  if(userExiste){
    toast('Nome de usuário já existe!', 'danger');
    return;
  }

  if(uState.mode === 'incluir'){
    if(!senha){
      toast('Senha é obrigatória!', 'danger');
      return;
    }

    const novoUsuario = {
      nome,
      user,
      senha: enc(senha),
      data: data || today(),
      email,
      status
    };

    const { data: usuarioInserido, error } = await supabaseClient
      .from('usuarios')
      .insert([novoUsuario])
      .select()
      .single();

    if(error){
      console.error(error);
      toast('Erro ao incluir usuário no banco.', 'danger');
      return;
    }

    uState.sel = usuarioInserido.id;
    atualizarUsuarioCache(usuarioInserido);
    registrarAuditoriaGenerica('usuarios', usuarioInserido.id, 'I', null, usuarioInserido, camposAuditoriaUsuario);
    toast('Usuário incluído com sucesso!');
  } else {
    const usuarioAtual = usuariosCache.find(u => String(u.id) === String(uState.sel));

    const payload = {
      nome,
      user,
      data: data || today(),
      email,
      status
    };

    if(senha){
      payload.senha = enc(senha);
    }

    const usuarioAlterado = { ...(usuarioAtual || {}), ...payload };

    const { error } = await supabaseClient
      .from('usuarios')
      .update(payload)
      .eq('id', uState.sel);

    if(error){
      console.error(error);
      toast('Erro ao alterar usuário no banco.', 'danger');
      return;
    }

    atualizarUsuarioCache(usuarioAlterado);
    registrarAuditoriaGenerica('usuarios', uState.sel, 'A', usuarioAtual, usuarioAlterado, camposAuditoriaUsuario);
    toast('Usuário alterado com sucesso!');
  }

  uState.mode = null;
  uEnableFields(false);
  refreshUsuariosCadastro();
}

async function uExcluir(){
  if(!uState.sel) return;

  const u = usuariosCache.find(x => String(x.id) === String(uState.sel));
  if(!u) return;

  if(u.user === 'admin'){
    toast('O usuário admin não pode ser excluído!', 'danger');
    return;
  }

  if(!confirm(`Excluir o usuário ${u.user}?`)) return;

  const { error } = await supabaseClient
    .from('usuarios')
    .delete()
    .eq('id', uState.sel);

  if(error){
    console.error(error);
    toast('Erro ao excluir usuário.', 'danger');
    return;
  }

  uState.sel = null;
  usuariosCache = usuariosCache.filter(item => String(item.id) !== String(u.id));
  toast('Usuário excluído!');
  refreshUsuariosCadastro();
}

function uCancelar(){
  uState.mode=null;
  uEnableFields(false);
  uRestaurarSelecao();
  uResetBtns();
  renderUTable();
}

function uClearForm(){
  ['u-nome','u-user','u-senha','u-data','u-email'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('u-status').value = 'Ativo';
  document.getElementById('u-senha').placeholder = "Senha";
}

function uResetBtns(){
  const u = uState.sel
    ? usuariosCache.find(x => String(x.id) === String(uState.sel))
    : null;

  document.getElementById('u-btn-alt').disabled =
    !uState.sel || !usuarioLogadoAdmin() || (u && String(u.user).toLowerCase() === 'admin');

  document.getElementById('u-btn-exc').disabled = true;
  document.getElementById('u-btn-grav').disabled = true;
  document.getElementById('u-btn-can').style.display = 'none';
}

// ===========================================================
