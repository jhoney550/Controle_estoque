// ===========================================================
// ===========================================================
// USUÃRIOS
// ===========================================================
// ===========================================================
let uState = { sel: null, mode: null, tab: 'lista', selAntesEdicao: null };
let usuariosCache = [];
let uSortState = { sortCol: null, sortDir: 'asc' };

function uTab(t,btn){
  if(uState.mode&&t!==uState.tab){
    toast('a Tela esta em EdiÃ§Ã£o, finalize o lanÃ§amento ou cancela a operaÃ§Ã£o','warning');
    return;
  }
  document.querySelectorAll('#u-tabs .nav-link').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  uState.tab=t;
  document.getElementById('u-tab-lista').style.display=t==='lista'?'':'none';
  document.getElementById('u-tab-man').style.display=t==='man'?'':'none';
  if(t==='lista'){
    renderUTable();
  }else{
    uRestaurarSelecao();
    uResetBtns();
  }
}

function uTabLista(){
  document.querySelectorAll('#u-tabs .nav-link').forEach(b=>b.classList.remove('active'));
  const btns=document.querySelectorAll('#u-tabs .nav-link');
  if(btns[0])btns[0].classList.add('active');
  uState.tab='lista';
  document.getElementById('u-tab-lista').style.display='';
  document.getElementById('u-tab-man').style.display='none';
}

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
    toast('Erro ao carregar usuÃ¡rios do banco.', 'danger');
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
  uTabLista();
  renderUTable();
  uRestaurarSelecao();
  uResetBtns();
}

function renderUTable(){
  const tb = document.getElementById('u-tbody');
  tb.innerHTML = '';

  const usuarios = usuariosCache.slice();
  if(uSortState.sortCol){
    usuarios.sort((a,b)=>{
      const result = compararValoresOrdenacao(a[uSortState.sortCol], b[uSortState.sortCol], 'texto');
      return uSortState.sortDir==='asc'?result:-result;
    });
  }

  usuarios.forEach(u => {
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
  atualizarIndicadoresOrdenacaoUsuarios();
}

function uOrdenarPor(coluna){
  if(uState.mode){
    toast('a Tela esta em EdiÃ§Ã£o, finalize o lanÃ§amento ou cancela a operaÃ§Ã£o','warning');
    return;
  }
  alternarOrdenacaoTabela(uSortState,coluna);
  renderUTable();
}

function atualizarIndicadoresOrdenacaoUsuarios(){
  ['user','nome'].forEach(col=>{
    const el=document.getElementById(`u-sort-${col}`);
    if(el)el.innerHTML=indicadorOrdenacao(uSortState,col);
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

  const adminSelecionado = String(u.user).toLowerCase() === 'admin';
  document.getElementById('u-btn-alt').disabled = !usuarioLogadoAdmin() || adminSelecionado;
  document.getElementById('u-btn-exc').disabled = !usuarioLogadoAdmin() || adminSelecionado;
  document.getElementById('u-btn-grav').disabled = true;

  renderUTable();
}

function uEnableFields(on,isNew=false){
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
    toast('a Tela esta em EdiÃ§Ã£o, finalize o lanÃ§amento ou cancela a operaÃ§Ã£o','warning');
    return;
  }

  uState.mode = 'incluir';
  uState.selAntesEdicao = uState.sel;
  uState.sel = null;

  uClearForm();

  document.getElementById('u-data').value = today();

  uEnableFields(true, true);

  document.getElementById('u-btn-grav').disabled = false;
  document.getElementById('u-btn-alt').disabled = true;
  document.getElementById('u-btn-exc').disabled =
    !uState.sel || !usuarioLogadoAdmin() || (u && String(u.user).toLowerCase() === 'admin');
  document.getElementById('u-btn-can').style.display = '';

  renderUTable();
  setTimeout(() => document.getElementById('u-nome').focus(), 50);
}

function uAlterar(){
  if(!uState.sel) return;

  uState.mode = 'alterar';
  uState.selAntesEdicao = uState.sel;

  uEnableFields(true);

  document.getElementById('u-btn-grav').disabled = false;
  document.getElementById('u-btn-alt').disabled = true;
  document.getElementById('u-btn-exc').disabled =
    !uState.sel || !usuarioLogadoAdmin() || (u && String(u.user).toLowerCase() === 'admin');
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
    toast('Nome e usuÃ¡rio sÃ£o obrigatÃ³rios!', 'danger');
    return;
  }

  const userExiste = usuariosCache.find(u =>
    u.user === user && String(u.id) !== String(uState.sel)
  );

  if(userExiste){
    toast('Nome de usuÃ¡rio jÃ¡ existe!', 'danger');
    return;
  }

  if(uState.mode === 'incluir'){
    if(!senha){
      toast('Senha Ã© obrigatÃ³ria!', 'danger');
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
      toast('Erro ao incluir usuÃ¡rio no banco.', 'danger');
      return;
    }

    uState.sel = usuarioInserido.id;
    atualizarUsuarioCache(usuarioInserido);
    registrarAuditoriaGenerica('usuarios', usuarioInserido.id, 'I', null, usuarioInserido, camposAuditoriaUsuario);
    toast('UsuÃ¡rio incluÃ­do com sucesso!');
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
      toast('Erro ao alterar usuÃ¡rio no banco.', 'danger');
      return;
    }

    atualizarUsuarioCache(usuarioAlterado);
    registrarAuditoriaGenerica('usuarios', uState.sel, 'A', usuarioAtual, usuarioAlterado, camposAuditoriaUsuario);
    toast('UsuÃ¡rio alterado com sucesso!');
  }

  uState.mode = null;
  uState.selAntesEdicao = null;
  uEnableFields(false);
  refreshUsuariosCadastro();
}

async function uExcluir(){
  if(!uState.sel) return;

  if(!usuarioLogadoAdmin()){
    toast('Apenas o usuario admin pode excluir usuarios.', 'danger');
    return;
  }

  const u = usuariosCache.find(x => String(x.id) === String(uState.sel));
  if(!u) return;

  if(u.user === 'admin'){
    toast('O usuÃ¡rio admin nÃ£o pode ser excluÃ­do!', 'danger');
    return;
  }

  const { data: permissoes, error: permissoesError } = await supabaseClient
    .from('usuario_permissoes')
    .select('id')
    .eq('usuario_id', String(u.id))
    .limit(1);

  if(permissoesError){
    console.error(permissoesError);
    toast('Erro ao verificar liberacao de tela do usuario.', 'danger');
    return;
  }

  if((permissoes || []).length){
    toast('Exclusão não Permitir, verifica a liberação de tela do usuario', 'warning');
    return;
  }

  if(!confirm(`Excluir o usuÃ¡rio ${u.user}?`)) return;

  const { error } = await supabaseClient
    .from('usuarios')
    .delete()
    .eq('id', uState.sel);

  if(error){
    console.error(error);
    toast('Erro ao excluir usuÃ¡rio.', 'danger');
    return;
  }

  uState.sel = null;
  usuariosCache = usuariosCache.filter(item => String(item.id) !== String(u.id));
  toast('UsuÃ¡rio excluÃ­do!');
  refreshUsuariosCadastro();
}

function uCancelar(){
  const selParaRestaurar=uState.selAntesEdicao||uState.sel;
  uState.mode=null;
  uState.sel=selParaRestaurar;
  uState.selAntesEdicao=null;
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

