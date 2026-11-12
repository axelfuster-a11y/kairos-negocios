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
  function describeMoneyAction(text,mention,account,fallback){
    let value=String(text).slice(0,mention.index)+' '+String(text).slice(mention.index+mention.raw.length);
    value=value.replace(/\b(?:gast[eé]|compr[eé]|pagu[eé]|me cobraron|consum[ií]|cobr[eé]|cobraron|ingres[oó]|me pagaron|recib[ií]|me depositaron|ingres[eé]|me ingresaron)\b/gi,' ')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g,' ')
      .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g,' ')
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g,' ')
      .replace(/(?:\$\s*)?\b\d[\d.,]*\b/g,' ')
      .replace(/\b(?:en|desde|por|de|el|la|hoy|ayer|mañana|ahora|tengo|me queda|me quedan|quedan|saldo|disponible|cuenta|y)\b/gi,' ')
      .replace(/\bmp\b/gi,' ');
    if(account?.name){const lower=value.toLowerCase(),name=account.name.toLowerCase(),index=lower.indexOf(name);if(index>=0)value=value.slice(0,index)+' '+value.slice(index+name.length)}
    value=value.replace(/[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9\s'-]/g,' ').replace(/\s+/g,' ').trim();
    return value||fallback;
  }
  function moneyMentionRole(text,mention){
    const before=String(text).slice(Math.max(0,mention.index-100),mention.index).toLowerCase();
    const cues=[
      {role:'balance',pattern:/\b(?:tengo|me queda|me quedan|quedan|saldo|disponible|hay en)\b/g},
      {role:'expense',pattern:/\b(?:gast[eé]|compr[eé]|pagu[eé]|me cobraron|consum[ií])\b/g},
      {role:'income',pattern:/\b(?:cobr[eé]|me pagaron|recib[ií]|me depositaron|me ingresaron|acreditaron|ingres[eé])\b/g}
    ];
    let latest={index:-1,role:null};
    for(const cue of cues){cue.pattern.lastIndex=0;let match;while((match=cue.pattern.exec(before))!==null)if(match.index>latest.index)latest={index:match.index,role:cue.role}}
    return latest.role;
  }
  function extractMovementDate(text){
    const source=String(text),s=source.toLowerCase(),base=today();
    const tokens=[...source.matchAll(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g)],relative=[...s.matchAll(/\b(?:ayer|hoy|mañana)\b/g)];
    if(tokens.length+relative.length>1)return {error:'Encontré más de una fecha. Indica una sola fecha para el movimiento.'};
    let date=base;
    if(tokens.length){
      const raw=tokens[0][0];
      if(/^\d{4}-/.test(raw))date=raw;
      else{
        const [day,month,yearText]=raw.split(/[/-]/).map(Number),year=yearText?(yearText<100?2000+yearText:yearText):Number(base.slice(0,4));
        date=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
      }
    }else if(relative.length){
      const shifted=new Date(base+'T12:00:00');
      shifted.setDate(shifted.getDate()+(s.includes('ayer')?-1:s.includes('mañana')?1:0));
      date=[shifted.getFullYear(),String(shifted.getMonth()+1).padStart(2,'0'),String(shifted.getDate()).padStart(2,'0')].join('-');
    }
    const check=new Date(date+'T00:00:00.000Z');
    if(!Number.isFinite(check.getTime())||check.toISOString().slice(0,10)!==date)return {error:'La fecha indicada no existe. No registraré el movimiento hasta que la corrijas.'};
    return {date};
  }
  assistantReply=function(text){
    const s=String(text).toLowerCase(),amounts=parseMoneyMentions(text);
    const expense=/gast[eé]|compr[eé]|pagu[eé]|me cobraron|consum[ií]/i.test(s);
    const income=/cobr[eé]\s+\$?\s*\d|me pagaron|recib[ií]\s+\$?\s*\d|me depositaron|me ingresaron|acreditaron|ingres[eé]\s+\$?\s*\d/i.test(s);
    const balance=/tengo|qued[aó]|saldo|disponible|me queda|hay en/i.test(s);
    const account=inferAccount(text),accountHint=/\b(?:mercado\s*pago|mp|cuenta|banco|tarjeta|efectivo)\b/i.test(s),chosenAccount=account||(!accountHint&&state.accounts.length===1?state.accounts[0]:null);
    if((expense||income)&&unparsedMoneyMentions(text).some(raw=>KairosDomain.parseMoney(raw)===null)){
      return 'Encontré un importe que no puedo interpretar con seguridad. No voy a registrar nada. Escribe el importe sin separadores de miles o con coma decimal de hasta dos cifras.';
    }
    if(expense&&income){
      return 'Detecté un ingreso y un gasto en el mismo mensaje. Para no asignar mal los importes, envía cada movimiento por separado. No registré nada.';
    }
    const movementType=expense?'expense':income?'income':null;
    const questionIntent=/^\s*¿?\s*(?:cu[aá]nto|qu[eé]|cu[aá]les|cu[aá]ntas|por qu[eé]|c[oó]mo)\b|quiero saber|mu[eé]strame|resumen|historial/i.test(s);
    if(questionIntent)return originalReply(text);
    const parsedDate=movementType?extractMovementDate(text):{date:today()};
    if(parsedDate.error)return parsedDate.error;
    if(movementType&&amounts.length===0)return 'No encontré un importe para ese movimiento. Indica cuánto fue y lo prepararé para que lo revises.';
    if(movementType&&amounts.length===2&&balance){
      const roles=amounts.map(item=>moneyMentionRole(text,item)),movementIndex=roles.indexOf(movementType),balanceIndex=roles.indexOf('balance');
      if(movementIndex>=0&&balanceIndex>=0&&movementIndex!==balanceIndex){
        const movementAmount=amounts[movementIndex],balanceAmount=amounts[balanceIndex],label=movementType==='income'?'ingreso':'gasto';
        pendingChat={kind:'compoundClarification',movementType,expenseAmount:movementAmount.value,balanceAmount:balanceAmount.value,movementIndex,balanceIndex,date:parsedDate.date,accountId:chosenAccount?.id||null,raw:text};
        return 'Entendí un '+label+' de '+money(movementAmount.value)+' y un saldo informado de '+money(balanceAmount.value)+(chosenAccount?' en '+chosenAccount.name:'')+'. No registraré el saldo como otro movimiento. ¿'+money(balanceAmount.value)+' es el saldo actual de esa cuenta después del movimiento?';
      }
    }
    if(movementType&&amounts.length>1){
      pendingChat={kind:'compoundClarification',movementType,amounts:amounts.map(x=>x.value),accountId:chosenAccount?.id||null,raw:text};
      return 'Detecté '+amounts.length+' importes ('+amounts.map(x=>money(x.value)).join(' y ')+'). No voy a elegir uno por suposición. ¿Cuál corresponde al movimiento y qué representa el otro importe?';
    }
    if(movementType&&amounts.length===1){
      const role=moneyMentionRole(text,amounts[0]);
      if(role==='balance')return 'Ese importe parece ser un saldo, no el importe del movimiento. Indica cuánto fue el ingreso o el gasto para evitar registrar el dato equivocado.';
      if(role&&role!==movementType)return 'El importe parece corresponder a otro tipo de dato. Aclara cuál fue el importe del movimiento antes de guardarlo.';
      if(!state.accounts.length)return 'Primero crea una cuenta en Finanzas.';
      const chosen=chosenAccount,fallback=movementType==='income'?'Ingreso informado en el chat':'Gasto informado en el chat';
      pendingChat={kind:'movement',type:movementType,amount:amounts[0].value,date:parsedDate.date,description:describeMoneyAction(text,amounts[0],chosen,fallback),accountId:chosen?.id||null};
      return 'Preparé un movimiento para revisar antes de guardarlo.';
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
      if(previous.expenseAmount===undefined||previous.balanceAmount===undefined){
        pendingChat=null;
        chatSay('assistant','Todavía necesito que indiques qué importe corresponde al movimiento y qué representa el otro. No preparé nada.');
        await save();renderAssistant();return;
      }
      if(/^(sí|si|correcto|exacto|así es|después del gasto|después del ingreso|después del movimiento)(?:[,.! ]|$)/.test(answer)){
        const raw=previous.raw||'',mentions=KairosDomain.extractMoneyMentions(raw),movementMention=mentions[previous.movementIndex??0];
        const fallback=previous.movementType==='income'?'Ingreso informado en el chat':'Gasto informado en el chat';
        const linkedAccount=state.accounts.find(a=>a.id===previous.accountId)||null;
        const description=movementMention?describeMoneyAction(raw,movementMention,linkedAccount,fallback):fallback;
        const type=previous.movementType||'expense',label=type==='income'?'ingreso':'gasto';
        pendingChat={kind:'movement',type,amount:previous.expenseAmount,date:previous.date||today(),description,accountId:previous.accountId||null};
        const response=previous.accountId
          ?'Perfecto. Preparé un '+label+' de '+money(previous.expenseAmount)+' por "'+description+'" en '+accountName(previous.accountId)+'. El saldo de '+money(previous.balanceAmount)+' queda como dato informado. ¿Confirmas el '+label+'?'
          :'Perfecto. Preparé el '+label+' de '+money(previous.expenseAmount)+' por "'+description+'". ¿En qué cuenta '+(type==='income'?'recibiste el dinero':'salió')+'?';
        const actions=previous.accountId?'<button data-chat-confirm>Confirmar '+label+'</button> <button data-chat-cancel>Cancelar</button>':state.accounts.map(a=>'<button data-chat-account="'+a.id+'">'+esc(a.name)+'</button>').join('');
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
