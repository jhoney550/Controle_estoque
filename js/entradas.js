// ENTRADA
// ===========================================================
// ===========================================================
let eState={sel:null,mode:null,tab:'lista',selAntesEdicao:null};
let entFiltroProduto = '';
let entFiltroData = '';
let entSortState = { sortCol: null, sortDir: 'asc' };

function entTab(t,btn){
  if(eState.mode&&t!==eState.tab){
    toast('a Tela esta em Edição, finalize o lançamento ou cancela a operação','warning');
    return;
  }
  document.querySelectorAll('#ent-tabs .nav-link').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  eState.tab=t;
  document.getElementById('ent-tab-lista').style.display=t==='lista'?'':'none';
  document.getElementById('ent-tab-man').style.display=t==='man'?'':'none';
  if(t==='lista')loadEntLista(); else loadEntMan();
}

function entTabLista(){
  document.querySelectorAll('#ent-tabs .nav-link').forEach(b=>b.classList.remove('active'));
  const btns=document.querySelectorAll('#ent-tabs .nav-link');
  if(btns[0])btns[0].classList.add('active');
  eState.tab='lista';
  document.getElementById('ent-tab-lista').style.display='';
  document.getElementById('ent-tab-man').style.display='none';
}

async function loadE(){
  await Promise.all([loadP(), loadEntradasSupabase()]);
  entTabLista();
  loadEntLista();
  loadEntMan();
}

function ordenarEntradasCache(){
  entradasCache.sort((a,b) => {
    const dataCmp = String(b.data||'').localeCompare(String(a.data||''));
    return dataCmp || String(b.id||'').localeCompare(String(a.id||''),'pt-BR',{numeric:true});
  });
}

function atualizarEntradaCache(entrada){
  const idx = entradasCache.findIndex(e => String(e.id) === String(entrada.id));
  if(idx >= 0){
    entradasCache[idx] = { ...entradasCache[idx], ...entrada };
  }else{
    entradasCache.push(entrada);
  }
  ordenarEntradasCache();
}

function refreshEntradasCadastro(){
  loadEntLista();
  loadEntMan();
}

function getProdutosCadastro(){
  return produtosCache;
}

function sugerirEntradaReqSupabase(){
  const ids = entradasCache
    .map(e => parseInt(e.req, 10))
    .filter(n => Number.isFinite(n));
  const proxBanco = (ids.length ? Math.max(...ids) : 0) + 1;
  return String(Math.max(DB.gi('req'), proxBanco)).padStart(6,'0');
}

