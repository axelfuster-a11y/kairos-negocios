// Kairós quality layer: accessible preferences, safer multi-fact chat parsing and navigation.
(function(){
  const originalReply=assistantReply;
  const originalSend=sendChat;
  function parseMoneyMentions(text){return KairosDomain.extractMoneyMentions(text)}
  function unparsedMoneyMentions(text){
    const masked=String(text).replace(/\b\d{4}-\d{2}-\d{2}\b/g,m=>' '.repeat(m.length)).replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g,m=>' '.repeat(m.length)).replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g,m=>' '.repeat(m.length));
    return masked.match(/\b\d[\d.,]*\b/g)||[];
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
    if(expense&&unparsedMoneyMentions(text).some(raw=>KairosDomain.parseMoney(raw)===null)){
      return 'Encontré un importe con separadores ambiguos. No voy a registrar nada todavía. Escribilo sin separadores de miles o con coma decimal de hasta dos cifras.';
    }
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
    box.innerHTML='<div><b>Apariencia y lectura</b><small>Elige el tema y un tamaño de letra cómodo.</small><div class="display-controls"><label for="prefTheme">Tema</label><select class="control" id="prefTheme"><option value="light">Claro</option><option value="dark">Oscuro</option><option value="system">Según el dispositivo</option></select><label for="prefFont">Tamaño de letra</label><select class="control" id="prefFont"><option value="normal">Normal</option><option value="large">Grande</option><option value="larger">Muy grande</option></select></div></div>';
    card.insertBefore(box,card.querySelector('#savePrefs'));
    $('prefTheme').value=state.prefs.theme||'light';$('prefFont').value=state.prefs.fontScale||'normal';
    const saveButton=$('savePrefs'),old=saveButton.onclick;
    saveButton.onclick=async()=>{const theme=$('prefTheme').value,fontScale=$('prefFont').value;await old?.();state.prefs.theme=theme;state.prefs.fontScale=fontScale;await save();applyDisplayPrefs();renderSettings();toast('Preferencias visuales guardadas')};
  };

  const basicSend=sendChat;
  sendChat=async function(text){
    const previous=pendingChat, answer=String(text||'').trim().toLowerCase();
    if(previous?.kind==='compoundClarification'){
      chatSay('user',String(text||''));
      if(/^(sí|si|correcto|exacto|así es|después del gasto)[.! ]*$/.test(answer)){
        const raw=previous.raw||'',mentions=KairosDomain.extractMoneyMentions(raw),first=mentions[0],second=mentions[1];
        const description=(first&&second?raw.slice(first.index+first.raw.length,second.index):'')
          .replace(/\b(?:el\s+)?\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g,' ')
          .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g,' ')
          .replace(/^\s*el\s+/i,'')
          .replace(/^\s*(?:en|por)\s+/i,'')
          .replace(/[,;\.\s]+(?:y\s+)?(?:ahora\s+)?(?:tengo|me queda|me quedan|quedan|saldo|disponible)\b[\s\S]*$/i,'')
          .trim().replace(/[.,;]+$/,'')||'Gasto informado en el chat';
        pendingChat={kind:'movement',type:'expense',amount:previous.expenseAmount,description,accountId:previous.accountId||null};
        const response=previous.accountId
          ?'Perfecto. Preparé un gasto de '+money(previous.expenseAmount)+' por "'+description+'" en '+accountName(previous.accountId)+'. El saldo de '+money(previous.balanceAmount)+' queda como dato informado, no lo usaré para inventar otro movimiento. ¿Confirmas el gasto?'
          :'Perfecto. Preparé el gasto de '+money(previous.expenseAmount)+' por "'+description+'". ¿De qué cuenta salió? '+state.accounts.map(a=>a.name).join(', ');
        const actions=previous.accountId?'<button data-chat-confirm>Confirmar gasto</button> <button data-chat-cancel>Cancelar</button>':state.accounts.map(a=>'<button data-chat-account="'+a.id+'">'+esc(a.name)+'</button>').join('');
        chatSay('assistant',response,actions);
      }else{
        pendingChat=null;
        chatSay('assistant','No registré nada. Cuéntame qué representa cada importe y lo vuelvo a interpretar.');
      }
      await save();renderAssistant();return;
    }
    pendingChat=null;
    return basicSend(text);
  };

  const baseMetric=metric;
  metric=function(label,value,note,cls=''){
    const target=view==='work'?'work':view==='finance'?'finance':view==='organize'?'organize':/deuda/i.test(label)?'finance':/disponible|ingresos|gastos/i.test(label)?'finance':/pendientes|completadas|atrasadas/i.test(label)?'organize':null;
    return baseMetric(label,value,note,cls).replace('<article class="card metric-card','<article '+(target?'data-metric-view="'+target+'" tabindex="0" role="link" aria-label="Ver detalle de '+label+'" ':'')+'class="card metric-card');
  };
  document.addEventListener('click',e=>{const metricCard=e.target.closest('[data-metric-view]');if(metricCard)nav(metricCard.dataset.metricView)});
  document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-metric-view]')){e.preventDefault();nav(e.target.dataset.metricView)}});

  const baseNav=nav;
  nav=function(next){applyDisplayPrefs();return baseNav(next)};
  applyDisplayPrefs();
})();
