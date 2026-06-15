let vState={mode:null,itens:[],nrv:null,editId:null,itemEditIdx:null};

let vendasCache = [];
let vendaItensCache = [];

function vendaSubtotal(v=vState){
  return (v.itens||[]).reduce((s,i)=>s+(+i.total||0),0);
}

function vendaTotalComDesconto(v){
  const subtotal=vendaSubtotal(v);
  const desconto=Math.max(0,+v.desconto||0);
  return Math.max(0,subtotal-desconto);
}
async function loadVendasSupabase() {
  const { data, error } = await supabaseClient
    .from('vendas')
    .select('*')
    .order('dt', { ascending: false });

  if (error) {
    console.error(error);
    toast('Erro ao carregar vendas do banco.', 'danger');
    vendasCache = [];
    return [];
  }

  vendasCache = data || [];
  return vendasCache;
}

async function loadVendaItensSupabase() {
  const { data, error } = await supabaseClient
    .from('venda_itens')
    .select('*');

  if (error) {
    console.error(error);
    toast('Erro ao carregar itens das vendas.', 'danger');
    vendaItensCache = [];
    return [];
  }

  vendaItensCache = data || [];
  return vendaItensCache;
}

async function loadHome() {
  await loadPDVSupabase();

  const hoje = today();

  const vendasHoje = vendasCache.filter(v =>
    dataLocalISO(v.dt) === hoje && !vendaCancelada(v)
  );

  let faturamentoHoje = 0;
  let qtdHoje = 0;

  const mapaProdutos = {};

  vendasHoje.forEach(v => {

    faturamentoHoje += Number(v.total || 0);

    (v.itens || []).forEach(i => {

      const qtd = Number(i.qtd || 0);

      qtdHoje += qtd;

      if (!mapaProdutos[i.pid]) {
        mapaProdutos[i.pid] = {
          nome: i.nome,
          qtd: 0
        };
      }

      mapaProdutos[i.pid].qtd += qtd;
    });

  });

  const produtoTop =
    Object.values(mapaProdutos)
      .sort((a, b) => b.qtd - a.qtd)[0];

  document.getElementById('home-fat-hoje').textContent =
    'R$ ' + fmt(faturamentoHoje);

  document.getElementById('home-qtd-hoje').textContent =
    qtdHoje;

  document.getElementById('home-prod-top').textContent =
    produtoTop ? produtoTop.nome : 'Nenhum';

  document.getElementById('home-prod-top-qtd').textContent =
    produtoTop
      ? `${produtoTop.qtd} unidades hoje`
      : '0 unidades hoje';
}

async function loadPDVSupabase() {
  await carregarProdutosEstoquePDV();
  await loadVendasSupabase();
  await loadVendaItensSupabase();

  vendasCache = vendasCache.map(v => ({
    ...v,
    itens: vendaItensCache
      .filter(i => String(i.venda_id) === String(v.id))
      .map(i => ({
        pid: i.pid,
        nome: i.nome,
        qtd: Number(i.qtd || 0),
        unit: Number(i.unit || 0),
        total: Number(i.total || 0)
      }))
  }));

  return vendasCache;
}

async function carregarProdutosEstoquePDV(){
  produtosCache = await getProdutosSupabase();
  ordenarProdutosCache();
  await loadEntradasSupabase();
}

function proximoNumeroVenda() {
  const nums = vendasCache
    .map(v => parseInt(v.nrv, 10))
    .filter(n => Number.isFinite(n));

  return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(6, '0');
}

function formatarItensVendaAuditoria(itens){
  return (itens||[]).map(i=>`${i.nome||i.pid}: ${i.qtd} x R$ ${fmt(i.unit)} = R$ ${fmt(i.total)}`).join(' | ');
}

const camposAuditoriaVenda = [
  ['nrv', 'nr. venda'],
  ['dt', 'data/hora', v => v ? new Date(v).toLocaleString('pt-BR') : ''],
  ['qtd', 'quantidade'],
  ['subtotal', 'subtotal', v => `R$ ${fmt(v)}`],
  ['desconto', 'desconto', v => `R$ ${fmt(v)}`],
  ['total', 'total', v => `R$ ${fmt(v)}`],
  ['dinheiro', 'dinheiro', v => `R$ ${fmt(v)}`],
  ['troco', 'troco', v => `R$ ${fmt(v)}`],
  ['obs', 'observaÃ§Ã£o'],
  ['cancelada', 'cancelada', v => vendaCancelada({cancelada:v}) ? 'Sim' : 'NÃ£o'],
  ['cancelado_em', 'data cancelamento', v => v ? new Date(v).toLocaleString('pt-BR') : ''],
  ['cancelado_por', 'cancelado por'],
  ['cancel_obs', 'motivo cancelamento'],
  ['itens', 'produtos', v => formatarItensVendaAuditoria(v)]
];