function loadEntLista(){
  const ps=getProdutosCadastro();
  const tb=document.getElementById('ent-lista-tbody');
  tb.innerHTML='';

  const termo = normalizarTextoOrdenacao(entFiltroProduto).trim();
  let entradas = entradasCache.slice()
    .filter(e=>{
      const p=ps.find(x=>String(x.id)===String(e.pid));
      const nomeProduto=p?p.nome:e.pid;
      if(termo && !normalizarTextoOrdenacao(nomeProduto).includes(termo))return false;
      if(entFiltroData && String(e.data||'')!==String(entFiltroData))return false;
      return true;
    });

  if(entSortState.sortCol){
    entradas.sort((a,b)=>{
      const pa=ps.find(x=>String(x.id)===String(a.pid));
      const pb=ps.find(x=>String(x.id)===String(b.pid));
      let av=a[entSortState.sortCol];
      let bv=b[entSortState.sortCol];
      let tipo='texto';
      if(entSortState.sortCol==='produto'){
        av=pa?pa.nome:a.pid;
        bv=pb?pb.nome:b.pid;
      }else if(['qtd','unit','total'].includes(entSortState.sortCol)){
        tipo='numero';
      }else if(entSortState.sortCol==='data'){
        tipo='data';
      }
      const result=compararValoresOrdenacao(av,bv,tipo);
      return entSortState.sortDir==='asc'?result:-result;
    });
  }else{
    entradas.sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
  }

  if(!entradas.length){
    tb.innerHTML='<tr><td colspan="6" class="text-center text-muted py-3">Nenhum lançamento encontrado</td></tr>';
    atualizarIndicadoresOrdenacaoEntrada();
    return;
  }

  entradas.forEach(e=>{
    const p=ps.find(x=>String(x.id)===String(e.pid));
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${e.req}</td><td>${fmtD(e.data)}</td><td>${p?p.nome:e.pid}</td><td>${e.qtd}</td><td>R$ ${fmt(e.unit)}</td><td>R$ ${fmt(e.total)}</td>`;
    if(String(eState.sel)===String(e.id))tr.classList.add('sel');
    tr.onclick=()=>eSelect(e.id);
    tb.appendChild(tr);
  });
  atualizarIndicadoresOrdenacaoEntrada();
}

function entConsultarLancamentos(){
  const produto=document.getElementById('ent-filtro-produto');
  const data=document.getElementById('ent-filtro-data');
  entFiltroProduto=produto?produto.value.trim():'';
  entFiltroData=data?normalizarDataFiltro(data.value):'';
  loadEntLista();
}

function entFiltroKeydown(event){
  if(event.key==='Enter'){
    event.preventDefault();
    entConsultarLancamentos();
  }
}

function entOrdenarPor(coluna){
  if(eState.mode){
    toast('a Tela esta em Edição, finalize o lançamento ou cancela a operação','warning');
    return;
  }
  alternarOrdenacaoTabela(entSortState,coluna);
  loadEntLista();
}

function atualizarIndicadoresOrdenacaoEntrada(){
  ['req','data','produto','qtd','unit','total'].forEach(col=>{
    const el=document.getElementById(`ent-sort-${col}`);
    if(el)el.innerHTML=indicadorOrdenacao(entSortState,col);
  });
}

function loadEntMan(){
  const ps=getProdutosCadastro();
  const tb=document.getElementById('ent-man-tbody');
  if(!tb)return;
  tb.innerHTML='';
  entradasCache.slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||''))).forEach(e=>{
    const p=ps.find(x=>String(x.id)===String(e.pid));
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${e.req}</td><td>${fmtD(e.data)}</td><td>${p?p.nome:e.pid}</td><td>${e.qtd}</td>`;
    if(String(eState.sel)===String(e.id))tr.classList.add('sel');
    tr.onclick=()=>eSelect(e.id);
    tb.appendChild(tr);
  });
}

function eSelect(id){
  if(eState.mode)return;
  const e=entradasCache.find(x=>String(x.id)===String(id));
  if(!e)return;
  eState.sel=id;
  const p=getProdutosCadastro().find(x=>String(x.id)===String(e.pid));
  document.getElementById('e-req').value=e.req;
  document.getElementById('e-data').value=e.data;
  document.getElementById('e-prod-nome').value=p?p.nome:e.pid;
  document.getElementById('e-prod-id').value=e.pid;
  document.getElementById('e-qtd').value=e.qtd;
  document.getElementById('e-unit').value=e.unit;
  document.getElementById('e-total').value=e.total;
  document.getElementById('e-obs').value=e.obs||'';
  document.getElementById('e-btn-alt').disabled=false;
  document.getElementById('e-btn-exc').disabled=false;
  document.getElementById('e-btn-grav').disabled=true;
  loadEntMan();
}

function eEnableFields(on){
  ['e-req','e-data','e-prod-nome','e-qtd','e-unit','e-total','e-obs'].forEach(id=>document.getElementById(id).disabled=!on);
  document.getElementById('e-req').disabled=true;
  document.getElementById('e-lupa').disabled=!on;
}

function eIncluir(){
  if(telaEmEdicao()){toast('a Tela esta em Edição, finalize o lançamento ou cancela a operação','warning');return;}
  eState.selAntesEdicao=eState.sel;
  eState.mode='incluir';eState.sel=null;
  const rn=sugerirEntradaReqSupabase();
  document.getElementById('e-req').value=rn;
  document.getElementById('e-data').value=today();
  ['e-prod-nome','e-prod-id','e-qtd','e-unit','e-total','e-obs'].forEach(id=>document.getElementById(id).value='');
  eEnableFields(true);
  document.getElementById('e-btn-grav').disabled=false;
  document.getElementById('e-btn-alt').disabled=true;
  document.getElementById('e-btn-exc').disabled=true;
  document.getElementById('e-btn-can').style.display='';
  loadEntMan();
  setTimeout(()=>document.getElementById('e-prod-nome').focus(),50);
}

