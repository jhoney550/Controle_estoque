// RELATÓRIO ENTRADA
// ===========================================================
let relEntradaState={consultado:false,assinatura:'',linhas:[],resumo:null};
let relVendaState={consultado:false,assinatura:'',linhas:[],resumo:null};

function assinaturaRelEntrada(){
  return [
    document.getElementById('rle-ini').value,
    document.getElementById('rle-fim').value,
    document.getElementById('rle-prod').value
  ].join('|');
}

function assinaturaRelVenda(){
  return [
    document.getElementById('rlv-ini').value,
    document.getElementById('rlv-fim').value,
    document.getElementById('rlv-nrv').value.trim(),
    document.getElementById('rlv-prod').value,
    document.getElementById('rlv-cancelado')?.checked ? 'S' : 'N'
  ].join('|');
}

async function initRelEnt(){
  await loadP();
  await loadEntradasSupabase();

  const ps = getProdutosCadastro();
  const sel = document.getElementById('rle-prod');

  sel.innerHTML =
    '<option value="">Todos</option>' +
    ps.map(p => `<option value="${p.id}">${p.id} - ${p.nome}</option>`).join('');

  await gerarRelEnt(false);
}

async function gerarRelEnt(consultado = true){
  await loadEntradasSupabase();

  let ents = [...entradasCache];

  const produtosMap = new Map(
    getProdutosCadastro().map(p => [String(p.id), p.nome])
  );

  const ini = normalizarDataFiltro(document.getElementById('rle-ini').value);
  const fim = normalizarDataFiltro(document.getElementById('rle-fim').value);
  const pf = document.getElementById('rle-prod').value;

  if (ini) ents = ents.filter(e => String(e.data) >= ini);
  if (fim) ents = ents.filter(e => String(e.data) <= fim);
  if (pf) ents = ents.filter(e => String(e.pid) === String(pf));

  ents.sort((a, b) => {
    const dataCmp = String(b.data || '').localeCompare(String(a.data || ''));
    return dataCmp || ((+b.id || 0) - (+a.id || 0));
  });

  const tb = document.getElementById('rle-tbody');
  tb.innerHTML = '';

  let tq = 0;
  let tv = 0;
  const linhas = [];

  ents.forEach(e => {
    const linha = {
      req: e.req,
      data: fmtD(e.data),
      produto: produtosMap.get(String(e.pid)) || e.pid,
      qtd: Number(e.qtd || 0),
      unit: Number(e.unit || 0),
      total: Number(e.total || 0),
      saldo: getStock(e.pid)
    };

    linhas.push(linha);

    tq += linha.qtd;
    tv += linha.total;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escHtml(linha.req)}</td>
      <td>${escHtml(linha.data)}</td>
      <td>${escHtml(linha.produto)}</td>
      <td>${escHtml(linha.qtd)}</td>
      <td>R$ ${fmt(linha.unit)}</td>
      <td>R$ ${fmt(linha.total)}</td>
      <td>${escHtml(linha.saldo)}</td>
    `;

    tb.appendChild(tr);
  });

  document.getElementById('rle-sum-qtd').textContent = tq;
  document.getElementById('rle-sum-val').textContent = `R$ ${fmt(tv)}`;
  document.getElementById('rle-sum-saldo').textContent = pf ? getStock(pf) : totalStock();
  document.getElementById('rle-sum-reg').textContent = linhas.length;

  relEntradaState = {
    consultado,
    assinatura: consultado ? assinaturaRelEntrada() : '',
    linhas,
    resumo: {
      qtd: tq,
      valor: tv,
      saldo: pf ? getStock(pf) : totalStock(),
      registros: linhas.length
    }
  };
}

// ===========================================================
// RELATÓRIO VENDA
// ===========================================================
async function initRelVenda(){
  await loadP();
  const ps=getProdutosCadastro();
  const sel=document.getElementById('rlv-prod');
  sel.innerHTML='<option value="">Todos</option>'+ps.map(p=>`<option value="${p.id}">${p.id} - ${p.nome}</option>`).join('');
  gerarRelVenda(false);
}

async function gerarRelVenda(consultado = true){
  await loadPDVSupabase();

  let vs = [...vendasCache];

  const produtosMap = new Map(
    getProdutosCadastro().map(p => [String(p.id), p.nome])
  );

  const ini = normalizarDataFiltro(document.getElementById('rlv-ini').value);
  const fim = normalizarDataFiltro(document.getElementById('rlv-fim').value);
  const nrvFiltro = document.getElementById('rlv-nrv').value.trim();
  const pf = document.getElementById('rlv-prod').value;
  const somenteCanceladas = document.getElementById('rlv-cancelado')?.checked;

  if (ini) vs = vs.filter(v => dataLocalISO(v.dt) >= ini);
  if (fim) vs = vs.filter(v => dataLocalISO(v.dt) <= fim);
  if (nrvFiltro) vs = vs.filter(v => String(v.nrv || '').includes(nrvFiltro));
  vs = vs.filter(v => somenteCanceladas ? vendaCancelada(v) : !vendaCancelada(v));

  const tb = document.getElementById('rlv-tbody');
  tb.innerHTML = '';

  let tq = 0;
  let tv = 0;
  let nv = 0;

  const linhas = [];

  vs.forEach(v => {
    const itensOriginais = (v.itens || []).map(i => ({
      ...i,
      nome: produtosMap.get(String(i.pid)) || i.nome || i.pid,
      qtd: Number(i.qtd || 0),
      unit: Number(i.unit || 0),
      total: Number(i.total || 0)
    }));

    const itensRel = itensOriginais.filter(i => {
      return !pf || String(i.pid) === String(pf);
    });

    if (!itensRel.length) return;

    const qtd = itensRel.reduce((s, i) => s + Number(i.qtd || 0), 0);

    const total = pf
      ? itensRel.reduce((s, i) => s + Number(i.total || 0), 0)
      : vendaTotalComDesconto({ ...v, itens: itensOriginais });

    linhas.push({
      id: v.id,
      nrv: v.nrv,
      dt: v.dt,
      cancelada: vendaCancelada(v),
      qtd,
      total,
      itens: itensRel,
      itensPrint: itensOriginais
    });

    tq += qtd;
    tv += total;
    nv++;
  });

  linhas.sort((a, b) => String(b.dt).localeCompare(String(a.dt)));

  linhas.forEach((l, idx) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${escHtml(l.nrv)}</td>
      <td>${escHtml(new Date(l.dt).toLocaleString('pt-BR'))}</td>
      <td>${escHtml(l.qtd)}</td>
      <td>R$ ${fmt(l.total)}</td>
      <td>${l.cancelada?'<span class="badge bg-danger">Cancelada</span>':'<span class="badge bg-success">Concluída</span>'}</td>
      <td>
        <button class="btn btn-outline-secondary btn-sm py-0" onclick="toggleRelVendaItens(${idx})">
          <i class="fas fa-chevron-down" id="rlv-arrow-${idx}"></i>
        </button>
      </td>
    `;

    tb.appendChild(tr);

    const detalhe = document.createElement('tr');
    detalhe.id = `rlv-itens-${idx}`;
    detalhe.style.display = 'none';

    detalhe.innerHTML = `
      <td colspan="6">
        <div class="small">
          ${l.itens.map(i => `
            <div>
              <strong>${escHtml(i.nome)}</strong> —
              Qtd: ${escHtml(i.qtd)} |
              Unit.: R$ ${fmt(i.unit)} |
              Total: R$ ${fmt(i.total)}
            </div>
          `).join('')}
        </div>
      </td>
    `;

    tb.appendChild(detalhe);
  });

  document.getElementById('rlv-sum-qtd').textContent = tq;
  document.getElementById('rlv-sum-val').textContent = `R$ ${fmt(tv)}`;
  document.getElementById('rlv-sum-nv').textContent = nv;
  document.getElementById('rlv-sum-ticket').textContent = `R$ ${fmt(nv > 0 ? tv / nv : 0)}`;

  relVendaState = {
    consultado,
    assinatura: consultado ? assinaturaRelVenda() : '',
    linhas,
    resumo: {
      qtd: tq,
      valor: tv,
      vendas: nv,
      ticket: nv > 0 ? tv / nv : 0
    }
  };
}