function renderVHist(){
  const tb = document.getElementById('v-hist-tbody');
  if(!tb)return;
  tb.innerHTML = '';

  vendasCache
    .slice()
    .sort((a,b) => String(b.dt).localeCompare(String(a.dt)))
    .forEach(v => {
      const total = vendaTotalComDesconto(v);
      const qtd = ((v.itens || []).reduce((s,i) => s + (+i.qtd || 0), 0));
      const cancelada = vendaCancelada(v);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${v.nrv}</td>
        <td>${new Date(v.dt).toLocaleString('pt-BR')}</td>
        <td>${qtd}</td>
        <td>R$ ${fmt(total)}</td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary py-0" onclick="verVenda(${v.id})" title="Ver">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-outline-warning py-0" onclick="openVendaAdminAuth('editar',${v.id})" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-outline-danger py-0" onclick="openVendaAdminAuth('cancelar',${v.id})" title="Cancelar venda" ${cancelada?'disabled':''}>
              <i class="fas fa-ban"></i>
            </button>
            <button class="btn btn-dedo-duro py-0" onclick="abrirDedoDuroVenda(${v.id})" title="Dedo duro">
              <i class="fas fa-hand-point-right"></i>
            </button>
          </div>
          ${cancelada?'<span class="badge bg-danger ms-2">Venda cancelada</span>':''}
        </td>
      `;
      tb.appendChild(tr);
    });
}

async function loadVHist(){
  await loadPDVSupabase();
  renderVHist();
}

function ordenarVendasCache(){
  vendasCache.sort((a,b) => String(b.dt||'').localeCompare(String(a.dt||'')));
}

function atualizarVendaCache(venda){
  const idx = vendasCache.findIndex(v => String(v.id) === String(venda.id));
  if(idx >= 0){
    vendasCache[idx] = { ...vendasCache[idx], ...venda };
  }else{
    vendasCache.push(venda);
  }
  ordenarVendasCache();
}

function abrirDedoDuroVenda(id){
  const v=vendasCache.find(x=>String(x.id)===String(id));
  abrirDedoDuroGenerico('vendas', id, `Dedo Duro - Venda NÂº ${v?v.nrv:id}`);
}

function vIncluir(){
  if(telaEmEdicao()){toast('a Tela esta em EdiÃ§Ã£o, finalize o lanÃ§amento ou cancela a operaÃ§Ã£o','warning');return;}
  vState.mode='incluir';vState.itens=[];vState.nrv = proximoNumeroVenda();vState.editId=null;vState.itemEditIdx=null;
  document.getElementById('v-nrv-display').textContent = vState.nrv;
  vSetFields(true);
  ['v-dinheiro','v-desconto','v-troco'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.value=id==='v-troco'?'R$ 0,00':'';
  });
  document.getElementById('v-obs').disabled = false;
  document.getElementById('v-obs').value = '';
  document.getElementById('v-btn-exc').disabled=true;
  document.getElementById('v-btn-fin').disabled=false;
  document.getElementById('v-btn-can').style.display='';
  document.getElementById('v-btn-add').disabled=false;
  ['v-prod-input','v-prod-id','v-unit','v-total'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('v-qtd').value=1;
  renderCart();
  setTimeout(()=>document.getElementById('v-prod-input').focus(),50);
}

function vSetFields(on){
  document.getElementById('v-prod-input').disabled=!on;
  document.getElementById('v-lupa').disabled=!on;
  document.getElementById('v-qtd').disabled=!on;
  document.getElementById('v-unit').disabled=true;
}

function getUltimoCustoEntrada(pid){
  const entradas = entradasCache
    .filter(e => String(e.pid) === String(pid) && (+e.unit || 0) > 0)
    .sort((a,b) => {
      const dataCmp = String(b.data || '').localeCompare(String(a.data || ''));
      return dataCmp || ((+b.id || 0) - (+a.id || 0));
    });
  return entradas.length ? (+entradas[0].unit || 0) : 0;
}

function vPreencherCustoAutomatico(){
  const pid = document.getElementById('v-prod-id').value;
  const unitInput = document.getElementById('v-unit');
  if(!pid || converterMoedaParaFloat(unitInput.value) > 0)return;
  const custo = getUltimoCustoEntrada(pid);
  if(custo > 0){
    unitInput.value = 'R$ ' + fmt(custo);
    calcVenda();
  }
}

function calcVenda(){
  const q = parseFloat(document.getElementById('v-qtd').value)||0;
  const u = converterMoedaParaFloat(document.getElementById('v-unit').value);
  if(q>0&&u>0){
    let totalCalc = q * u;
    document.getElementById('v-total').value = "R$ " + totalCalc.toFixed(2).replace(".", ",");
  } else {
    document.getElementById('v-total').value = '';
  }
}

function getStockVenda(pid){
  return getDisponivelVenda(pid);
}

function getDisponivelVenda(pid, ignorarIdx=null){
  const ent = entradasCache
    .filter(e => String(e.pid) === String(pid))
    .reduce((s,e) => s + (+e.qtd || 0), 0);

  const vendidasBanco = vendasCache
    .filter(v => String(v.id) !== String(vState.editId))
    .filter(v => !vendaCancelada(v))
    .flatMap(v => v.itens || [])
    .filter(i => String(i.pid) === String(pid))
    .reduce((s,i) => s + (+i.qtd || 0), 0);

  const vendidasTela = (vState.itens || [])
    .filter((i,idx) => ignorarIdx === null || idx !== ignorarIdx)
    .filter(i => String(i.pid) === String(pid))
    .reduce((s,i) => s + (+i.qtd || 0), 0);

  return ent - vendidasBanco - vendidasTela;
}

function vValidarEstoqueQuantidade(showMsg=true){
  const pid=document.getElementById('v-prod-id').value;
  const qtd=parseFloat(document.getElementById('v-qtd').value)||0;
  const btn=document.getElementById('v-btn-add');
  const qtdInput=document.getElementById('v-qtd');
  if(!pid||qtd<=0){
    qtdInput.classList.remove('is-invalid');
    if(vState.mode)btn.disabled=false;
    return true;
  }
  const disp=getDisponivelVenda(pid, vState.itemEditIdx);
  if(disp<qtd){
    qtdInput.classList.add('is-invalid');
    btn.disabled=true;
    if(showMsg)toast(`Estoque insuficiente! DisponÃ­vel: ${disp} un.`,'danger');
    return false;
  }
  qtdInput.classList.remove('is-invalid');
  if(vState.mode)btn.disabled=false;
  return true;
}

function vAddItem(){
  const pid=document.getElementById('v-prod-id').value;
  const pnome=document.getElementById('v-prod-input').value;
  const qtd=parseFloat(document.getElementById('v-qtd').value)||0;
  const unit=converterMoedaParaFloat(document.getElementById('v-unit').value);
  const total=converterMoedaParaFloat(document.getElementById('v-total').value);
  
  if(!pid){toast('Selecione um produto!','danger');return;}
  if(qtd<=0){toast('Quantidade deve ser maior que zero!','danger');return;}
  if(unit<=0){toast('Informe o valor unitÃ¡rio!','danger');return;}
  
  if(!vValidarEstoqueQuantidade(true))return;
  const stock=getDisponivelVenda(pid, vState.itemEditIdx);
  if(stock<qtd){toast(`Estoque insuficiente! DisponÃ­vel: ${stock} un.`,'danger');return;}
  
  const atualizandoItem=vState.itemEditIdx!==null&&vState.itemEditIdx>=0;
  if(atualizandoItem){
    vState.itens[vState.itemEditIdx]={pid,nome:pnome,qtd,unit,total};
    vState.itemEditIdx=null;
  }else{
    const itemExistente = vState.itens.find(i => String(i.pid) === String(pid));
    if(itemExistente){
      itemExistente.qtd = (+itemExistente.qtd || 0) + qtd;
      itemExistente.total = (+itemExistente.total || 0) + total;
      itemExistente.unit = itemExistente.qtd > 0 ? itemExistente.total / itemExistente.qtd : unit;
      itemExistente.nome = itemExistente.nome || pnome;
    }else{
      vState.itens.push({pid,nome:pnome,qtd,unit,total});
    }
  }
  ['v-prod-input','v-prod-id','v-unit','v-total'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('v-qtd').value=1;
  document.getElementById('v-qtd').classList.remove('is-invalid');
  renderCart();
  toast(atualizandoItem?'Produto atualizado!':'Produto adicionado!');
  setTimeout(()=>document.getElementById('v-prod-input').focus(),50);
}

function vAddButtonKeydown(e){
  if(e.key==='Tab'){
    e.preventDefault();
    vAddItem();
  }
}

function renderCart(){
  const tb=document.getElementById('v-tbody');
  const em=document.getElementById('cart-empty');
  tb.innerHTML='';
  if(!vState.itens.length){em.style.display='';} else {
    em.style.display='none';
    vState.itens.forEach((item,idx)=>{
      const tr=document.createElement('tr');
      if(vState.itemEditIdx===idx)tr.classList.add('sel');
      tr.innerHTML=`<td>${item.nome}</td><td>${item.qtd}</td><td>R$ ${fmt(item.unit)}</td><td>R$ ${fmt(item.total)}</td><td><button class="btn btn-danger py-0 btn-sm" onclick="vRemItemClick(event,${idx})"><i class="fas fa-times"></i></button></td>`;
      tr.onclick=()=>vSelectCartItem(idx);
      tb.appendChild(tr);
    });
  }
  // LINHA 554 (Final da funÃ§Ã£o renderCart)
  const grand=vState.itens.reduce((s,i)=>s+i.total,0);
  document.getElementById('v-grand-total').textContent=fmt(grand);
  calcularTroco(); // Adicionado para recalcular se a lista mudar
}

function calcularTroco() {
    const subtotal = vendaSubtotal();
    const dinheiroInput = document.getElementById('v-dinheiro');
    const descontoInput = document.getElementById('v-desconto');
    const trocoInput = document.getElementById('v-troco');
    const subtotalEl = document.getElementById('v-final-subtotal');
    const totalEl = document.getElementById('v-final-total');
    if(!dinheiroInput || !descontoInput || !trocoInput)return;
    const dinheiro = converterMoedaParaFloat(dinheiroInput.value);
    const desconto = converterMoedaParaFloat(descontoInput.value);
    const totalVenda = Math.max(0, subtotal - desconto);
    if(subtotalEl)subtotalEl.textContent = "R$ " + fmt(subtotal);
    if(totalEl)totalEl.textContent = "R$ " + fmt(totalVenda);
    
    if (dinheiro === 0) {
        trocoInput.value = "R$ 0,00";
        trocoInput.classList.remove('text-success');
        trocoInput.classList.add('text-danger');
        return;
    }
    
    const resultado = dinheiro - totalVenda;
    
    if (resultado >= 0) {
        trocoInput.value = "R$ " + fmt(resultado);
        trocoInput.classList.remove('text-danger');
        trocoInput.classList.add('text-success');
    } else {
        trocoInput.value = "Falta R$ " + fmt(Math.abs(resultado));
        trocoInput.classList.remove('text-success');
        trocoInput.classList.add('text-danger');
    }
}

function vRemItem(idx){
  vState.itens.splice(idx,1);
  if(vState.itemEditIdx===idx)vState.itemEditIdx=null;
  else if(vState.itemEditIdx!==null&&vState.itemEditIdx>idx)vState.itemEditIdx--;
  renderCart();
}
function vRemItemClick(e,idx){
  e.stopPropagation();
  vRemItem(idx);
}
function vExcluirItem(){if(vState.itens.length)vRemItem(vState.itens.length-1);}

function vSelectCartItem(idx){
  if(vState.mode!=='editar')return;
  const item=vState.itens[idx];
  if(!item)return;
  vState.itemEditIdx=idx;
  document.getElementById('v-prod-id').value=item.pid;
  document.getElementById('v-prod-input').value=item.nome;
  document.getElementById('v-qtd').value=item.qtd;
  document.getElementById('v-unit').value='R$ '+fmt(item.unit);
  document.getElementById('v-total').value='R$ '+fmt(item.total);
  document.getElementById('v-qtd').classList.remove('is-invalid');
  renderCart();
  setTimeout(()=>document.getElementById('v-prod-input').focus(),50);
}

function vFinalizar() {
  if (vState.mode !== 'incluir' && vState.mode !== 'editar') {
    toast('Inicie uma nova venda clicando em Incluir!', 'danger');
    return;
  }
  if (!vState.itens.length) {
    toast('Adicione ao menos um produto antes de finalizar!', 'danger');
    return;
  }
  calcularTroco();
  const modalEl=document.getElementById('modalVendaFinalizar');
  const modal=new bootstrap.Modal(modalEl);
  modal.show();
  modalEl.addEventListener('shown.bs.modal',()=>document.getElementById('v-dinheiro').focus(),{once:true});
}

function vConfirmarFinalizacaoKeydown(e){
  if(e.key==='Tab'&&!e.shiftKey){
    e.preventDefault();
    vConfirmarFinalizacao();
  }
}

async function vConfirmarFinalizacao() {
  const estavaEditando = vState.mode === 'editar';

if (vState.mode !== 'incluir' && vState.mode !== 'editar') {
  toast('Inicie uma nova venda clicando em Incluir!', 'danger');
  return;
}

if (!vState.itens.length) {
  toast('Adicione ao menos um produto antes de finalizar!', 'danger');
  return;
}

const dinheiro = converterMoedaParaFloat(document.getElementById('v-dinheiro').value);
const desconto = converterMoedaParaFloat(document.getElementById('v-desconto').value);
const subtotalVenda = vendaSubtotal();

if (desconto > subtotalVenda) {
  toast('O desconto nÃ£o pode ser maior que o total da venda!', 'danger');
  document.getElementById('v-desconto').focus();
  return;
}

const totalVenda = Math.max(0, subtotalVenda - desconto);
const trocoCalculado = dinheiro - totalVenda;

if (dinheiro < totalVenda) {
  toast('valor menor que que o valor total', 'danger');
  document.getElementById('v-dinheiro').focus();
  return;
}

if (vState.mode === 'incluir' && vendasCache.some(venda => venda.nrv === vState.nrv)) {
  toast('Esta venda jÃ¡ foi finalizada!', 'warning');
  return;
}

let vendaBanco = null;
const qtdVenda = vState.itens.reduce((s, i) => s + Number(i.qtd || 0), 0);
const vendaAnterior = vState.mode === 'editar'
  ? vendasCache.find(v => String(v.id) === String(vState.editId))
  : null;

if (vState.mode === 'incluir') {
 const vendaPayload = {
  nrv: vState.nrv,
  dt: dataHoraLocalISO(),
  qtd: qtdVenda,
  subtotal: subtotalVenda,
  desconto: desconto,
  total: totalVenda,
  dinheiro: dinheiro,
  troco: trocoCalculado >= 0 ? trocoCalculado : 0,
  obs: document.getElementById('v-obs').value.trim()
};

  const { data, error } = await supabaseClient
    .from('vendas')
    .insert([vendaPayload])
    .select()
    .single();

  if (error) {
    console.error(error);
    toast('Erro ao finalizar venda no banco.', 'danger');
    return;
  }

  vendaBanco = data;
} else {
 const vendaPayload = {
  qtd: qtdVenda,
  subtotal: subtotalVenda,
  desconto: desconto,
  total: totalVenda,
  dinheiro: dinheiro,
  troco: trocoCalculado >= 0 ? trocoCalculado : 0,
  obs: document.getElementById('v-obs').value.trim()
};

  const { data, error } = await supabaseClient
    .from('vendas')
    .update(vendaPayload)
    .eq('id', vState.editId)
    .select()
    .single();

  if (error) {
    console.error(error);
    toast('Erro ao alterar venda no banco.', 'danger');
    return;
  }

  await supabaseClient
    .from('venda_itens')
    .delete()
    .eq('venda_id', vState.editId);

  vendaBanco = data;
}

const itensPayload = vState.itens.map(i => ({
  venda_id: vendaBanco.id,
  pid: i.pid,
  nome: i.nome,
  qtd: Number(i.qtd || 0),
  unit: Number(i.unit || 0),
  total: Number(i.total || 0)
}));

const { error: itensError } = await supabaseClient
  .from('venda_itens')
  .insert(itensPayload);

if (itensError) {
  console.error(itensError);
  toast('Venda salva, mas erro ao salvar itens.', 'danger');
  return;
}

const v = {
  ...vendaBanco,
  itens: [...vState.itens],
  subtotal: subtotalVenda,
  desconto,
  total: totalVenda,
  dinheiro,
  troco: trocoCalculado >= 0 ? trocoCalculado : 0,
  obs: document.getElementById('v-obs').value.trim()
};

atualizarVendaCache(v);
registrarAuditoriaGenerica(
  'vendas',
  v.id,
  estavaEditando ? 'A' : 'I',
  vendaAnterior,
  v,
  camposAuditoriaVenda,
  v.nrv
);

  // AvanÃ§a o contador interno de ID/Vendas global do sistema
  if(vState.mode === 'incluir')DB.si('venda', DB.gi('venda') + 1);
  
  const modalFinalizarEl = document.getElementById('modalVendaFinalizar');
  const modalFinalizar = bootstrap.Modal.getInstance(modalFinalizarEl);
  if (modalFinalizar) {
    modalFinalizarEl.addEventListener('hidden.bs.modal',()=>showImp(v),{once:true});
    modalFinalizar.hide();
  } else {
    showImp(v);
  }

  // LIMPEZA DA TELA IMEDIATA (Reseta os campos do formulÃ¡rio para o operador)
  vState.mode = null;
  vState.itens = [];
  vState.nrv = null;
  vState.editId = null;
  vState.itemEditIdx = null;
  document.getElementById('v-nrv-display').textContent = '000000';
  vSetFields(false);
  
  const dinheiroInput = document.getElementById('v-dinheiro');
  if (dinheiroInput) {
    dinheiroInput.value = '';
  }
  const descontoInput = document.getElementById('v-desconto');
  if (descontoInput) descontoInput.value = '';
  const obsInput = document.getElementById('v-obs');
  if (obsInput) {
    obsInput.disabled = true;
    obsInput.value = '';
  }
  
  const trocoInput = document.getElementById('v-troco');
  if (trocoInput) {
    trocoInput.value = 'R$ 0,00';
    trocoInput.className = 'form-control form-control-sm bg-light text-danger fw-bold';
  }
  
  document.getElementById('v-btn-exc').disabled = true;
  document.getElementById('v-btn-fin').disabled = true;
  document.getElementById('v-btn-can').style.display = 'none';
  document.getElementById('v-btn-add').disabled = true;
  
  ['v-prod-input', 'v-prod-id', 'v-qtd', 'v-unit', 'v-total'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'v-qtd' ? '1' : '';
  });
  
  // Atualiza as tabelas de fundo e zera o carrinho visual da tela
  renderCart();
  renderVHist();
  const inicio = document.getElementById('section-inicio');
  if (inicio && inicio.classList.contains('active')) {
    loadInicio();
  }
  const relVenda = document.getElementById('section-rel-venda');
  if (relVenda && relVenda.classList.contains('active')) {
    gerarRelVenda(false);
  }

  toast(estavaEditando ? 'Venda alterada com sucesso!' : 'Venda realizada e registrada com sucesso!');
}

function showImp(v){
  document.getElementById('imp-dt').textContent=`Data: ${new Date(v.dt).toLocaleString('pt-BR')}`;
  document.getElementById('imp-nv').textContent=`Nr. Venda: ${v.nrv}`;
  const statusAlert=document.getElementById('imp-status-alert');
  const statusText=document.getElementById('imp-status-text');
  const cancelada=vendaCancelada(v);
  statusText.textContent=cancelada?'Venda cancelada':'Venda concluÃ­da com sucesso!';
  statusAlert.classList.toggle('alert-success',!cancelada);
  statusAlert.classList.toggle('alert-danger',cancelada);
  const tb=document.getElementById('imp-tbody');
  tb.innerHTML='';
  let subtotal=0;
  
  (v.itens||[]).forEach(i=>{
    subtotal+=i.total;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${i.nome}</td><td class="text-center">${i.qtd}</td><td class="text-end">R$ ${fmt(i.unit)}</td><td class="text-end">R$ ${fmt(i.total)}</td>`;
    tb.appendChild(tr);
  });
  
  const desconto=Math.max(0,+v.desconto||0);
  const total=vendaTotalComDesconto(v);
  const subtotalWrap=document.getElementById('imp-subtotal-wrap');
  const descontoWrap=document.getElementById('imp-desconto-wrap');
  document.getElementById('imp-subtotal').textContent=`R$ ${fmt(subtotal)}`;
  document.getElementById('imp-desconto').textContent=`R$ ${fmt(desconto)}`;
  subtotalWrap.classList.toggle('d-none',desconto<=0);
  descontoWrap.classList.toggle('d-none',desconto<=0);
  document.getElementById('imp-total').textContent=`R$ ${fmt(total)}`;
  document.getElementById('imp-dinheiro').textContent=`R$ ${fmt(Number.isFinite(+v.dinheiro)?+v.dinheiro:total)}`;
  document.getElementById('imp-troco').textContent=`R$ ${fmt(v.troco || 0)}`;
  const obsWrap=document.getElementById('imp-obs-wrap');
  const obsEl=document.getElementById('imp-obs');
  const textoObs = cancelada && v.cancel_obs ? `Cancelamento: ${v.cancel_obs}` : v.obs;
  if(textoObs){
    obsEl.textContent=textoObs;
    obsWrap.style.display='';
  }else{
    obsEl.textContent='';
    obsWrap.style.display='none';
  }
  
  new bootstrap.Modal(document.getElementById('modalImp')).show();
}

