// Kairós quality layer: accessible preferences, safer multi-fact chat parsing and navigation.
(function(){
  const originalReply=assistantReply;
  const originalSend=sendChat;
  const moneyValue=s=>{let x=String(s).replace(/\s/g,'');if(x.includes(',')&&x.includes('.'))x=x.replace(/\./g,'').replace(',','.');else if(x.includes(','))x=x.replace(',','.');else if((x.match(/\./g)||[]).length===1&&x.split('.')[1].length===3)x=x.replace('.','');return Number(x)};
  function parseMoneyMentions(text){
    const re=/(?:\$\s*)?\b\d[\d.,]*\b\s*(?:pesos|ars)?/gi, out=[];let m;
    while((m=re.exec(text))!==null){const value=moneyValue(m[0]);if(Number.isFinite(value)&&value>0)out.push({value,index:m.index,raw:m[0]})}
    return out;
  }
  function inferAccount(text){
    const s=text.toLowerCase();
    return state.accounts.find(a=>s.includes(a.name.toLowerCase()))||state.accounts.find(a=>a.kind?.toLowerCase().includes('billetera')&&/mercado\s*pago|mp\b/.test(s))||null;
  }
  assistantReply=function(text){
    const s=text.toLowerCase(), amounts=parseMoneyMentions(text);
    const expense=/gast[eé]|compr[eé]|pagu[eé]|me cobraron|consum[ií]/i.test(s);
    const balance=/tengo|qued[aó]|saldo|disponible|me queda|hay en/i.test(s);
    const account=inferAccount(text);
    if(expense&&amounts.length>=2&&balance){
      const first=amounts[0], second=amounts[1];
      pendingChat={kind:'compoundClarification',expenseAmount:first.value,balanceAmount:second.value,accountId:account?.id||null,raw:text};
      return 'Entendí dos datos distintos: un gasto de '+money(first.value)+' y un saldo informado de '+money(second.value)+(account?' en '+account.name:'')+'. No voy a registrar el segundo importe como otro movimiento. Antes de guardar el gasto, necesito confirmar: ¿'+money(second.value)+' es el saldo actual de esa cuenta después del gasto?';
    }
    if(expense&&amounts.length>1){
      pendingChat={kind:'compoundClarification',amounts:amounts.map(x=>x.value),accountId:account?.id||null,raw:text};
      return 'Detecté '+amounts.length+' importes ('+amounts.map(x=>money(x.value)).join(' y ')+'). No voy a elegir uno ni registrar algo por suposición. ¿Cuál corresponde al gasto y qué representa el otro importe?';
    }
    if(expense&&amounts.length===1&&account){
      const reply=originalReply(text);
      if(pendingChat?.kind==='movement')pendingChat.accountId=account.id;
      return reply;
    }
    return originalReply(text);
  };
  sendChat=async function(text){pendingChat=null;return originalSend(text)};
  function applyDisplayPrefs(){
    const p=state.prefs||{},theme=['light','dark','system'].includes(p.theme)?p.theme:'light';
    document.documentElement.dataset.theme=theme;
    document.documentElement.dataset.fontScale=['normal','large','larger'].includes(p.fontScale)?p.fontScale:'normal';
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=theme==='dark'?'#202923':'#f4f2ec';
  }
  const oldSettings=renderSettings;
  renderSettings=function(){
    oldSettings();
    const card=$('view-settings').querySelector('.settings-grid .card');
    if(!card)return;
    const box=document.createElement('div');
    box.className='setting-row display-preferences';
    box.innerHTML='<div><b>Apariencia y lectura</b><small>Elegí el tema y un tamaño de letra cómodo.</small><div class="display-controls"><label for="prefTheme">Tema</label><select class="control" id="prefTheme"><option value="light">Claro</option><option value="dark">Oscuro</option><option value="system">Según el dispositivo</option></select><label for="prefFont">Tamaño de letra</label><select class="control" id="prefFont"><option value="normal">Normal</option><option value="large">Grande</option><option value="larger">Muy grande</option></select></div></div>';
    card.insertBefore(box,card.querySelector('#savePrefs'));
    $('prefTheme').value=state.prefs.theme||'light';$('prefFont').value=state.prefs.fontScale||'normal';
    const saveButton=$('savePrefs'),old=saveButton.onclick;
    saveButton.onclick=async()=>{const theme=$('prefTheme').value,fontScale=$('prefFont').value;await old?.();state.prefs.theme=theme;state.prefs.fontScale=fontScale;await save();applyDisplayPrefs();renderSettings();toast('Preferencias visuales guardadas')};
  };
  document.addEventListener('click',e=>{const metric=e.target.closest('[data-metric-view]');if(metric)nav(metric.dataset.metricView)});
  applyDisplayPrefs();
})();