function eAlterar(){
  if(!eState.sel)return;
  eState.selAntesEdicao=eState.sel;
  eState.mode='alterar';
  eEnableFields(true);
  document.getElementById('e-btn-grav').disabled=false;
  document.getElementById('e-btn-alt').disabled=true;
  document.getElementById('e-btn-exc').disabled=true;
  document.getElementById('e-btn-can').style.display='';
  setTimeout(()=>document.getElementById('e-prod-nome').focus(),50);
}

async function eGravar(){
  const req=document.getElementById('e-req').value.trim();
  const data=document.getElementById('e-data').value;
  const pid=document.getElementById('e-prod-id').value;
  const qtd=parseFloat(document.getElementById('e-qtd').value)||0;
  const unit=converterMoedaParaFloat(document.getElementById('e-unit').value);
  const total=converterMoedaParaFloat(document.getElementById('e-total').value);
  const obs=document.getElementById('e-obs').value.trim();
  if(!req){toast('Nr. Requisição obrigatório!','danger');return;}
  if(!data){toast('Data obrigatória!','danger');return;}
  if(!pid){toast('Selecione um produto!','danger');return;}
  if(qtd<=0){toast('Quantidade deve ser maior que zero!','danger');return;}
  if(total<=0){toast('Valor total deve ser maior que zero!','danger');return;}
  if(eState.mode==='incluir'){
   const novaEntrada = { req, data, pid, qtd, unit, total, obs };

const { data: entradaInserida, error } = await supabaseClient
  .from('entradas')
  .insert([novaEntrada])
  .select()
  .single();

if (error) {
  console.error(error);
  toast('Erro ao incluir entrada no banco.', 'danger');
  return;
}

eState.sel = entradaInserida.id;
atualizarEntradaCache(entradaInserida);
registrarAuditoriaEntrada('I', null, entradaInserida);
    const n=parseInt(req,10);
    DB.si('req',Number.isFinite(n)?Math.max(DB.gi('req'),n+1):DB.gi('req')+1);
  }else{
    const atual=entradasCache.find(e=>String(e.id)===String(eState.sel));
    if(atual){
      const saldosDepois=new Map();
      saldosDepois.set(String(atual.pid), getStock(atual.pid)-(+atual.qtd||0));
      saldosDepois.set(String(pid), (saldosDepois.get(String(pid)) ?? getStock(pid)) + qtd);
      for(const [pidSaldo,saldoDepois] of saldosDepois){
        if(saldoDepois<0){
          toast('Alteração não permitida, irá negativar o estoque!','danger');
          return;
        }
        if(getQtdVendida(pidSaldo)>0 && Math.abs(saldoDepois)<0.000001){
          toast('Alteração não permitida, produto com venda não pode ficar com estoque zerado!','danger');
          return;
        }
      }
      const entradaAlterada={...atual,req,data,pid,qtd,unit,total,obs};
      const { error } = await supabaseClient
        .from('entradas')
        .update({ req,data,pid,qtd,unit,total,obs })
        .eq('id', eState.sel);

      if(error){
        console.error(error);
        toast('Erro ao alterar entrada no banco.','danger');
        return;
      }

      atualizarEntradaCache(entradaAlterada);
      registrarAuditoriaEntrada('A', atual, entradaAlterada);
    }
  }
  eState.mode=null;
  eState.selAntesEdicao=null;
  toast('Entrada gravada com sucesso!');
  eEnableFields(false);
  eResetBtns();
  refreshEntradasCadastro();
}

async function eExcluir(){
  if(!eState.sel)return;
  const e=entradasCache.find(x=>String(x.id)===String(eState.sel));
  if(!e)return;
  // Check if deleting would negative the stock
  const curStock=getStock(e.pid);
  if(curStock-e.qtd<0){
    alert('Exclusão não permitida, irá negativar o estoque!');
    return;
  }
  if(!confirm('Confirma a exclusão deste lançamento?'))return;
  const { error } = await supabaseClient
    .from('entradas')
    .delete()
    .eq('id', eState.sel);

  if(error){
    console.error(error);
    toast('Erro ao excluir entrada no banco.','danger');
    return;
  }

  const entradaExcluidaId = eState.sel;
  entradasCache = entradasCache.filter(entrada => String(entrada.id) !== String(entradaExcluidaId));
  eState.sel=null;
  toast('Lançamento excluído!');
  eClearForm();eResetBtns();refreshEntradasCadastro();
}