async function verVenda(id){
  let v = vendasCache.find(x => String(x.id) === String(id));
  if(!v){
    await loadPDVSupabase();
    v = vendasCache.find(x => String(x.id) === String(id));
  }

  if (!v) {
    toast('Venda nÃ£o encontrada!', 'danger');
    return;
  }

  showImp(v);
}

function openVendaAdminAuth(action,id){
  document.getElementById('v-admin-action').value=action;
  document.getElementById('v-admin-sale-id').value=id;
  document.getElementById('v-admin-user').value='';
  document.getElementById('v-admin-senha').value='';
  document.getElementById('v-admin-obs').value='';
  document.getElementById('v-admin-obs-wrap').style.display=action==='cancelar'?'':'none';
  const modalEl=document.getElementById('modalVendaAdmin');
  const modal=new bootstrap.Modal(modalEl);
  modal.show();
  modalEl.addEventListener('shown.bs.modal',()=>document.getElementById('v-admin-user').focus(),{once:true});
}

function vendaAdminKeydown(e){
  if(e.key==='Enter'){
    e.preventDefault();
    confirmarVendaAdmin();
  }
}

async function confirmarVendaAdmin(){
  const action = document.getElementById('v-admin-action').value;
  const id = parseInt(document.getElementById('v-admin-sale-id').value);
  const user = document.getElementById('v-admin-user').value.trim();
  const senha = document.getElementById('v-admin-senha').value;
  const obs = document.getElementById('v-admin-obs').value.trim();

  if(action === 'cancelar' && !obs){
    toast('Informe o motivo do cancelamento.', 'warning');
    document.getElementById('v-admin-obs').focus();
    return;
  }

  const { data: admin, error } = await supabaseClient
    .from('usuarios')
    .select('*')
    .ilike('user', user)
    .eq('senha', enc(senha))
    .eq('status', 'Ativo')
    .maybeSingle();

  if(error){
    console.error(error);
    toast('Erro ao validar administrador.', 'danger');
    return;
  }

  if(!admin || String(admin.user).toLowerCase() !== 'admin'){
    toast(
      action === 'editar'
        ? 'AlteraÃ§Ã£o nÃ£o permitida, contate o administrador'
        : 'Cancelamento nÃ£o permitido. contate o administrador',
      'danger'
    );
    return;
  }

  const m = bootstrap.Modal.getInstance(document.getElementById('modalVendaAdmin'));
  if(m) m.hide();

  if(action === 'editar') editarVenda(id);
  if(action === 'cancelar') cancelarVenda(id, obs, admin);
}

