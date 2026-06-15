// PRODUTOS - SUPABASE
// ===========================================================
let pState = { sel: null, mode: null };
let produtosCache = [];
let entradasCache = [];

async function getProdutosSupabase() {
  const { data, error } = await supabaseClient
    .from('produtos')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error(error);
    toast('Erro ao carregar produtos do banco.', 'danger');
    return [];
  }

  return data || [];
}

function ordenarProdutosCache(){
  produtosCache.sort((a,b) => String(a.id).localeCompare(String(b.id),'pt-BR',{numeric:true}));
}

function atualizarProdutoCache(produto){
  const idx = produtosCache.findIndex(p => String(p.id) === String(produto.id));
  if(idx >= 0){
    produtosCache[idx] = { ...produtosCache[idx], ...produto };
  }else{
    produtosCache.push(produto);
  }
  ordenarProdutosCache();
}

function refreshProdutosCadastro(){
  renderPTable();
  pRestaurarSelecao();
  pResetBtns();
}

async function loadP() {
  produtosCache = await getProdutosSupabase();
  await loadEntradasSupabase();
  await loadPDVSupabase();
  renderPTable();
  pRestaurarSelecao();
  pResetBtns();
}

async function getEntradasSupabase() {
  const { data, error } = await supabaseClient
    .from('entradas')
    .select('*')
    .order('data', { ascending: false })
    .order('id', { ascending: false });

  if (error) {
    console.error(error);
    toast('Erro ao carregar entradas do banco.', 'danger');
    return [];
  }

  return data || [];
}

async function loadEntradasSupabase() {
  entradasCache = await getEntradasSupabase();
}

