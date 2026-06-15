function produtoEntradaNome(pid){
  const p = produtosCache.find(x => String(x.id) === String(pid));
  return p ? `${p.id} - ${p.nome}` : String(pid || '');
}

function valorCampoEntrada(campo, ent){
  if(!ent)return '';
  if(campo==='data')return fmtD(ent.data);
  if(campo==='pid')return produtoEntradaNome(ent.pid);
  if(campo==='unit'||campo==='total')return `R$ ${fmt(ent[campo])}`;
  return String(ent[campo]??'');
}

function entradaCampoMudou(campo, anterior, atual){
  if(campo==='qtd'||campo==='unit'||campo==='total')return Math.abs((+anterior[campo]||0)-(+atual[campo]||0))>0.000001;
  return String(anterior[campo]??'')!==String(atual[campo]??'');
}
// Registro de auditoria
let auditoriaCache = [];

async function loadAuditoriaSupabase() {

  const { data, error } = await supabaseClient
    .from('auditoria')
    .select('*')
    .order('dia', { ascending: false });

  if (error) {
    console.error(error);
    toast('Erro ao carregar auditoria.', 'danger');
    auditoriaCache = [];
    return [];
  }

  auditoriaCache = data || [];

  return auditoriaCache;
}

function montarDetalheAuditoriaEntrada(tipo, anterior, atual){
  const alteracoes=montarAlteracoesAuditoriaEntrada(tipo, anterior, atual);
  return alteracoes.map(a=>{
    if(tipo==='I')return `valor atual - ${a.campo}: ${a.atual}`;
    return `valor anterior - ${a.campo}: ${a.anterior}; valor atual - ${a.atual}`;
  }).join(' | ')||'Sem alteração de valores';
}

function montarAlteracoesAuditoriaEntrada(tipo, anterior, atual){
  const campos=[
    ['req','nr. requisição'],
    ['data','data'],
    ['pid','produto'],
    ['qtd','quantidade'],
    ['unit','vlr. unitário'],
    ['total','vlr. total'],
    ['obs','observação']
  ];
  if(tipo==='I'){
    return campos.map(([campo,label])=>({campo:label,anterior:'',atual:valorCampoEntrada(campo, atual)}));
  }
  return campos
    .filter(([campo])=>entradaCampoMudou(campo, anterior, atual))
    .map(([campo,label])=>({campo:label,anterior:valorCampoEntrada(campo, anterior),atual:valorCampoEntrada(campo, atual)}));
}

async function registrarAuditoriaEntrada(
  tipo,
  anterior,
  atual
){

  const alteracoes =
    montarAlteracoesAuditoriaEntrada(
      tipo,
      anterior,
      atual
    );

  const detalhe =
    montarDetalheAuditoriaEntrada(
      tipo,
      anterior,
      atual
    );

  const { error } = await supabaseClient
    .from('auditoria')
    .insert([{
      chave: 'entrada',
      target_id: String(
        atual?.id ||
        anterior?.id ||
        ''
      ),
      req: String(
        atual?.req ||
        anterior?.req ||
        ''
      ),
      usuario: nomeUsuarioLogado(),
      tipo,
      dia: new Date().toISOString(),
      alteracoes,
      detalhe
    }]);

  if(error){
    console.error(error);
  }
}

async function abrirDedoDuroEntrada(){
  const entradaSelecionada=entradasCache.find(e=>String(e.id)===String(eState.sel));
  const reqAtual=document.getElementById('e-req')?.value?.trim()||'';
  const entradaId=entradaSelecionada?.id||eState.sel||'';
  const req=entradaSelecionada?.req||reqAtual;
  if(!entradaId&&!req){
    toast('Selecione um lançamento na aba Lista para ver o Dedo Duro.','warning');
    return;
  }
  await loadAuditoriaSupabase();

  const logs=auditoriaCache
    .filter(l=>{
      if(String(l.chave)!=='entrada')return false;
      if(entradaId&&String(l.target_id)===String(entradaId))return true;
      return req&&String(l.req)===String(req);
    })
    .sort((a,b)=>String(b.dia||'').localeCompare(String(a.dia||'')));
  renderDedoDuroLogs('Dedo Duro - Entrada de Estoque', logs);
}

function formatarValorAuditoria(valor){
  if(Array.isArray(valor))return valor.map(i=>i?.nome?`${i.nome} (${i.qtd} x R$ ${fmt(i.unit)})`:JSON.stringify(i)).join(' | ');
  if(valor&&typeof valor==='object')return JSON.stringify(valor);
  return String(valor??'');
}