async function editarVenda(id){
  await loadPDVSupabase();

  const v = vendasCache.find(x => String(x.id) === String(id));

  if (!v) {
    toast('Venda nÃ£o encontrada!', 'danger');
    return;
  }

  if (vendaCancelada(v)) {
    toast('Venda cancelada nÃ£o pode ser alterada.', 'warning');
    return;
  }

  if (vState.itens.length && !confirm('A venda atual serÃ¡ substituÃ­da pela venda selecionada. Continuar?')) {
    return;
  }

  vState.mode = 'editar';
  vState.editId = v.id;
  vState.itemEditIdx = null;
  vState.nrv = v.nrv;
  vState.itens = (v.itens || []).map(i => ({
    pid: i.pid,
    nome: i.nome,
    qtd: Number(i.qtd || 0),
    unit: Number(i.unit || 0),
    total: Number(i.total || 0)
  }));

  document.getElementById('v-nrv-display').textContent = v.nrv;

  vSetFields(true);

  document.getElementById('v-dinheiro').value =
    v.dinheiro ? 'R$ ' + fmt(v.dinheiro) : '';

  document.getElementById('v-desconto').value =
    v.desconto ? 'R$ ' + fmt(v.desconto) : '';

  document.getElementById('v-troco').value =
    v.troco ? 'R$ ' + fmt(v.troco) : 'R$ 0,00';

  document.getElementById('v-obs').disabled = false;
  document.getElementById('v-obs').value = v.obs || '';

  document.getElementById('v-btn-fin').disabled = false;
  document.getElementById('v-btn-can').style.display = '';
  document.getElementById('v-btn-add').disabled = false;

  ['v-prod-input','v-prod-id','v-unit','v-total'].forEach(c => {
    document.getElementById(c).value = '';
  });

  document.getElementById('v-qtd').value = 1;

  renderCart();

  if (vState.itens.length) {
    vSelectCartItem(0);
  } else {
    setTimeout(() => document.getElementById('v-prod-input').focus(), 50);
  }

  toast('Venda carregada para Edicao.', 'info');
}

