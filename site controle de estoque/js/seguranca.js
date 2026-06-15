const TELAS_SEGURANCA = [
  { sec: 'produtos', grupo: 'cadastros', menu: 'Cadastros', desc: 'Cadastro de Produtos' },
  { sec: 'entrada', grupo: 'movimentacao', menu: 'Movimentacao', desc: 'Entrada de Estoque' },
  { sec: 'venda', grupo: 'movimentacao', menu: 'Movimentacao', desc: 'Venda (PDV)' },
  { sec: 'rel-entrada', grupo: 'relatorios', menu: 'Relatorios', desc: 'Rel. Entrada' },
  { sec: 'rel-venda', grupo: 'relatorios', menu: 'Relatorios', desc: 'Rel. Venda' }
];

let permissoesUsuarioLogado = [];
let segUsuarioSel = null;
let segGrupoSel = 'cadastros';
let segPermissoes = [];
let segTelaDisponivelSel = null;
let segTelaLiberadaSel = null;
const SEG_PERMISSOES_TABELA = 'usuario_permissoes';

function segUsuarioId(usuario){
  return String(usuario?.id ?? usuario?.user ?? '');
}

function segUsuarioLabel(usuario){
  if(!usuario)return 'Selecione um usuario para liberar as telas';
  return `Selecionado: ${usuario.user || usuario.id} - ${usuario.nome || ''}`;
}

function telasLiberaveisSecoes(){
  return TELAS_SEGURANCA.map(t=>t.sec);
}

function usuarioEhAdmin(usuario=usuarioLogado()){
  return !!usuario && String(usuario.user || '').toLowerCase() === 'admin';
}

async function carregarPermissoesUsuario(usuario){
  if(usuarioEhAdmin(usuario)){
    permissoesUsuarioLogado = telasLiberaveisSecoes();
    return permissoesUsuarioLogado;
  }

  if(!supabaseClient || !usuario){
    permissoesUsuarioLogado = [];
    return permissoesUsuarioLogado;
  }

  const { data, error } = await supabaseClient
    .from(SEG_PERMISSOES_TABELA)
    .select('secao')
    .eq('usuario_id', segUsuarioId(usuario));

  if(error){
    console.error(error);
    toast(`Erro ao carregar permissoes: ${error.message || 'verifique as Estruturas.'}`, 'danger');
    permissoesUsuarioLogado = [];
    return permissoesUsuarioLogado;
  }

  permissoesUsuarioLogado = (data || []).map(p=>String(p.secao));
  return permissoesUsuarioLogado;
}

function segurancaTemAcesso(sec){
  if(sec === 'inicio' || sec === 'sobre')return true;
  if(usuarioLogadoAdmin())return true;
  if(sec === 'usuarios' || sec === 'seguranca')return false;
  if(!telasLiberaveisSecoes().includes(sec))return false;
  return permissoesUsuarioLogado.includes(sec);
}

function extrairSecaoNav(item){
  const onclick = item.getAttribute('onclick') || '';
  const match = onclick.match(/nav\('([^']+)'\)/);
  return match ? match[1] : '';
}

function aplicarMenuPermissoes(){
  document.querySelectorAll('#sidebar .nav-item').forEach(item=>{
    const sec = extrairSecaoNav(item);
    if(!sec)return;
    item.style.display = segurancaTemAcesso(sec) ? '' : 'none';
  });

  const filhos = Array.from(document.querySelectorAll('#sidebar > *'));
  filhos.forEach((el,idx)=>{
    if(!el.classList.contains('nav-section'))return;
    let temItemVisivel = false;
    for(let i=idx+1;i<filhos.length;i++){
      const atual = filhos[i];
      if(atual.classList.contains('nav-section'))break;
      if(atual.classList.contains('nav-item') && atual.style.display !== 'none'){
        temItemVisivel = true;
        break;
      }
    }
    el.style.display = temItemVisivel ? '' : 'none';
  });
}

function primeiraTelaPermitida(){
  return 'inicio';
}

