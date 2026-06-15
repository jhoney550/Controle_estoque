async function loadInicio(){
  await loadPDVSupabase();
  const hoje=today();
  const vendasHoje=vendasCache.filter(v=>dataLocalISO(v.dt)===hoje && !vendaCancelada(v));
  let faturamento=0;
  let qtdTotal=0;
  const porProduto={};
  vendasHoje.forEach(v=>{
    faturamento+=vendaTotalComDesconto(v);
    (v.itens||[]).forEach(i=>{
      const qtd=+i.qtd||0;
      qtdTotal+=qtd;
      const nome=i.nome||i.pid||'Produto';
      if(!porProduto[nome])porProduto[nome]=0;
      porProduto[nome]+=qtd;
    });
  });
  const top=Object.entries(porProduto).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('home-fat-hoje').textContent=`R$ ${fmt(faturamento)}`;
  document.getElementById('home-qtd-hoje').textContent=qtdTotal;
  document.getElementById('home-prod-top').textContent=top?top[0]:'Nenhum';
  document.getElementById('home-prod-top-qtd').textContent=top?`${top[1]} unidades hoje`:'0 unidades hoje';
}