async function cancelarVenda(id, obs, admin){
  let v = vendasCache.find(x => String(x.id) === String(id));
  if(!v){
    await loadPDVSupabase();
    v = vendasCache.find(x => String(x.id) === String(id));
  }

  if (!v) {
    toast('Venda nao Encontrada!', 'danger');
    return;
  }

  if(vendaCancelada(v)){
    toast('Venda jÃ¡ estÃ¡ cancelada.', 'warning');
    return;
  }

  if (!confirm(`Cancelar a venda NÂº ${v.nrv}?`)) return;

  const cancelamento = {
    cancelada: true,
    cancelado_em: dataHoraLocalISO(),
    cancelado_por: admin?.user || 'admin',
    cancel_obs: obs
  };

  const { data: vendaCanceladaBanco, error: vendaError } = await supabaseClient
    .from('vendas')
    .update(cancelamento)
    .eq('id', id)
    .select()
    .single();

  if (vendaError) {
    console.error(vendaError);
    toast('Erro ao cancelar venda.', 'danger');
    return;
  }

  if (String(vState.editId) === String(id)) {
    vCancelar();
  }

  const vendaAtualizada = { ...v, ...(vendaCanceladaBanco || cancelamento), itens: v.itens || [] };
  atualizarVendaCache(vendaAtualizada);
  registrarAuditoriaGenerica('vendas', id, 'A', v, vendaAtualizada, camposAuditoriaVenda, v.nrv);
  renderVHist();
  loadInicio();

  const relVenda = document.getElementById('section-rel-venda');
  if (relVenda && relVenda.classList.contains('active')) {
    gerarRelVenda(false);
  }

  toast('Venda cancelada com sucesso!');
}