async function loadSeguranca(){
  if(!usuarioLogadoAdmin()){
    toast('Acesso permitido apenas para o usuario admin.', 'warning');
    nav(primeiraTelaPermitida());
    return;
  }

  if(!usuariosCache.length){
    await loadUsuariosSupabase();
    ordenarUsuariosCache();
  }

  await segCarregarPermissoes();
  await segGarantirPermissoesAdmin();
  await segCarregarPermissoes();
  renderSegUsuarios();
  if(!segUsuarioSel && usuariosCache.length)segUsuarioSel = segUsuarioId(usuariosCache[0]);
  renderSegTela();
}

async function segCarregarPermissoes(){
  const { data, error } = await supabaseClient
    .from(SEG_PERMISSOES_TABELA)
    .select('*')
    .order('usuario_id', { ascending: true });

  if(error){
    console.error(error);
    segPermissoes = [];
    toast(`Erro ao carregar liberacoes: ${error.message || 'execute o SQL em Estruturas.'}`, 'danger');
    return;
  }

  segPermissoes = data || [];
}

function segUsuarioSelecionado(){
  return usuariosCache.find(u=>segUsuarioId(u) === String(segUsuarioSel));
}

function segUsuarioSelecionadoAdmin(){
  return usuarioEhAdmin(segUsuarioSelecionado());
}

async function segGarantirPermissoesAdmin(){
  const admin = usuariosCache.find(u=>usuarioEhAdmin(u));
  if(!admin)return;

  const adminId = segUsuarioId(admin);
  const existentes = new Set(segPermissoes
    .filter(p=>String(p.usuario_id) === adminId)
    .map(p=>String(p.secao)));
  const faltantes = TELAS_SEGURANCA
    .filter(t=>!existentes.has(t.sec))
    .map(t=>({
      usuario_id: adminId,
      secao: t.sec,
      criado_por: nomeUsuarioLogado()
    }));

  if(!faltantes.length)return;

  const { error } = await supabaseClient
    .from(SEG_PERMISSOES_TABELA)
    .insert(faltantes);

  if(error){
    console.error(error);
    toast(`Nao foi possivel vincular automaticamente o admin: ${error.message || 'verifique o banco.'}`, 'warning');
  }
}

function renderSegUsuarios(){
  const tb = document.getElementById('seg-usuarios-tbody');
  if(!tb)return;
  tb.innerHTML = usuariosCache.map(u=>{
    const id = segUsuarioId(u);
    return `<tr onclick="segSelecionarUsuario('${escHtml(id)}')" class="${String(segUsuarioSel)===id?'sel':''}">
      <td>${escHtml(u.user || id)}</td>
      <td>${escHtml(u.nome || '')}</td>
    </tr>`;
  }).join('');
}

function segSelecionarUsuario(id){
  segUsuarioSel = String(id);
  segTelaDisponivelSel = null;
  segTelaLiberadaSel = null;
  renderSegUsuarios();
  renderSegTela();
}

function segSelecionarGrupo(grupo){
  segGrupoSel = grupo;
  segTelaDisponivelSel = null;
  segTelaLiberadaSel = null;
  document.querySelectorAll('#seg-menu-tabs .btn').forEach(btn=>{
    btn.classList.toggle('active', (btn.getAttribute('onclick') || '').includes(`'${grupo}'`));
  });
  renderSegTela();
}

function segPermissoesUsuario(usuarioId){
  const usuario = usuariosCache.find(u=>segUsuarioId(u) === String(usuarioId));
  if(usuarioEhAdmin(usuario))return telasLiberaveisSecoes();
  return segPermissoes
    .filter(p=>String(p.usuario_id) === String(usuarioId))
    .map(p=>String(p.secao));
}

function renderSegTela(){
  const usuario = segUsuarioSelecionado();
  const destaque = document.getElementById('seg-usuario-selecionado');
  if(destaque)destaque.textContent = segUsuarioLabel(usuario);

  const permissoes = segPermissoesUsuario(segUsuarioSel);
  const telasGrupo = TELAS_SEGURANCA.filter(t=>t.grupo === segGrupoSel);
  const liberadas = telasGrupo.filter(t=>permissoes.includes(t.sec));
  const disponiveis = telasGrupo.filter(t=>!permissoes.includes(t.sec));
  const adminSelecionado = usuarioEhAdmin(usuario);

  renderSegTabela('seg-liberadas-tbody', liberadas, 'liberada');
  renderSegTabela('seg-disponiveis-tbody', disponiveis, 'disponivel');
  segAtualizarBotoes(adminSelecionado);
}