function montarAlteracoesGenericas(campos, anterior, atual, tipo){
  if(tipo==='I'){
    return campos.map(([campo,label,fmtFn])=>({campo:label,anterior:'',atual:fmtFn?fmtFn(atual?.[campo], atual):formatarValorAuditoria(atual?.[campo])}));
  }
  return campos
    .filter(([campo])=>formatarValorAuditoria(anterior?.[campo])!==formatarValorAuditoria(atual?.[campo]))
    .map(([campo,label,fmtFn])=>({
      campo:label,
      anterior:fmtFn?fmtFn(anterior?.[campo], anterior):formatarValorAuditoria(anterior?.[campo]),
      atual:fmtFn?fmtFn(atual?.[campo], atual):formatarValorAuditoria(atual?.[campo])
    }));
}

function formatarDataHoraDedoDuro(valor){
  if(!valor)return '';
  const d = new Date(valor);
  if(Number.isNaN(d.getTime()))return String(valor);
  const dia = String(d.getDate()).padStart(2,'0');
  const mes = String(d.getMonth()+1).padStart(2,'0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2,'0');
  const min = String(d.getMinutes()).padStart(2,'0');
  const seg = String(d.getSeconds()).padStart(2,'0');
  return `${dia}-${mes}-${ano} ${hora}:${min}:${seg}`;
}

async function registrarAuditoriaGenerica(chave, targetId, tipo, anterior, atual, campos, req=''){
  const alteracoes = montarAlteracoesGenericas(campos, anterior, atual, tipo);

  const { error } = await supabaseClient
    .from('auditoria')
    .insert([{
      chave,
      target_id: String(targetId ?? ''),
      req: String(req || targetId || ''),
      usuario: nomeUsuarioLogado(),
      tipo,
      dia: new Date().toISOString(),
      alteracoes
    }]);

  if(error){
    console.error('Erro auditoria:', error);
    toast('Erro ao registrar auditoria.', 'danger');
  }
}

function renderDedoDuroLogs(titulo, logs){
  document.getElementById('dedo-duro-title').innerHTML=`<i class="fas fa-hand-point-right me-2"></i>${escHtml(titulo)}`;
  const grid=document.getElementById('dedo-duro-entrada-grid');
  grid.innerHTML=logs.length?logs.map(l=>{
    const dia=formatarDataHoraDedoDuro(l.dia);
    const alteracoes=Array.isArray(l.alteracoes)&&l.alteracoes.length?l.alteracoes:[{campo:'detalhe',anterior:'',atual:l.detalhe||''}];
    return `<table class="excel-log-table">
      <thead><tr><th>usuario</th><th>tipo</th><th>data</th></tr></thead>
      <tbody>
        <tr><td>${escHtml(l.usuario)}</td><td>${escHtml(l.tipo)}</td><td>${escHtml(dia)}</td></tr>
        <tr><td colspan="3">&nbsp;</td></tr>
        <tr><th>campo</th><th>valor anterior</th><th>valor atual</th></tr>
        ${alteracoes.map(a=>`<tr><td>${escHtml(a.campo)}</td><td class="valor">${escHtml(a.anterior)}</td><td class="valor">${escHtml(a.atual)}</td></tr>`).join('')}
      </tbody>
    </table>`;
  }).join(''):'<div class="excel-log-empty">Nenhum registro encontrado</div>';
  new bootstrap.Modal(document.getElementById('modalDedoDuroEntrada')).show();
}

async function abrirDedoDuroGenerico(chave, targetId, titulo){
  if(!targetId){
    toast('Selecione um registro para ver o Dedo Duro.','warning');
    return;
  }

  await loadAuditoriaSupabase();

  const logs = auditoriaCache
    .filter(l =>
      String(l.chave) === String(chave) &&
      (
        String(l.target_id) === String(targetId) ||
        String(l.req) === String(targetId)
      )
    )
    .sort((a,b) => String(b.dia || '').localeCompare(String(a.dia || '')));

  renderDedoDuroLogs(titulo, logs);
}

function vendaCancelada(v){
  return v?.cancelada === true || v?.cancelada === 1 || String(v?.cancelada || '').toLowerCase() === 'true' || String(v?.status || '').toLowerCase() === 'cancelada';
}

function getStock(pid){
  const ent = entradasCache.filter(e=>e.pid==pid).reduce((s,e)=>s+(+e.qtd||0),0);
  let vnd=0;
  vendasCache.filter(v=>!vendaCancelada(v)).forEach(v=>(v.itens||[]).forEach(i=>{if(i.pid==pid)vnd+=(+i.qtd||0);}));
  return ent-vnd;
}

function totalStock(){
  return getProdutosCadastro().reduce((s,p)=>s+getStock(p.id),0);
}

function getQtdVendida(pid){
  let vnd=0;
  vendasCache.filter(v=>!vendaCancelada(v)).forEach(v=>(v.itens||[]).forEach(i=>{if(i.pid==pid)vnd+=(+i.qtd||0);}));
  return vnd;
}