function doPrint(){
  // Imprime de forma limpa disparando a janela nativa de impressÃ£o do Windows
  window.print();
}

function fecharImp() {
  const m = bootstrap.Modal.getInstance(document.getElementById('modalImp'));
  if (m) m.hide();
  
  // Limpa completamente o estado do PDV para a prÃ³xima venda
  vState.mode = null;
  vState.itens = [];
  vState.nrv = null;
  vState.editId = null;
  vState.itemEditIdx = null;
  document.getElementById('v-nrv-display').textContent = '000000';
  vSetFields(false);
  
  // Desativa e reseta os campos de Dinheiro e Troco
  const dinheiroInput = document.getElementById('v-dinheiro');
  if (dinheiroInput) {
    dinheiroInput.value = '';
  }
  const descontoInput = document.getElementById('v-desconto');
  if (descontoInput) descontoInput.value = '';
  const obsInput = document.getElementById('v-obs');
  if (obsInput) {
    obsInput.disabled = true;
    obsInput.value = '';
  }
  
  const trocoInput = document.getElementById('v-troco');
  if (trocoInput) {
    trocoInput.value = 'R$ 0,00';
    trocoInput.className = 'form-control form-control-sm bg-light text-danger fw-bold';
  }
  
  // Limpa controles padrÃ£o do formulÃ¡rio do PDV
  document.getElementById('v-btn-exc').disabled = true;
  document.getElementById('v-btn-fin').disabled = true;
  document.getElementById('v-btn-can').style.display = 'none';
  document.getElementById('v-btn-add').disabled = true;
  
  ['v-prod-input', 'v-prod-id', 'v-qtd', 'v-unit', 'v-total'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'v-qtd' ? '1' : '';
  });
  
  // renderiza o carrinho vazio e atualiza o histÃ³rico e relatÃ³rio de vendas na hora
  renderCart();
  loadVHist();
  const inicio = document.getElementById('section-inicio');
  if (inicio && inicio.classList.contains('active')) {
    loadInicio();
  }
  const relVenda = document.getElementById('section-rel-venda');
  if (relVenda && relVenda.classList.contains('active')) {
    gerarRelVenda(false);
  }
}

