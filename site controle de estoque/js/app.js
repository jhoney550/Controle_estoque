// NAVIGATION
// ===========================================================
function nav(sec){
  if(!segurancaTemAcesso(sec)){
    toast('Tela não liberada para este usuário.', 'warning');
    return;
  }
  if(telaEmEdicao()){
    toast('a Tela esta em Edição, finalize o lançamento ou cancela a operação','warning');
    return;

}
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('section-'+sec).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>{
    if((n.getAttribute('onclick')||'').includes(`'${sec}'`))n.classList.add('active');
  });
  const loaders={
    'inicio':loadHome,
    'usuarios':loadU,
    'produtos':loadP,
    'entrada':loadE,
    'venda':loadVHist,
    'rel-entrada':initRelEnt,
    'rel-venda':initRelVenda,
    'seguranca':loadSeguranca
  };
  if(loaders[sec]){
    const result=loaders[sec]();
    if(result&&typeof result.catch==='function'){
      result.catch(error=>{
        console.error(error);
        toast('Erro ao carregar dados da tela.','danger');
      });
    }
  }
}

// Clock
function tick(){
  const now=new Date();
  const s=now.toLocaleString('pt-BR');
  const c=document.getElementById('clock');
  const p=document.getElementById('pos-clock');
  if(c)c.textContent=s;
  if(p)p.textContent=now.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'medium'});
}
setInterval(tick,1000);tick();

// Close dropdowns
document.addEventListener('click',e=>{
  if(!e.target.closest('#e-prod-nome')&&!e.target.closest('#e-dd'))
    document.getElementById('e-dd').style.display='none';
  if(!e.target.closest('#v-prod-input')&&!e.target.closest('#v-dd'))
    document.getElementById('v-dd').style.display='none';
  const row=e.target.closest('#main .tbl-c tbody tr');
  if(row){
    const tbody=row.closest('tbody');
    tbody.querySelectorAll('tr.sel').forEach(tr=>tr.classList.remove('sel'));
    row.classList.add('sel');
  }
});

// Print
function printRelatorio(){window.print();}