function eCancelar(){
  const selParaRestaurar=eState.selAntesEdicao||eState.sel;
  eState.mode=null;
  eState.selAntesEdicao=null;
  eEnableFields(false);
  if(selParaRestaurar&&entradasCache.some(e=>String(e.id)===String(selParaRestaurar))){
    eSelect(selParaRestaurar);
    eEnableFields(false);
    eResetBtns();
    loadEntLista();
    return;
  }
  eClearForm();eResetBtns();loadEntLista();loadEntMan();
}

function eClearForm(){
  ['e-req','e-data','e-prod-nome','e-prod-id','e-qtd','e-unit','e-total','e-obs'].forEach(id=>document.getElementById(id).value='');
}

function eResetBtns(){
  document.getElementById('e-btn-alt').disabled=!eState.sel;
  document.getElementById('e-btn-exc').disabled=!eState.sel;
  document.getElementById('e-btn-grav').disabled=true;
  document.getElementById('e-btn-can').style.display='none';
}

function calcEnt(field){
  const q = parseFloat(document.getElementById('e-qtd').value)||0;
  const u = converterMoedaParaFloat(document.getElementById('e-unit').value);
  const t = converterMoedaParaFloat(document.getElementById('e-total').value);
  
  if(field==='qtd'||field==='unit'){
    if(q>0&&u>0) {
      let totalCalc = q * u;
      document.getElementById('e-total').value = "R$ " + totalCalc.toFixed(2).replace(".", ",");
    }
  }else if(field==='total'){
    if(q>0&&t>0) {
      let unitCalc = t / q;
      document.getElementById('e-unit').value = "R$ " + unitCalc.toFixed(2).replace(".", ",");
    }
  }
}

function eProdSearch(){
  const val=document.getElementById('e-prod-nome').value.trim().toLowerCase();
  document.getElementById('e-prod-id').value='';
  const dd=document.getElementById('e-dd');
  if(!val){dd.style.display='none';return;}
  const produtos=getProdutosCadastro();
  const produtoPorId=produtos.find(p=>String(p.id).toLowerCase()===val);
  if(produtoPorId){
    eProdSelect(produtoPorId.id,produtoPorId.nome);
    return;
  }
  const ps=produtos.filter(p=>p.nome.toLowerCase().includes(val)||String(p.id).toLowerCase().includes(val));
  if(!ps.length){dd.style.display='none';return;}
  dd.innerHTML=ps.map(p=>`<div class="dd-item" onclick="eProdSelect('${p.id}','${p.nome.replace(/'/g,"\\'")}')">${p.id} — ${p.nome} <span class="badge bg-secondary">${getStock(p.id)} un.</span></div>`).join('');
  dd.style.display='';
}

function eProdKeydown(e){
  if(e.key==='Tab'){
    e.preventDefault();
    const pid=document.getElementById('e-prod-id').value;
    if(pid){
      document.getElementById('e-dd').style.display='none';
      document.getElementById('e-qtd').focus();
      return;
    }
    const termo=document.getElementById('e-prod-nome').value.trim();
    if(!termo){openModalProd('ent');return;}
    const produtoPorId=getProdutosCadastro().find(p=>String(p.id).toLowerCase()===termo.toLowerCase());
    if(produtoPorId){
      eProdSelect(produtoPorId.id,produtoPorId.nome);
      return;
    }
    openModalProd('ent',termo);
  }
}

function eProdSelect(id,nome){
  document.getElementById('e-prod-id').value=id;
  document.getElementById('e-prod-nome').value=nome;
  document.getElementById('e-dd').style.display='none';
  setTimeout(()=>document.getElementById('e-qtd').focus(),50);
}

// ===========================================================
// ===========================================================
// VENDA (PDV)
// ===========================================================
// ===========================================================