function vCancelar(){
  const msgCancelamento = vState.mode === 'editar'
    ? 'Deseja cancelar a edicao? Os itens serao removidos.'
    : 'Cancelar a venda? Os itens serao removidos.';
  if(vState.itens.length&&!confirm(msgCancelamento))return;
  vState.mode=null;vState.itens=[];
  vState.nrv=null;
  vState.editId=null;
  vState.itemEditIdx=null;
  document.getElementById('v-nrv-display').textContent='000000';
  vSetFields(false);
  document.getElementById('v-obs').disabled = true;
  document.getElementById('v-btn-exc').disabled=true;
  document.getElementById('v-btn-fin').disabled=true;
  document.getElementById('v-btn-can').style.display='none';
  document.getElementById('v-btn-add').disabled=true;
  document.getElementById('v-dinheiro').value = '';
  document.getElementById('v-desconto').value = '';
  document.getElementById('v-obs').value = '';
  document.getElementById('v-troco').value = 'R$ 0,00';
  ['v-prod-input','v-prod-id','v-qtd','v-unit','v-total'].forEach(id=>document.getElementById(id).value=id==='v-qtd'?'1':'');
  renderCart();
}

function vProdSearch(){
  const val=document.getElementById('v-prod-input').value.trim().toLowerCase();
  document.getElementById('v-prod-id').value='';
  document.getElementById('v-unit').value='';
  document.getElementById('v-total').value='';
  const dd=document.getElementById('v-dd');
  if(!val){dd.style.display='none';return;}
  const produtos=getProdutosCadastro();
  const produtoPorId=produtos.find(p=>String(p.id).toLowerCase()===val);
  if(produtoPorId){
    vProdSelect(produtoPorId.id,produtoPorId.nome);
    return;
  }
  const ps=produtos.filter(p=>p.nome.toLowerCase().includes(val));
  if(!ps.length){dd.style.display='none';return;}
  dd.innerHTML=ps.map(p=>{
    const st=getStock(p.id);
    return `<div class="dd-item" onclick="vProdSelect('${p.id}','${p.nome.replace(/'/g,"\\'")}')">${p.id} â€” ${p.nome} <span class="badge ${st>0?'bg-success':'bg-danger'}">${st} un.</span></div>`;
  }).join('');
  dd.style.display='';
}