function toggleRelVendaItens(idx){
  const row=document.getElementById(`rlv-itens-${idx}`);
  const arrow=document.getElementById(`rlv-arrow-${idx}`);
  if(!row)return;
  const abrir=row.style.display==='none';
  row.style.display=abrir?'':'none';
  if(arrow){
    arrow.classList.toggle('fa-chevron-down',!abrir);
    arrow.classList.toggle('fa-chevron-up',abrir);
  }
}

function textoFiltrosRel(prefixo){
  const ini=document.getElementById(`${prefixo}-ini`).value;
  const fim=document.getElementById(`${prefixo}-fim`).value;
  const prod=document.getElementById(`${prefixo}-prod`);
  const partes=[];
  partes.push(`Data inicial: ${ini?fmtD(normalizarDataFiltro(ini)):'Todas'}`);
  partes.push(`Data final: ${fim?fmtD(normalizarDataFiltro(fim)):'Todas'}`);
  if(prefixo==='rlv'){
    const nrv=document.getElementById('rlv-nrv').value.trim();
    partes.push(`Nr. Venda: ${nrv||'Todas'}`);
    partes.push(`Cancelado: ${document.getElementById('rlv-cancelado')?.checked?'Sim':'Não'}`);
  }
  partes.push(`Produto: ${prod.value?prod.options[prod.selectedIndex].text:'Todos'}`);
  return partes.join(' | ');
}