function escHtml(valor){
  return String(valor??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function telaEmEdicao(){
  return !!(uState?.mode||pState?.mode||eState?.mode||vState?.mode);
}

function aplicarTemaSalvo(){
  const tema=localStorage.getItem('gel_tema')||'claro';
  document.body.classList.toggle('theme-dark',tema==='escuro');
  const btn=document.getElementById('theme-toggle');
  if(btn)btn.innerHTML=tema==='escuro'?'<i class="fas fa-sun me-1"></i>Tema Claro':'<i class="fas fa-moon me-1"></i>Tema Escuro';
}

function toggleTema(){
  const escuro=!document.body.classList.contains('theme-dark');
  localStorage.setItem('gel_tema',escuro?'escuro':'claro');
  aplicarTemaSalvo();
}

function alvoDigitavel(el){
  if(!el)return false;
  const tag=(el.tagName||'').toLowerCase();
  return tag==='input'||tag==='textarea'||tag==='select'||el.isContentEditable;
}

function sistemaVisivel(){
  const login=document.getElementById('login-screen');
  return !login||login.style.display==='none';
}

function secaoAtiva(){
  const ativa=document.querySelector('#content .section.active');
  return ativa?ativa.id.replace('section-',''):'';
}

function mostrarEntradaManutencao(){
  document.querySelectorAll('#ent-tabs .nav-link').forEach(b=>b.classList.remove('active'));
  const btns=document.querySelectorAll('#ent-tabs .nav-link');
  if(btns[1])btns[1].classList.add('active');
  eState.tab='man';
  document.getElementById('ent-tab-lista').style.display='none';
  document.getElementById('ent-tab-man').style.display='';
}

function mostrarUsuarioManutencao(){
  document.querySelectorAll('#u-tabs .nav-link').forEach(b=>b.classList.remove('active'));
  const btns=document.querySelectorAll('#u-tabs .nav-link');
  if(btns[1])btns[1].classList.add('active');
  uState.tab='man';
  document.getElementById('u-tab-lista').style.display='none';
  document.getElementById('u-tab-man').style.display='';
}

function mostrarProdutoManutencao(){
  document.querySelectorAll('#p-tabs .nav-link').forEach(b=>b.classList.remove('active'));
  const btns=document.querySelectorAll('#p-tabs .nav-link');
  if(btns[1])btns[1].classList.add('active');
  pState.tab='man';
  document.getElementById('p-tab-lista').style.display='none';
  document.getElementById('p-tab-man').style.display='';
}

function incluirTelaAtiva(){
  if(telaEmEdicao()){toast('a Tela esta em Edição, finalize o lançamento ou cancela a operação','warning');return;}
  const sec=secaoAtiva();
  if(sec==='usuarios'){
    mostrarUsuarioManutencao();
    uIncluir();
  }
  if(sec==='produtos'){
    mostrarProdutoManutencao();
    pIncluir();
  }
  if(sec==='entrada'){
    mostrarEntradaManutencao();
    eIncluir();
  }
}

function gravarTelaAtivaKeydown(e){
  if(e.key!=='Enter'||e.shiftKey)return;
  e.preventDefault();
  const sec=secaoAtiva();
  if(sec==='usuarios'&&uState.mode)uGravar();
  if(sec==='produtos'&&pState.mode)pGravar();
  if(sec==='entrada'&&eState.mode)eGravar();
}

document.addEventListener('keydown', function(event){
  if(event.ctrlKey||event.altKey||event.metaKey||!sistemaVisivel())return;
  const modalAberto=document.querySelector('.modal.show');
  if(event.key==='F1'&&secaoAtiva()==='venda'){
    if(modalAberto)return;
    event.preventDefault();
    vIncluir();
    return;
  }
  if(event.key==='Escape'){
    if(modalAberto)return;
    const sec=secaoAtiva();
    if(sec==='usuarios'&&uState.mode){event.preventDefault();uCancelar();return;}
    if(sec==='produtos'&&pState.mode){event.preventDefault();pCancelar();return;}
    if(sec==='entrada'&&eState.mode){event.preventDefault();eCancelar();return;}
    if(sec==='venda'&&vState.mode){event.preventDefault();vCancelar();return;}
  }
  if(event.key==='F2'){
    if(modalAberto||secaoAtiva()!=='venda')return;
    event.preventDefault();
    vFinalizar();
    return;
  }
  if(event.key&&event.key.toLowerCase()==='i'&&!alvoDigitavel(event.target)&&!modalAberto){
    event.preventDefault();
    incluirTelaAtiva();
  }
});

function configurarAtalhosDataRelatorio(){
  document.querySelectorAll('.js-date-filter').forEach(input=>{
    input.addEventListener('keydown', event=>{
      if(event.key&&event.key.toLowerCase()==='t'){
        event.preventDefault();
        input.value=formatarDataFiltro(today());
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.select();
      }
    });
    input.addEventListener('dblclick', ()=>input.select());
    input.addEventListener('blur', ()=>{
      const data=formatarDataFiltro(input.value);
      if(data)input.value=data;
    });
    input.addEventListener('dragstart', event=>event.preventDefault());
    input.addEventListener('drop', event=>event.preventDefault());
  });
}

function abrirCalendarioRel(inputId, trigger){
  const input=document.getElementById(inputId);
  if(!input)return;
  let picker=document.getElementById(inputId+'-picker');
  if(!picker){
    picker=document.createElement('input');
    picker.type='date';
    picker.id=inputId+'-picker';
    picker.className='date-filter-picker';
    picker.addEventListener('change', ()=>{
      input.value=formatarDataFiltro(picker.value);
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      input.focus();
      input.select();
    });
    document.body.appendChild(picker);
  }
  const iso=normalizarDataFiltro(input.value);
  picker.value=/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso:today();
  const base=trigger||input;
  const rect=base.getBoundingClientRect();
  const left=Math.min(Math.max(rect.left, 8), window.innerWidth-42);
  const top=Math.min(Math.max(rect.top, 8), window.innerHeight-38);
  picker.style.left=left+'px';
  picker.style.top=top+'px';
  if(typeof picker.showPicker==='function')picker.showPicker();
  else picker.click();
}

// ===========================================================
// INIT
// ===========================================================
initDB(); // Primeiro cria o banco/admin se não existir
aplicarTemaSalvo();
aplicarMenuPermissoes();
configurarAtalhosDataRelatorio();

// Não chame nav('usuarios') direto aqui se quiser que a tela de login bloqueie tudo no início.
// Como a div do login inicia com display: flex, ela vai cobrir o fundo até o login ser feito.
