const DB = {

  g: k => JSON.parse(localStorage.getItem('ss_'+k)||'[]'),
  s: (k,v) => localStorage.setItem('ss_'+k, JSON.stringify(v)),
  gi: k => parseInt(localStorage.getItem('ss_'+k)||'1'),
  si: (k,v) => localStorage.setItem('ss_'+k, String(v))
  
};


const enc = s => btoa(unescape(encodeURIComponent(s)));
const dec = s => { try { return decodeURIComponent(escape(atob(s))); } catch(e){ return ''; } };
function dataLocalISO(data=new Date()){
  const d = data instanceof Date ? data : new Date(data);
  if(Number.isNaN(d.getTime()))return '';
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function dataHoraLocalISO(data=new Date()){
  const d = data instanceof Date ? data : new Date(data);
  if(Number.isNaN(d.getTime()))return '';
  const h = String(d.getHours()).padStart(2,'0');
  const min = String(d.getMinutes()).padStart(2,'0');
  const s = String(d.getSeconds()).padStart(2,'0');
  return `${dataLocalISO(d)}T${h}:${min}:${s}`;
}
function normalizarDataFiltro(valor){
  const v=String(valor||'').trim();
  if(!v)return '';
  const iso=v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(iso)return v;
  const br=v.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  return br?`${br[3]}-${br[2]}-${br[1]}`:v;
}
function formatarDataFiltro(valor){
  const iso=normalizarDataFiltro(valor);
  if(!iso)return '';
  const partes=iso.split('-');
  return partes.length===3?`${partes[2]}-${partes[1]}-${partes[0]}`:valor;
}
function tabParaGravar(event, btnId){
  if(event.key !== 'Tab' || event.shiftKey)return;
  const btn = document.getElementById(btnId);
  if(!btn || btn.disabled)return;
  event.preventDefault();
  btn.focus();
}

function abrirEstruturas(){
  document.getElementById('estruturas-sql').value = ESTRUTURAS_SQL;
  new bootstrap.Modal(document.getElementById('modalEstruturas')).show();
}

async function copiarEstruturasSql(){
  const sql = document.getElementById('estruturas-sql').value;
  try{
    await navigator.clipboard.writeText(sql);
    toast('SQL copiado para a área de transferência!');
  }catch(err){
    const campo = document.getElementById('estruturas-sql');
    campo.focus();
    campo.select();
    toast('Selecione e copie o SQL manualmente.', 'warning');
  }
}
const today = () => dataLocalISO();
const fmt = v => parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtD = d => { if(!d)return''; const base=d.includes('T')?dataLocalISO(d):d; const[y,m,dd]=base.split('-'); return`${dd}/${m}/${y}`; };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function nextId(k){ const id=DB.gi(k); DB.si(k,id+1); return id; }

// UTILITIES
// ===========================================================
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Cria a div do balão
  const toastEl = document.createElement('div');
  toastEl.className = `custom-toast toast-${type}`;

  // Define o ícone do Font Awesome correspondente ao tipo
  let iconClass = 'fa-check-circle'; // Padrão success
  if (type === 'danger') iconClass = 'fa-exclamation-circle';
  if (type === 'warning') iconClass = 'fa-exclamation-triangle';
  if (type === 'info') iconClass = 'fa-info-circle';

  // Monta o conteúdo interno com o ícone e o texto
  toastEl.innerHTML = `
    <i class="fas ${iconClass}"></i>
    <div>${msg}</div>
  `;

  // Adiciona ao container (empilhando caso haja mais de um ativo)
  container.appendChild(toastEl);

  // Remove o elemento do HTML após a animação de saída terminar (4 segundos)
  setTimeout(() => {
    toastEl.remove();
  }, 4000);
}

function toggleSenha(inputId,iconId){
  const inp=document.getElementById(inputId);
  const ic=document.getElementById(iconId);
  if(inp.type==='password'){inp.type='text';ic.className='fas fa-eye-slash';}
  else{inp.type='password';ic.className='fas fa-eye';}
}

function upperCampo(campo){
  const pos=campo.selectionStart;
  campo.value=campo.value.toUpperCase();
  if(typeof pos==='number')campo.setSelectionRange(pos,pos);
}

function somenteNumeros(campo){
  const pos=campo.selectionStart;
  campo.value=campo.value.replace(/\D/g,'');
  if(typeof pos==='number')campo.setSelectionRange(pos,pos);
}
 
function eletroMascaraMoeda(campo) {
  let valor = campo.value.replace(/\D/g, "");
  if (valor === "") { campo.value = ""; return; }
  valor = (parseFloat(valor) / 100).toFixed(2);
  valor = valor.replace(".", ",");
  valor = valor.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
  campo.value = "R$ " + valor;
}

// Função auxiliar para converter o texto "R$ 1.250,50" de volta para o número float do JS 1250.50
function converterMoedaParaFloat(valorTexto) {
  if (!valorTexto) return 0;
  let limpo = valorTexto.replace("R$", "").replace(/\s/g, "").trim();
  limpo = limpo.replace(/\./g, "").replace(",", ".");
  return parseFloat(limpo) || 0;
}

function normalizarTextoOrdenacao(valor){
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase();
}

function compararValoresOrdenacao(a,b,tipo='texto'){
  if(tipo==='numero'){
    const na=parseFloat(String(a ?? '').replace(/\./g,'').replace(',','.')) || 0;
    const nb=parseFloat(String(b ?? '').replace(/\./g,'').replace(',','.')) || 0;
    return na-nb;
  }
  if(tipo==='data'){
    return String(a ?? '').localeCompare(String(b ?? ''));
  }
  return normalizarTextoOrdenacao(a).localeCompare(normalizarTextoOrdenacao(b),'pt-BR',{numeric:true});
}

function alternarOrdenacaoTabela(state,coluna){
  if(state.sortCol===coluna){
    state.sortDir=state.sortDir==='asc'?'desc':'asc';
  }else{
    state.sortCol=coluna;
    state.sortDir='asc';
  }
}

function indicadorOrdenacao(state,coluna){
  if(state.sortCol!==coluna)return '<i class="fas fa-sort ms-1 text-muted"></i>';
  return state.sortDir==='asc'
    ? '<i class="fas fa-sort-up ms-1"></i>'
    : '<i class="fas fa-sort-down ms-1"></i>';
}