async function abrirPreviewRelatorio(tipo){
  const entrada=tipo==='entrada';
  let state=entrada?relEntradaState:relVendaState;
  const assinaturaAtual=entrada?assinaturaRelEntrada():assinaturaRelVenda();
  if(!state.consultado||state.assinatura!==assinaturaAtual){
    if(entrada){
      await gerarRelEnt(true);
      state=relEntradaState;
    }else{
      toast('Clique em Filtrar antes de abrir a impressão do relatório.', 'warning');
      return;
    }
  }

  document.getElementById('rel-print-title').textContent=entrada?'Relatório de Entrada de Estoque':'Relatório de Vendas';
  document.getElementById('rel-print-filter').textContent=textoFiltrosRel(entrada?'rle':'rlv');
  document.getElementById('rel-print-dt').textContent=`Emitido em ${new Date().toLocaleString('pt-BR')}`;
  const thead=document.getElementById('rel-print-thead');
  const tbody=document.getElementById('rel-print-tbody');
  const summary=document.getElementById('rel-print-summary');

  if(entrada){
    thead.innerHTML='<tr><th>Nr. Req.</th><th>Data</th><th>Produto</th><th>Quantidade</th><th>Vlr. Unitário</th><th>Vlr. Total</th><th>Saldo</th></tr>';
    tbody.innerHTML=state.linhas.length?state.linhas.map(l=>`<tr><td>${escHtml(l.req)}</td><td>${escHtml(l.data)}</td><td>${escHtml(l.produto)}</td><td>${escHtml(l.qtd)}</td><td>R$ ${fmt(l.unit)}</td><td>R$ ${fmt(l.total)}</td><td>${escHtml(l.saldo)}</td></tr>`).join(''):'<tr><td colspan="7" class="text-center text-muted py-3">Nenhum registro encontrado</td></tr>';
    summary.innerHTML=[
      `<div class="col-md-3"><strong>Total Entradas:</strong> ${escHtml(state.resumo.qtd)}</div>`,
      `<div class="col-md-3"><strong>Valor Total:</strong> R$ ${fmt(state.resumo.valor)}</div>`,
      `<div class="col-md-3"><strong>Saldo Atual:</strong> ${escHtml(state.resumo.saldo)}</div>`,
      `<div class="col-md-3"><strong>Lançamentos:</strong> ${escHtml(state.resumo.registros)}</div>`
    ].join('');
  }else{
    thead.innerHTML='<tr><th>Nr. Venda</th><th>Data/Hora</th><th>Status</th><th>Produto</th><th>Quantidade</th><th>Vlr. Unit.</th><th>Vlr. Total</th></tr>';
    tbody.innerHTML=state.linhas.length?state.linhas.map(l=>{
      const itens=(document.getElementById('rlv-nrv').value.trim()?l.itensPrint:l.itens)||[];
      const status=l.cancelada?'Cancelada':'Concluída';
      return `<tr class="table-secondary"><td>${escHtml(l.nrv)}</td><td>${escHtml(new Date(l.dt).toLocaleString('pt-BR'))}</td><td>${escHtml(status)}</td><td colspan="3"><strong>Total</strong></td><td><strong>R$ ${fmt(l.total)}</strong></td></tr>`+
        itens.map(i=>`<tr><td></td><td></td><td></td><td>${escHtml(i.nome)}</td><td>${escHtml(i.qtd)}</td><td>R$ ${fmt(i.unit)}</td><td>R$ ${fmt(i.total)}</td></tr>`).join('');
    }).join(''):'<tr><td colspan="7" class="text-center text-muted py-3">Nenhum registro encontrado</td></tr>';
    summary.innerHTML=[
      `<div class="col-md-3"><strong>Qtd. Vendida:</strong> ${escHtml(state.resumo.qtd)}</div>`,
      `<div class="col-md-3"><strong>Receita Total:</strong> R$ ${fmt(state.resumo.valor)}</div>`,
      `<div class="col-md-3"><strong>Nº de Vendas:</strong> ${escHtml(state.resumo.vendas)}</div>`,
      `<div class="col-md-3"><strong>Ticket Médio:</strong> R$ ${fmt(state.resumo.ticket)}</div>`
    ].join('');
  }

  new bootstrap.Modal(document.getElementById('modalRelPrint')).show();
}