function segAtualizarBotoes(adminSelecionado){
  const btnVincular = document.getElementById('seg-btn-vincular');
  const btnDesvincular = document.getElementById('seg-btn-desvincular');
  if(btnVincular)btnVincular.disabled = adminSelecionado;
  if(btnDesvincular)btnDesvincular.disabled = adminSelecionado;
}

function renderSegTabela(tbodyId, telas, tipo){
  const tb = document.getElementById(tbodyId);
  if(!tb)return;
  if(!segUsuarioSel){
    tb.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-3">Selecione um usuario</td></tr>';
    return;
  }
  if(!telas.length){
    tb.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-3">Nenhuma tela encontrada</td></tr>';
    return;
  }
  tb.innerHTML = telas.map(t=>{
    const selecionada = tipo === 'liberada' ? segTelaLiberadaSel === t.sec : segTelaDisponivelSel === t.sec;
    const fn = tipo === 'liberada' ? 'segSelecionarLiberada' : 'segSelecionarDisponivel';
    return `<tr onclick="${fn}('${escHtml(t.sec)}')" class="${selecionada?'sel':''}">
      <td>${escHtml(t.menu)}</td>
      <td>${escHtml(t.desc)}</td>
    </tr>`;
  }).join('');
}

function segSelecionarDisponivel(sec){
  segTelaDisponivelSel = sec;
  segTelaLiberadaSel = null;
  renderSegTela();
}

function segSelecionarLiberada(sec){
  segTelaLiberadaSel = sec;
  segTelaDisponivelSel = null;
  renderSegTela();
}

async function segVincularTela(){
  if(!segUsuarioSel){toast('Selecione um usuario.', 'warning');return;}
  if(!segTelaDisponivelSel){toast('Selecione uma tela disponivel.', 'warning');return;}
  if(segUsuarioSelecionadoAdmin()){toast('O usuario admin ja possui todas as telas liberadas.', 'warning');return;}

  const payload = {
    usuario_id: String(segUsuarioSel),
    secao: String(segTelaDisponivelSel),
    criado_por: nomeUsuarioLogado()
  };

  const { data: existentes, error: consultaError } = await supabaseClient
    .from(SEG_PERMISSOES_TABELA)
    .select('id')
    .eq('usuario_id', payload.usuario_id)
    .eq('secao', payload.secao)
    .limit(1);

  if(consultaError){
    console.error(consultaError);
    toast(`Erro ao consultar liberacao: ${consultaError.message || 'verifique o banco.'}`, 'danger');
    return;
  }

  if((existentes || []).length){
    toast('Esta tela ja esta liberada para o usuario.', 'warning');
    segTelaDisponivelSel = null;
    await segCarregarPermissoes();
    renderSegTela();
    return;
  }

  const { error } = await supabaseClient
    .from(SEG_PERMISSOES_TABELA)
    .insert([payload]);

  if(error){
    console.error(error);
    toast(`Erro ao vincular tela: ${error.message || 'verifique o banco.'}`, 'danger');
    return;
  }

  toast('Tela liberada para o usuario.');
  segTelaDisponivelSel = null;
  await segCarregarPermissoes();
  renderSegTela();
}

async function segDesvincularTela(){
  if(!segUsuarioSel){toast('Selecione um usuario.', 'warning');return;}
  if(!segTelaLiberadaSel){toast('Selecione uma tela liberada.', 'warning');return;}
  if(segUsuarioSelecionadoAdmin()){toast('O usuario admin nao pode ter telas desvinculadas.', 'warning');return;}

  const { error } = await supabaseClient
    .from(SEG_PERMISSOES_TABELA)
    .delete()
    .eq('usuario_id', String(segUsuarioSel))
    .eq('secao', String(segTelaLiberadaSel));

  if(error){
    console.error(error);
    toast(`Erro ao desvincular tela: ${error.message || 'verifique o banco.'}`, 'danger');
    return;
  }

  toast('Tela removida do usuario.');
  segTelaLiberadaSel = null;
  await segCarregarPermissoes();
  renderSegTela();
}