function vProdKeydown(e){
  if(e.key==='Tab'){
    const termo=document.getElementById('v-prod-input').value.trim();
    const pid=document.getElementById('v-prod-id').value;
    if(termo&&!pid){
      const produtoPorId=getProdutosCadastro().find(p=>String(p.id).toLowerCase()===termo.toLowerCase());
      if(produtoPorId){
        e.preventDefault();
        vProdSelect(produtoPorId.id,produtoPorId.nome);
        return;
      }
      e.preventDefault();
      openModalProd('venda',termo);
    }
  }
}

function vProdSelect(id,nome){
  document.getElementById('v-prod-id').value=id;
  document.getElementById('v-prod-input').value=nome;
  document.getElementById('v-dd').style.display='none';
  document.getElementById('v-unit').value='';
  document.getElementById('v-qtd').classList.remove('is-invalid');
  vPreencherCustoAutomatico();
  vValidarEstoqueQuantidade(false);
  document.getElementById('v-qtd').focus();
}

// ===========================================================
// MODAL PRODUTO
// ===========================================================
let modalCtx='';
let modalProdIdx=0;
let modalProdLista=[];

function openModalProd(ctx, termo=''){
  modalCtx=ctx;
  if(ctx==='venda'&&termo){
    const produtoPorId=getProdutosCadastro().find(p=>String(p.id).toLowerCase()===String(termo).trim().toLowerCase());
    if(produtoPorId){
      vProdSelect(produtoPorId.id,produtoPorId.nome);
      return;
    }
  }
  document.getElementById('modal-search').value=termo;
  modalProdFilter();
  const modalEl=document.getElementById('modalProd');
  new bootstrap.Modal(modalEl).show();
  modalEl.addEventListener('shown.bs.modal',()=>document.getElementById('modal-search').focus(),{once:true});
}

function modalProdFilter(){
  const val=document.getElementById('modal-search').value.trim().toLowerCase();
  const ps=getProdutosCadastro();
  const filtered=val?ps.filter(p=>p.nome.toLowerCase().includes(val)||(modalCtx!=='venda'&&String(p.id).toLowerCase().includes(val))):ps;
  modalProdLista=filtered;
  modalProdIdx=0;
  const tb=document.getElementById('modal-prod-tbody');
  tb.innerHTML='';
  if(!filtered.length){
    tb.innerHTML='<tr><td colspan="3" class="text-center text-muted py-3">Nenhum produto encontrado</td></tr>';
    return;
  }
  filtered.forEach((p,idx)=>{
    const st=getStock(p.id);
    const tr=document.createElement('tr');
    if(idx===modalProdIdx)tr.classList.add('sel');
    tr.innerHTML=`<td>${p.id}</td><td>${p.nome}</td><td><span class="badge ${st>0?'bg-success':'bg-danger'}">${st}</span></td>`;
    tr.onclick=()=>modalProdSelect(p.id,p.nome);
    tb.appendChild(tr);
  });
}

function renderModalProdSelecao(){
  document.querySelectorAll('#modal-prod-tbody tr').forEach((tr,idx)=>{
    tr.classList.toggle('sel',idx===modalProdIdx);
    if(idx===modalProdIdx)tr.scrollIntoView({block:'nearest'});
  });
}

function modalProdKeydown(e){
  if(!modalProdLista.length)return;
  if(e.key==='ArrowDown'){
    e.preventDefault();
    modalProdIdx=Math.min(modalProdLista.length-1,modalProdIdx+1);
    renderModalProdSelecao();
  }else if(e.key==='ArrowUp'){
    e.preventDefault();
    modalProdIdx=Math.max(0,modalProdIdx-1);
    renderModalProdSelecao();
  }else if(e.key==='Enter'){
    e.preventDefault();
    const p=modalProdLista[modalProdIdx];
    if(p)modalProdSelect(p.id,p.nome);
  }
}

function modalProdSelect(id,nome){
  if(modalCtx==='ent'){
    document.getElementById('e-prod-id').value=id;
    document.getElementById('e-prod-nome').value=nome;
    setTimeout(()=>document.getElementById('e-qtd').focus(),150);
  }else if(modalCtx==='venda'){
    document.getElementById('v-prod-id').value=id;
    document.getElementById('v-prod-input').value=nome;
    document.getElementById('v-unit').value='';
    vPreencherCustoAutomatico();
    vValidarEstoqueQuantidade(false);
    setTimeout(()=>document.getElementById('v-qtd').focus(),150);
  }
  bootstrap.Modal.getInstance(document.getElementById('modalProd')).hide();
}

// ===========================================================