function renderPTable() {
  const tb = document.getElementById('p-tbody');
  tb.innerHTML = '';

  produtosCache.forEach(p => {
    const st = getStock(p.id); // por enquanto ainda usa entradas/vendas locais
    const cls = st > 0 ? 'badge-ok' : 'badge-zero';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.nome}</td>
      <td><span class="badge ${cls}">${st}</span></td>
    `;

    if (String(pState.sel) === String(p.id)) tr.classList.add('sel');
    tr.onclick = () => pSelect(p.id);
    tb.appendChild(tr);
  });
}

function pSelect(id) {
  if (pState.mode) return;

  const p = produtosCache.find(x => String(x.id) === String(id));
  if (!p) return;

  pState.sel = id;

  document.getElementById('p-id').value = p.id;
  document.getElementById('p-nome').value = p.nome;
  document.getElementById('p-estoque').value = getStock(p.id);

  document.getElementById('p-btn-alt').disabled = false;
  document.getElementById('p-btn-exc').disabled = false;
  document.getElementById('p-btn-grav').disabled = true;

  renderPTable();
}

function pEnableFields(on, isNew = false) {
  document.getElementById('p-id').disabled = !on || !isNew;
  document.getElementById('p-nome').disabled = !on;
}

function pRestaurarSelecao() {
  if (!pState.sel) {
    pClearForm();
    return;
  }

  const p = produtosCache.find(x => String(x.id) === String(pState.sel));
  if (!p) {
    pState.sel = null;
    pClearForm();
    return;
  }

  document.getElementById('p-id').value = p.id;
  document.getElementById('p-nome').value = p.nome;
  document.getElementById('p-estoque').value = getStock(p.id);
}

const camposAuditoriaProduto = [
  ['id', 'id do produto'],
  ['nome', 'nome do produto']
];
function sugerirProdutoIdSupabase() {
  const ids = produtosCache
    .map(p => parseInt(p.id, 10))
    .filter(n => Number.isFinite(n));

  const prox = (ids.length ? Math.max(...ids) : 0) + 1;

  return String(prox);
}

function pIncluir() {
  if (telaEmEdicao()) {
    toast('a Tela esta em Edição, finalize o lançamento ou cancela a operação', 'warning');
    return;
  }

  pState.mode = 'incluir';
  pState.sel = null;

  pClearForm();
  document.getElementById('p-id').value = sugerirProdutoIdSupabase();
  pEnableFields(true, true);

  document.getElementById('p-btn-grav').disabled = false;
  document.getElementById('p-btn-alt').disabled = true;
  document.getElementById('p-btn-exc').disabled = true;
  document.getElementById('p-btn-can').style.display = '';

  renderPTable();
  setTimeout(() => document.getElementById('p-nome').focus(), 50);
}

function pAlterar() {
  if (!pState.sel) return;

  pState.mode = 'alterar';
  pEnableFields(true, false);

  document.getElementById('p-btn-grav').disabled = false;
  document.getElementById('p-btn-alt').disabled = true;
  document.getElementById('p-btn-exc').disabled = true;
  document.getElementById('p-btn-can').style.display = '';
}

async function pGravar() {
  const id = document.getElementById('p-id').value.trim();
  const nome = document.getElementById('p-nome').value.trim();

  if (!id) {
    toast('ID do produto é obrigatório!', 'danger');
    return;
  }

  if (!nome) {
    toast('Nome do produto é obrigatório!', 'danger');
    return;
  }

  if (pState.mode === 'incluir') {
    const existe = produtosCache.find(p => String(p.id) === String(id));

    if (existe) {
      toast('ID do produto já existe!', 'danger');
      return;
    }

    const novoProduto = { id, nome };

    const { error } = await supabaseClient
      .from('produtos')
      .insert([novoProduto]);

    if (error) {
      console.error(error);
      toast('Erro ao incluir produto no banco.', 'danger');
      return;
    }

    pState.sel = id;
    atualizarProdutoCache(novoProduto);
    registrarAuditoriaGenerica('produtos', id, 'I', null, novoProduto, camposAuditoriaProduto);
    toast('Produto incluído com sucesso!');
  } else {
    const produtoAnterior = produtosCache.find(p => String(p.id) === String(pState.sel));
    const produtoAlterado = { ...(produtoAnterior || {}), id: pState.sel, nome };

    const { error } = await supabaseClient
      .from('produtos')
      .update({ nome })
      .eq('id', pState.sel);

    if (error) {
      console.error(error);
      toast('Erro ao alterar produto no banco.', 'danger');
      return;
    }

    atualizarProdutoCache(produtoAlterado);
    registrarAuditoriaGenerica('produtos', pState.sel, 'A', produtoAnterior, produtoAlterado, camposAuditoriaProduto);
    toast('Produto alterado com sucesso!');
  }

  pState.mode = null;
  pEnableFields(false);
  refreshProdutosCadastro();
}

async function pExcluir() {
  if (!pState.sel) return;

  await loadEntradasSupabase();
  const ent = entradasCache.filter(e => String(e.pid) === String(pState.sel));

  if (ent.length > 0) {
    toast('Produto possui movimentações e não pode ser excluído!', 'danger');
    return;
  }

  if (!confirm('Excluir este produto?')) return;

  const { error } = await supabaseClient
    .from('produtos')
    .delete()
    .eq('id', pState.sel);

  if (error) {
    console.error(error);
    toast('Erro ao excluir produto do banco.', 'danger');
    return;
  }

  const produtoExcluidoId = pState.sel;
  pState.sel = null;
  produtosCache = produtosCache.filter(produto => String(produto.id) !== String(produtoExcluidoId));
  toast('Produto excluído!');
  refreshProdutosCadastro();
}

function pCancelar() {
  pState.mode = null;
  pEnableFields(false);
  pRestaurarSelecao();
  pResetBtns();
  renderPTable();
}

function pClearForm() {
  ['p-id', 'p-nome', 'p-estoque'].forEach(id => {
    document.getElementById(id).value = '';
  });
}

function pResetBtns() {
  document.getElementById('p-btn-alt').disabled = !pState.sel;
  document.getElementById('p-btn-exc').disabled = !pState.sel;
  document.getElementById('p-btn-grav').disabled = true;
  document.getElementById('p-btn-can').style.display = 'none';
}

let prodImportLinhas=[];

function openImportProdutos(){
  if(telaEmEdicao()){toast('a Tela esta em Edição, finalize o lançamento ou cancela a operação','warning');return;}
  prodImportLinhas=[];
  document.getElementById('prod-import-file').value='';
  document.getElementById('prod-import-preview').innerHTML='<tr><td colspan="4" class="text-center text-muted py-3">Selecione um arquivo para visualizar</td></tr>';
  setImportLog([]);
  new bootstrap.Modal(document.getElementById('modalImportProdutos')).show();
}

function normalizarColunaProduto(nome){
  return String(nome||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]/g,'');
}

function valorCelulaProduto(row, nomes){
  for(const nome of nomes){
    if(Object.prototype.hasOwnProperty.call(row,nome))return row[nome];
  }
  return '';
}

function setImportLog(logs){
  const wrap=document.getElementById('prod-import-log-wrap');
  const box=document.getElementById('prod-import-log');
  if(!logs.length){
    wrap.style.display='none';
    box.innerHTML='';
    return;
  }
  wrap.style.display='';
  box.innerHTML=logs.map(l=>`<div>${escHtml(l)}</div>`).join('');
}

function validarLinhasProdutos(rows){
  const existentes=new Set(produtosCache.map(p=>String(p.id).trim().toLowerCase()));
  const vistos=new Set();
  const logs=[];
  const linhas=[];
  rows.forEach((row,idx)=>{
    const cols=Object.keys(row);
    const colId=cols.find(c=>['idproduto','id','codigo','codigoproduto'].includes(normalizarColunaProduto(c)));
    const colNome=cols.find(c=>['nomedoproduto','nomeproduto','produto','nome'].includes(normalizarColunaProduto(c)));
    const id=String(valorCelulaProduto(row,colId?[colId]:[])).trim();
    const nome=String(valorCelulaProduto(row,colNome?[colNome]:[])).trim().toUpperCase();
    const linhaPlanilha=idx+2;
    let status='Pronto para importar';
    let valido=true;
    let ignorar=false;
    if(!colId||!colNome){
      status='Erro: layout inválido';
      logs.push(`Linha ${linhaPlanilha}: layout inválido. Use as colunas "ID Produto" e "Nome do Produto".`);
      valido=false;
      }else if(!id){
        status='Erro: ID do produto vazio';
        logs.push(`Linha ${linhaPlanilha}: ID do produto é obrigatório.`);
        valido=false;
      }else if(!/^\d+$/.test(id)){
        status='Erro: ID aceita apenas números';
        logs.push(`Linha ${linhaPlanilha}: campo ID não aceita letras ou caracteres, apenas números.`);
        valido=false;
      }else if(!nome){
        status='Erro: nome do produto vazio';
        logs.push(`Linha ${linhaPlanilha}: Nome do produto é obrigatório.`);
      valido=false;
    }else if(existentes.has(id.toLowerCase())){
      status='Ignorado: ID já cadastrado';
      logs.push(`Linha ${linhaPlanilha}: produto ${id} já existe no cadastro e será ignorado.`);
      ignorar=true;
    }else if(vistos.has(id.toLowerCase())){
      status='Ignorado: ID duplicado no arquivo';
      logs.push(`Linha ${linhaPlanilha}: ID ${id} duplicado no arquivo e será ignorado.`);
      ignorar=true;
    }
    if(valido&&!ignorar)vistos.add(id.toLowerCase());
    linhas.push({linha:linhaPlanilha,id,nome,status,valido,ignorar});
  });
  return {linhas,logs};
}

function renderPreviewProdutos(linhas){
  const tb=document.getElementById('prod-import-preview');
  if(!linhas.length){
    tb.innerHTML='<tr><td colspan="4" class="text-center text-muted py-3">Nenhum produto encontrado no arquivo</td></tr>';
    return;
  }
  tb.innerHTML=linhas.map(l=>{
    const cls=l.valido&&!l.ignorar?'text-success':l.ignorar?'text-warning':'text-danger';
    return `<tr><td>${escHtml(l.linha)}</td><td>${escHtml(l.id)}</td><td>${escHtml(l.nome)}</td><td class="${cls} fw-bold">${escHtml(l.status)}</td></tr>`;
  }).join('');
}

async function lerArquivoProdutos(){
  if(typeof XLSX==='undefined'){
    toast('Biblioteca de Excel não carregada. Verifique a conexão com a internet.','danger');
    return null;
  }
  const file=document.getElementById('prod-import-file').files[0];
  if(!file){
    toast('Selecione um arquivo Excel para importar.','warning');
    return null;
  }
  const data=await file.arrayBuffer();
  const wb=XLSX.read(data,{type:'array'});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
  return rows;
}

async function previewImportProdutos(){
  try{
    const rows=await lerArquivoProdutos();
    if(!rows)return;
    const result=validarLinhasProdutos(rows);
    prodImportLinhas=result.linhas;
    renderPreviewProdutos(prodImportLinhas);
    setImportLog(result.logs);
  }catch(err){
    prodImportLinhas=[];
    renderPreviewProdutos([]);
    setImportLog([`Erro ao ler arquivo: ${err.message||err}`]);
  }
}

async function importarProdutosArquivo(){
  try{
    const rows=await lerArquivoProdutos();
    if(!rows)return;
    const result=validarLinhasProdutos(rows);
    prodImportLinhas=result.linhas;
    renderPreviewProdutos(prodImportLinhas);
    const erros=result.linhas.filter(l=>!l.valido);
    if(erros.length){
      setImportLog(result.logs);
      toast('Importação bloqueada. Verifique o log de erros.','danger');
      return;
    }
    const novos=result.linhas.filter(l=>l.valido&&!l.ignorar).map(l=>({id:l.id,nome:l.nome}));
    if(!novos.length){
      setImportLog(result.logs.length?result.logs:['Nenhum produto novo para importar.']);
      toast('Nenhum produto novo para importar.','warning');
      return;
    }
    const { error } = await supabaseClient
      .from('produtos')
      .insert(novos);

    if(error){
      console.error(error);
      setImportLog(result.logs.concat(['Erro ao importar produtos no banco.']));
      toast('Erro ao importar produtos no banco.','danger');
      return;
    }

    const produtosImportadosPorId = new Map(novos.map(produto => [String(produto.id), produto]));
    produtosCache = produtosCache
      .filter(produto => !produtosImportadosPorId.has(String(produto.id)))
      .concat(novos)
      .sort((a,b) => String(a.id).localeCompare(String(b.id),'pt-BR',{numeric:true}));
    pState.sel = novos[novos.length - 1].id;
    renderPTable();
    pRestaurarSelecao();
    pResetBtns();
    setImportLog(result.logs.concat([`${novos.length} produto(s) importado(s) com sucesso.`]));
    toast(`${novos.length} produto(s) importado(s) com sucesso!`);

    novos.forEach(produto => {
      registrarAuditoriaGenerica('produtos', produto.id, 'I', null, produto, camposAuditoriaProduto);
    });
  }catch(err){
    setImportLog([`Erro ao importar arquivo: ${err.message||err}`]);
    toast('Erro ao importar arquivo. Veja o log.','danger');
  }
}

function baixarLayoutProdutos(){
  if(typeof XLSX==='undefined'){
    toast('Biblioteca de Excel não carregada. Verifique a conexão com a internet.','danger');
    return;
  }
  const dados=[
    {'ID Produto':'1','Nome do Produto':'SORVETE MORANGO'},
    {'ID Produto':'2','Nome do Produto':'PICOLÉ CHOCOLATE'}
  ];
  const ws=XLSX.utils.json_to_sheet(dados,{header:['ID Produto','Nome do Produto']});
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Produtos');
  XLSX.writeFile(wb,'layout_importacao_produtos.xlsx');
}

// ===========================================================
// ===========================================================
