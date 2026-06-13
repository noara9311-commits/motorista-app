import { useState, useEffect } from "react";

const SUPABASE_URL = "https://crlcqtfejjewxisriksi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNybGNxdGZlampld3hpc3Jpa3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNzg4MzgsImV4cCI6MjA5NTc1NDgzOH0.sS3g_ur-dBvMLixFYcrYZ1KVIReZ-eNHf8a5zroeXy4";
const LOCAL_KEY    = "motorista_session_v8";
const DEMO_KEY     = "motorista_demo_start";
const DEMO_DAYS    = 3;

async function sbFetch(path, opts = {}) {
  const token = opts._token || SUPABASE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${token}`,
      "Prefer": opts.headers?.Prefer || "return=representation",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    console.error("sbFetch error:", path, e);
    throw new Error(e.message || e.error || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}
async function sbAuth(endpoint, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, { method:"POST", headers:{"Content-Type":"application/json",apikey:SUPABASE_KEY}, body:JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description||data.msg||"Erro");
  return data;
}

const DEFAULT_PLATAFORMAS = [
  {nome:"Uber",comissao:25},{nome:"99",comissao:20},{nome:"InDriver",comissao:15},{nome:"Cabify",comissao:22}
];
const DEFAULT_CONFIG = { custoPorKm:0.45, metaMensal:3000, modeloCarro:"", anoFabricacao:"", placa:"", kmAtual:"", notificacoesAtivas:false };
const TURNOS = [{id:"manha",label:"Manhã",icon:"🌅"},{id:"tarde",label:"Tarde",icon:"☀️"},{id:"noite",label:"Noite",icon:"🌆"},{id:"madrugada",label:"Madrugada",icon:"🌙"}];

function fmt(v){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);}
function today(){return new Date().toISOString().split("T")[0];}
function getMes(offset=0){const d=new Date();d.setMonth(d.getMonth()+offset);return d.toISOString().slice(0,7);}
function nomeMes(m){const[y,mo]=m.split("-");return new Date(+y,+mo-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});}
function defaultData(){return{corridas:[],abastecimentos:[],despesasFixas:[],manutencoes:[],plataformas:DEFAULT_PLATAFORMAS,config:DEFAULT_CONFIG};}
function semanaAtual(){const d=new Date();const dia=d.getDay();const inicio=new Date(d);inicio.setDate(d.getDate()-dia);return inicio.toISOString().split("T")[0];}
function semanaPasada(){const d=new Date();const dia=d.getDay();const inicio=new Date(d);inicio.setDate(d.getDate()-dia-7);const fim=new Date(d);fim.setDate(d.getDate()-dia-1);return{inicio:inicio.toISOString().split("T")[0],fim:fim.toISOString().split("T")[0]};}

const TABS  = ["Início","Lançar","Radar","Veículo","Config"];
const ICONS = ["📊","🚗","🧠","🔧","⚙️"];

// ══ INSIGHTS ENGINE ══
function gerarInsights(data, corridasMes, lucroLiq, faltaMeta, porDia, diasRest) {
  const insights = [];
  if (!data||!corridasMes.length) return [{tipo:"info",cor:"azul",icon:"🚗",texto:"Lance seus primeiros dias de trabalho para o Radar começar a analisar seu desempenho!"}];

  const getMes0 = getMes(0);
  const semIni  = semanaAtual();
  const semAnt  = semanaPasada();

  // helpers
  function getComissao(nome){return(data.plataformas.find(p=>p.nome===nome)||{comissao:25}).comissao;}
  function calcLucro(c){return c.ganho-c.ganho*getComissao(c.plataforma)/100-c.km*data.config.custoPorKm-(c.combustivel||0);}

  const corrSemAtual = data.corridas.filter(c=>c.data>=semIni&&c.data.startsWith(getMes0.slice(0,7)));
  const corrSemAnt   = data.corridas.filter(c=>c.data>=semAnt.inicio&&c.data<=semAnt.fim);

  // 1. Projeção de fechamento
  if(corridasMes.length>=3){
    const mediaDiaria = lucroLiq / Math.max(new Date().getDate(),1);
    const diasNoMes   = new Date(+getMes0.split("-")[0],+getMes0.split("-")[1],0).getDate();
    const projecao    = mediaDiaria * diasNoMes;
    const diff        = projecao - data.config.metaMensal;
    if(diff>=0){
      insights.push({tipo:"conquista",cor:"verde",icon:"🎯",texto:`No ritmo atual você fechará o mês com ${fmt(projecao)} — ${fmt(diff)} acima da sua meta! Continue assim! 🎉`});
    } else {
      insights.push({tipo:"oportunidade",cor:"azul",icon:"🎯",texto:`No ritmo atual você fechará com ${fmt(projecao)}. Trabalhando mais ${Math.ceil(Math.abs(diff)/mediaDiaria)} dias no seu ritmo você bate a meta!`});
    }
  }

  // 2. Comparativo plataformas
  const porPlat={};
  corridasMes.forEach(c=>{
    if(!porPlat[c.plataforma])porPlat[c.plataforma]={lucro:0,horas:0,ganho:0};
    porPlat[c.plataforma].lucro+=calcLucro(c);
    porPlat[c.plataforma].horas+=c.horas||0;
    porPlat[c.plataforma].ganho+=c.ganho;
  });
  const platsComHora = Object.entries(porPlat).filter(([,v])=>v.horas>0).map(([n,v])=>({nome:n,lph:v.lucro/v.horas})).sort((a,b)=>b.lph-a.lph);
  if(platsComHora.length>=2){
    const melhor=platsComHora[0], pior=platsComHora[platsComHora.length-1];
    const pct=Math.round((melhor.lph/pior.lph-1)*100);
    insights.push({tipo:"dica",cor:"verde",icon:"🏆",texto:`A ${melhor.nome} está sendo sua plataforma mais lucrativa por hora — ${pct}% acima da ${pior.nome}. Priorizar ela nos horários de pico pode aumentar seu lucro mensal.`});
  } else if(Object.keys(porPlat).length>=2){
    const sorted=Object.entries(porPlat).sort((a,b)=>b[1].lucro-a[1].lucro);
    const pct=Math.round((sorted[0][1].lucro/Math.max(sorted[sorted.length-1][1].lucro,1)-1)*100);
    insights.push({tipo:"dica",cor:"verde",icon:"🏆",texto:`A ${sorted[0][0]} está gerando ${pct}% mais lucro que a ${sorted[sorted.length-1][0]} este mês. Considere priorizar ela!`});
  }

  // 3. Turno mais lucrativo
  const porTurno={};
  corridasMes.filter(c=>c.turno).forEach(c=>{
    if(!porTurno[c.turno])porTurno[c.turno]={lucro:0,dias:0};
    porTurno[c.turno].lucro+=calcLucro(c);
    porTurno[c.turno].dias++;
  });
  const turnosSorted=Object.entries(porTurno).sort((a,b)=>b[1].lucro/b[1].dias-a[1].lucro/a[1].dias);
  if(turnosSorted.length>=2){
    const melhorT=TURNOS.find(t=>t.id===turnosSorted[0][0]);
    const piorT  =TURNOS.find(t=>t.id===turnosSorted[turnosSorted.length-1][0]);
    if(melhorT&&piorT){
      const mediaM=(turnosSorted[0][1].lucro/turnosSorted[0][1].dias);
      const mediaP=(turnosSorted[turnosSorted.length-1][1].lucro/turnosSorted[turnosSorted.length-1][1].dias);
      const pctT  =Math.round((mediaM/Math.max(mediaP,1)-1)*100);
      insights.push({tipo:"dica",cor:"azul",icon:"⏰",texto:`Seu ${melhorT.icon} turno da ${melhorT.label} rende ${pctT}% mais por dia que o turno da ${piorT.label}. Ajustar sua rotina pode fazer grande diferença!`});
    }
  }

  // 4. Dia da semana mais lucrativo
  const porDiaSem={};
  const diasNomes=["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  corridasMes.forEach(c=>{
    const ds=new Date(c.data+"T12:00:00").getDay();
    if(!porDiaSem[ds])porDiaSem[ds]={lucro:0,count:0};
    porDiaSem[ds].lucro+=calcLucro(c);
    porDiaSem[ds].count++;
  });
  const diasSorted=Object.entries(porDiaSem).map(([d,v])=>({dia:+d,media:v.lucro/v.count})).sort((a,b)=>b.media-a.media);
  if(diasSorted.length>=3){
    const melhorD=diasSorted[0], piorD=diasSorted[diasSorted.length-1];
    insights.push({tipo:"dica",cor:"azul",icon:"📅",texto:`${diasNomes[melhorD.dia]} e ${diasNomes[diasSorted[1].dia]} são seus dias mais lucrativos. Planeje sua semana priorizando esses dias!`});
    insights.push({tipo:"oportunidade",cor:"amarelo",icon:"💡",texto:`Suas ${diasNomes[piorD.dia]}s têm potencial de crescimento — experimente um turno diferente e veja o impacto no seu resultado.`});
  }

  // 5. Combustível acima da média
  const abastMes = data.abastecimentos.filter(a=>a.data.startsWith(getMes0));
  const abastAnt = data.abastecimentos.filter(a=>a.data.startsWith(getMes(-1)));
  if(abastMes.length>=2&&abastAnt.length>=2){
    const mediaMes=abastMes.reduce((s,a)=>s+a.valor,0)/abastMes.length;
    const mediaAnt=abastAnt.reduce((s,a)=>s+a.valor,0)/abastAnt.length;
    const diffComb=mediaMes-mediaAnt;
    if(diffComb>30){
      insights.push({tipo:"atencao",cor:"amarelo",icon:"⛽",texto:`Seu gasto médio por abastecimento aumentou ${fmt(diffComb)} em relação ao mês passado. Vale verificar se houve mudança de rota ou no trânsito da sua região.`});
    } else if(diffComb<-20){
      insights.push({tipo:"conquista",cor:"verde",icon:"⛽",texto:`Ótimo! Seu gasto com combustível caiu ${fmt(Math.abs(diffComb))} por abastecimento em relação ao mês passado. Eficiência aumentando! 🌿`});
    }
  }

  // 6. Comparativo semanas
  if(corrSemAtual.length>=2&&corrSemAnt.length>=2){
    const lucroAtual=corrSemAtual.reduce((s,c)=>s+calcLucro(c),0);
    const lucroAnt  =corrSemAnt.reduce((s,c)=>s+calcLucro(c),0);
    const pctSem    =Math.round((lucroAtual/Math.max(lucroAnt,1)-1)*100);
    if(pctSem>=10){
      insights.push({tipo:"conquista",cor:"verde",icon:"📈",texto:`Você está ${pctSem}% acima da semana passada! Semana excelente — seu esforço está gerando resultado real.`});
    } else if(pctSem<=-10){
      insights.push({tipo:"oportunidade",cor:"azul",icon:"📈",texto:`Semana um pouco abaixo da anterior. Seu histórico mostra que você tem capacidade de recuperar — foco nos próximos dias!`});
    }
  }

  // 7. Meta em risco ou no caminho
  if(faltaMeta>0&&diasRest>0){
    if(porDia>data.config.metaMensal*0.15){
      insights.push({tipo:"atencao",cor:"amarelo",icon:"🎯",texto:`Para bater a meta você precisa de ${fmt(porDia)} por dia nos próximos ${diasRest} dias. Intensificar alguns turnos pode fazer a diferença!`});
    }
  }

  // 8. Consistência
  const diasTrabalhados=new Set(corridasMes.map(c=>c.data)).size;
  const diasPassados=Math.min(new Date().getDate(),new Date(+getMes0.split("-")[0],+getMes0.split("-")[1],0).getDate());
  const consistencia=Math.round((diasTrabalhados/diasPassados)*100);
  if(consistencia>=70){
    insights.push({tipo:"conquista",cor:"verde",icon:"🔥",texto:`Você trabalhou ${diasTrabalhados} dias este mês — ${consistencia}% de consistência! Motoristas consistentes ganham até 35% mais no longo prazo.`});
  }

  // 9. KM por litro
  const abast=data.abastecimentos.filter(a=>a.data.startsWith(getMes0));
  const totalLitros=abast.reduce((s,a)=>s+a.litros,0);
  const kmMes=corridasMes.reduce((s,c)=>s+c.km,0);
  if(totalLitros>0&&kmMes>0){
    const kml=kmMes/totalLitros;
    if(kml<8){
      insights.push({tipo:"atencao",cor:"amarelo",icon:"🔧",texto:`Seu consumo atual é de ${kml.toFixed(1)} km/litro. Uma revisão preventiva pode melhorar a eficiência e economizar no combustível.`});
    } else if(kml>=12){
      insights.push({tipo:"conquista",cor:"verde",icon:"🔧",texto:`Excelente! Seu carro está rendendo ${kml.toFixed(1)} km/litro — acima da média. Seu veículo está bem cuidado!`});
    }
  }

  return insights.slice(0,6);
}

// ══ AUTH ══
function AuthScreen({onLogin}){
  const[mode,setMode]=useState("welcome");
  const[email,setEmail]=useState("");const[senha,setSenha]=useState("");const[nome,setNome]=useState("");
  const[erro,setErro]=useState("");const[ok,setOk]=useState("");const[loading,setLoad]=useState(false);const[reset,setReset]=useState(false);

  async function handleLogin(){
    if(!email||!senha)return setErro("Preencha email e senha.");
    setLoad(true);setErro("");
    try{const data=await sbAuth("token?grant_type=password",{email,password:senha});localStorage.setItem(LOCAL_KEY,JSON.stringify({token:data.access_token,user:data.user}));onLogin(data.access_token,data.user);}
    catch(e){setErro("Email ou senha incorretos.");}
    setLoad(false);
  }
  const[showSenha,setShowSenha]=useState(false);
  const[showSenha2,setShowSenha2]=useState(false);
  const[aceite,setAceite]=useState(false);
  async function handleSignup(){
    if(!nome||!email||!senha)return setErro("Preencha todos os campos.");
    if(senha.length<6)return setErro("Senha mínimo 6 caracteres.");
    if(!aceite)return setErro("Você precisa aceitar os Termos de Uso e a Política de Privacidade.");
    setLoad(true);setErro("");
    try{await sbAuth("signup",{email,password:senha,data:{nome}});setOk("✅ Conta criada com sucesso! Enviamos um email de confirmação para "+email+". Confirme seu acesso e depois faça login aqui.");setMode("login");}
    catch(e){setErro(e.message);}
    setLoad(false);
  }
  async function handleReset(){
    if(!email)return setErro("Digite seu email primeiro.");
    setLoad(true);setErro("");
    try{await sbAuth("recover",{email});setOk("Link de recuperação enviado! Verifique seu email.");}
    catch(e){setErro("Erro ao enviar email.");}
    setLoad(false);
  }
  function startDemo(){if(!localStorage.getItem(DEMO_KEY))localStorage.setItem(DEMO_KEY,Date.now().toString());onLogin("DEMO",{id:"demo",email:"demo@app.com",user_metadata:{nome:"Motorista"}});}

  if(mode==="welcome")return(
    <div style={A.root}><div style={A.splash}>
      <div style={{fontSize:64,marginBottom:12}}>🚘</div>
      <div style={{fontSize:32,fontWeight:900,color:"#f8fafc",letterSpacing:-1,marginBottom:8}}>MotoristaApp</div>
      <div style={{fontSize:15,color:"#94a3b8",lineHeight:1.6,marginBottom:28,textAlign:"center"}}>Descubra seu lucro real.<br/>Bata suas metas. Dirija melhor.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,width:"100%",marginBottom:28}}>
        {["💰 Lucro real","🧠 Radar de insights","🏆 Ranking apps","📅 Histórico","🚗 Gestão do veículo","🎯 Simulador de metas"].map(f=>(
          <div key={f} style={{background:"#1e293b",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#cbd5e1",border:"1px solid #334155"}}>{f}</div>
        ))}
      </div>
      <button style={A.btnP} onClick={()=>setMode("signup")}>Criar conta — 15 dias grátis</button>
      <button style={A.btnS} onClick={()=>setMode("login")}>Já tenho conta — entrar</button>
      <button style={A.btnD} onClick={startDemo}>🎮 Experimentar {DEMO_DAYS} dias sem cadastro</button>
      <div style={{fontSize:12,color:"#475569",marginTop:8}}>15 dias grátis · Sem cartão</div>
    </div></div>
  );

  if(mode==="login")return(
    <div style={A.root}><div style={A.form}>
      <button style={A.back} onClick={()=>{setMode("welcome");setErro("");setOk("");}}>← Voltar</button>
      <div style={{fontSize:40,textAlign:"center",marginBottom:8}}>🚘</div>
      <div style={{fontSize:22,fontWeight:800,color:"#f8fafc",textAlign:"center",marginBottom:20}}>Entrar</div>
      {ok&&<div style={A.msgOk}>{ok}</div>}{erro&&<div style={A.msgErr}>{erro}</div>}
      <FR l="Email"><input style={A.inp} type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></FR>
      {!reset&&<FR l="Senha">
        <div style={{position:"relative"}}>
          <input style={{...A.inp,paddingRight:44}} type={showSenha?"text":"password"} placeholder="••••••" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
          <button onClick={()=>setShowSenha(!showSenha)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:16,padding:0}}>{showSenha?"🙈":"👁️"}</button>
        </div>
      </FR>}
      {!reset
        ?<><button style={{...A.btnP,opacity:loading?0.7:1}} onClick={handleLogin} disabled={loading}>{loading?"Entrando...":"Entrar"}</button><div style={{textAlign:"center",fontSize:13,color:"#64748b",cursor:"pointer",marginTop:10}} onClick={()=>{setReset(true);setErro("");}}>Esqueci minha senha</div></>
        :<><div style={{fontSize:13,color:"#94a3b8",marginBottom:12}}>Digite seu email acima e clique enviar.</div><button style={{...A.btnP,opacity:loading?0.7:1}} onClick={handleReset} disabled={loading}>{loading?"Enviando...":"Enviar link de recuperação"}</button><div style={{textAlign:"center",fontSize:13,color:"#64748b",cursor:"pointer",marginTop:10}} onClick={()=>{setReset(false);setErro("");}}>Voltar ao login</div></>
      }
      <div style={{textAlign:"center",fontSize:13,color:"#64748b",marginTop:14}}>Não tem conta? <span style={{color:"#3b82f6",cursor:"pointer",fontWeight:600}} onClick={()=>{setMode("signup");setErro("");}}>Criar agora</span></div>
    </div></div>
  );

  return(
    <div style={A.root}><div style={A.form}>
      <button style={A.back} onClick={()=>{setMode("welcome");setErro("");}}>← Voltar</button>
      <div style={{fontSize:40,textAlign:"center",marginBottom:8}}>🚘</div>
      <div style={{fontSize:22,fontWeight:800,color:"#f8fafc",textAlign:"center",marginBottom:20}}>Criar conta grátis</div>
      {erro&&<div style={A.msgErr}>{erro}</div>}
      <FR l="Seu nome"><input style={A.inp} placeholder="Ex: João Silva" value={nome} onChange={e=>setNome(e.target.value)}/></FR>
      <FR l="Email"><input style={A.inp} type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)}/></FR>
      <FR l="Senha">
        <div style={{position:"relative"}}>
          <input style={{...A.inp,paddingRight:44}} type={showSenha2?"text":"password"} placeholder="Mínimo 6 caracteres" value={senha} onChange={e=>setSenha(e.target.value)}/>
          <button onClick={()=>setShowSenha2(!showSenha2)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:16,padding:0}}>{showSenha2?"🙈":"👁️"}</button>
        </div>
      </FR>
      <div style={{display:"flex",alignItems:"flex-start",gap:10,background:"#1e293b",borderRadius:10,padding:"12px 14px",border:`1.5px solid ${aceite?"#22c55e44":"#334155"}`,marginBottom:14,cursor:"pointer"}} onClick={()=>setAceite(!aceite)}>
        <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${aceite?"#22c55e":"#475569"}`,background:aceite?"#22c55e":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
          {aceite&&<span style={{fontSize:11,color:"#000",fontWeight:900}}>✓</span>}
        </div>
        <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.6}}>Li e aceito os <a href="/termos-de-uso.html" target="_blank" style={{color:"#3b82f6"}}>Termos de Uso</a> e a <a href="/politica-privacidade.html" target="_blank" style={{color:"#3b82f6"}}>Política de Privacidade</a>, incluindo o tratamento dos meus dados conforme a LGPD.</div>
      </div>
      <button style={{...A.btnP,opacity:loading?0.7:1}} onClick={handleSignup} disabled={loading}>{loading?"Criando...":"Criar conta grátis"}</button>
      <div style={{textAlign:"center",fontSize:13,color:"#64748b",marginTop:14}}>Já tem conta? <span style={{color:"#3b82f6",cursor:"pointer",fontWeight:600}} onClick={()=>{setMode("login");setErro("");}}>Entrar</span></div>
    </div></div>
  );
}

// ══ ONBOARDING ══
function Onboarding({onComplete}){
  const[step,setStep]=useState(0);
  const[modelo,setModelo]=useState("");const[plats,setPlats]=useState(["Uber"]);const[meta,setMeta]=useState("3000");const[notif,setNotif]=useState(false);
  function togglePlat(p){setPlats(prev=>prev.includes(p)?prev.filter(x=>x!==p):[...prev,p]);}
  async function reqNotif(){if("Notification"in window){const p=await Notification.requestPermission();setNotif(p==="granted");}}
  function finish(){onComplete({modelo,plats,meta:parseFloat(meta)||3000,notif});}
  return(
    <div style={A.root}><div style={A.form}>
      <div style={{display:"flex",gap:6,marginBottom:28}}>{[0,1,2].map(i=><div key={i} style={{flex:1,height:4,borderRadius:99,background:i<=step?"#2563eb":"#334155"}}/>)}</div>
      {step===0&&<>
        <div style={{fontSize:48,textAlign:"center",marginBottom:12}}>🚗</div>
        <div style={{fontSize:20,fontWeight:800,color:"#f8fafc",textAlign:"center",marginBottom:6}}>Qual é o seu carro?</div>
        <div style={{fontSize:13,color:"#94a3b8",textAlign:"center",lineHeight:1.6,marginBottom:20}}>Isso ajuda a calcular seu custo por km com mais precisão.</div>
        <FR l="Modelo e ano"><input style={A.inp} placeholder="Ex: HB20 2021, Onix 2019" value={modelo} onChange={e=>setModelo(e.target.value)}/></FR>
        <button style={A.btnP} onClick={()=>setStep(1)}>Continuar →</button>
        <button style={{background:"none",border:"none",color:"#475569",fontSize:13,cursor:"pointer",textAlign:"center",padding:"8px",width:"100%"}} onClick={()=>setStep(1)}>Pular</button>
      </>}
      {step===1&&<>
        <div style={{fontSize:48,textAlign:"center",marginBottom:12}}>📱</div>
        <div style={{fontSize:20,fontWeight:800,color:"#f8fafc",textAlign:"center",marginBottom:6}}>Quais apps você usa?</div>
        <div style={{fontSize:13,color:"#94a3b8",textAlign:"center",lineHeight:1.6,marginBottom:20}}>Selecione todos que você trabalha.</div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
          {["Uber","99","InDriver","Cabify"].map(p=>(
            <div key={p} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#1e293b",border:`1.5px solid ${plats.includes(p)?"#2563eb":"#334155"}`,borderRadius:12,padding:"14px 16px",cursor:"pointer"}} onClick={()=>togglePlat(p)}>
              <span style={{fontSize:14,fontWeight:700}}>{p}</span>
              <span style={{fontSize:18}}>{plats.includes(p)?"✅":"○"}</span>
            </div>
          ))}
        </div>
        <button style={A.btnP} onClick={()=>setStep(2)}>Continuar →</button>
      </>}
      {step===2&&<>
        <div style={{fontSize:48,textAlign:"center",marginBottom:12}}>🎯</div>
        <div style={{fontSize:20,fontWeight:800,color:"#f8fafc",textAlign:"center",marginBottom:6}}>Qual sua meta mensal?</div>
        <div style={{fontSize:13,color:"#94a3b8",textAlign:"center",lineHeight:1.6,marginBottom:20}}>Quanto quer lucrar por mês após todos os custos?</div>
        <FR l="Meta de lucro líquido (R$)"><input style={A.inp} type="number" placeholder="Ex: 3000" value={meta} onChange={e=>setMeta(e.target.value)}/></FR>
        <div style={{background:"#1e293b",borderRadius:12,padding:14,marginBottom:16,border:"1px solid #334155"}}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:6,fontWeight:700,textTransform:"uppercase"}}>🔔 Notificações de meta</div>
          <div style={{fontSize:13,color:"#94a3b8",marginBottom:12,lineHeight:1.6}}>Receba avisos quando estiver perto de bater sua meta!</div>
          <button style={{...A.btnP,padding:"11px",fontSize:13,background:notif?"linear-gradient(135deg,#065f46,#064e3b)":"linear-gradient(135deg,#2563eb,#1d4ed8)"}} onClick={reqNotif}>{notif?"✅ Notificações ativadas!":"🔔 Ativar notificações"}</button>
        </div>
        <button style={A.btnP} onClick={finish}>Começar a usar! 🚀</button>
      </>}
    </div></div>
  );
}

// ══ BLOQUEIO ══
function BloqueioScreen({onLogout,tipo}){
  
  const isDemo=tipo==="demo";
  const linkMensal="https://app.cakto.com.br/SEU_LINK_MENSAL";
  const linkAnual="https://app.cakto.com.br/SEU_LINK_ANUAL";
  return(
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#060d1a",minHeight:"100vh",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column",color:"#f1f5f9"}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#0f1f3d,#1e293b)",padding:"20px 24px",borderBottom:"1px solid #1e3a5f",textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:4}}>🚘</div>
        <div style={{fontFamily:"'Segoe UI',sans-serif",fontSize:18,fontWeight:900,color:"#f8fafc"}}>MotoristaApp</div>
      </div>

      <div style={{flex:1,padding:"24px 20px",overflowY:"auto"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:40,marginBottom:12}}>{isDemo?"🎮":"⏰"}</div>
          <div style={{fontSize:20,fontWeight:800,color:"#f8fafc",marginBottom:8,lineHeight:1.2}}>
            {isDemo?"Seu período demo encerrou":"Seu período gratuito encerrou"}
          </div>
          <div style={{fontSize:14,color:"#64748b",lineHeight:1.7}}>
            {isDemo?"Crie sua conta e ganhe 15 dias completos grátis para continuar controlando seus ganhos.":"Seus 15 dias gratuitos terminaram. Continue com acesso completo por menos de R$1 por dia."}
          </div>
        </div>

        {/* Toggle planos */}
        {!isDemo&&<>
          <div style={{background:"#0f172a",borderRadius:12,padding:4,display:"flex",marginBottom:20,border:"1px solid #1e293b"}}>
            <button style={{flex:1,padding:"10px",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:plano==="mensal"?"linear-gradient(135deg,#1e3a8a,#1e40af)":"none",color:plano==="mensal"?"#fff":"#64748b",transition:"all 0.2s"}} onClick={()=>setPlano("mensal")}>Mensal</button>
            <button style={{flex:1,padding:"10px",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:plano==="anual"?"linear-gradient(135deg,#065f46,#064e3b)":"none",color:plano==="anual"?"#fff":"#64748b",position:"relative",transition:"all 0.2s"}} onClick={()=>setPlano("anual")}>
              Anual
              <span style={{position:"absolute",top:-8,right:4,background:"#f59e0b",color:"#000",fontSize:9,fontWeight:900,padding:"2px 6px",borderRadius:99}}>-23%</span>
            </button>
          </div>

          {/* Card do plano */}
          {plano==="mensal"&&(
            <div style={{background:"linear-gradient(135deg,#064e3b,#065f46)",borderRadius:20,padding:"24px 20px",marginBottom:16,border:"1px solid #3b82f644",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,background:"radial-gradient(circle,#3b82f622,transparent)"}}/>
              <div style={{fontSize:12,color:"#6ee7b7",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Plano Mensal</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:4}}>
                <span style={{fontSize:40,fontWeight:900,color:"#fff"}}>R$12,90</span>
                <span style={{fontSize:14,color:"#6ee7b7"}}>/mês</span>
              </div>
              <div style={{fontSize:12,color:"#bfdbfe",marginBottom:16}}>Cobrado mensalmente · Cancele quando quiser</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {["Acesso completo a todas as funcionalidades","Radar de insights inteligentes","Dados salvos na nuvem","Suporte por email","Cancele quando quiser, sem multa"].map(f=>(
                  <div key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#bfdbfe"}}>
                    <span style={{color:"#34d399",fontWeight:700,flexShrink:0}}>✓</span>{f}
                  </div>
                ))}
              </div>
            </div>
          )}

          {plano==="anual"&&(
            <div style={{background:"linear-gradient(135deg,#064e3b,#065f46)",borderRadius:20,padding:"24px 20px",marginBottom:16,border:"1px solid #34d39944",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,background:"radial-gradient(circle,#34d39918,transparent)"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:12,color:"#6ee7b7",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Plano Anual</div>
                <div style={{background:"#f59e0b",color:"#000",fontSize:10,fontWeight:900,padding:"3px 10px",borderRadius:99}}>MELHOR VALOR</div>
              </div>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:2}}>
                <span style={{fontSize:40,fontWeight:900,color:"#fff"}}>R$119,90</span>
                <span style={{fontSize:14,color:"#6ee7b7"}}>/ano</span>
              </div>
              <div style={{fontSize:13,color:"#34d399",fontWeight:600,marginBottom:4}}>= R$9,99/mês — você economiza R$34,90</div>
              <div style={{fontSize:12,color:"#6ee7b7",marginBottom:16}}>Cobrado uma vez por ano · Cancele quando quiser</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {["Tudo do plano mensal incluído","2 meses grátis comparado ao mensal","Prioridade no suporte","Acesso a novas funcionalidades primeiro","Cancele quando quiser, sem multa"].map(f=>(
                  <div key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"#6ee7b7"}}>
                    <span style={{color:"#34d399",fontWeight:700,flexShrink:0}}>✓</span>{f}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button style={{width:"100%",background:plano==="anual"?"linear-gradient(135deg,#34d399,#10b981)":"linear-gradient(135deg,#2563eb,#1d4ed8)",border:"none",borderRadius:14,padding:"16px",color:plano==="anual"?"#042f2e":"#fff",fontSize:16,fontWeight:800,cursor:"pointer",marginBottom:8,boxShadow:plano==="anual"?"0 4px 20px #34d39933":"0 4px 20px #2563eb33"}}
            onClick={()=>window.open(plano==="anual"?linkAnual:linkMensal,"_blank")}>
            {plano==="anual"?"🚀 Assinar por R$119,90/ano":"🚀 Assinar por R$12,90/mês"}
          </button>
          <div style={{textAlign:"center",fontSize:12,color:"#475569",marginBottom:20}}>
            🔒 Pagamento seguro · Cancele quando quiser · Sem fidelidade
          </div>
        </>}

        {isDemo&&(
          <button style={{width:"100%",background:"linear-gradient(135deg,#065f46,#047857)",border:"none",borderRadius:14,padding:"16px",color:"#fff",fontSize:16,fontWeight:800,cursor:"pointer",marginBottom:8,boxShadow:"0 4px 20px #2563eb33"}}
            onClick={()=>window.open("/","_self")}>
            🚀 Criar conta — 15 dias grátis
          </button>
        )}

        <button style={{width:"100%",background:"none",border:"none",color:"#334155",fontSize:13,cursor:"pointer",padding:"8px"}} onClick={onLogout}>
          Usar outra conta
        </button>
      </div>
    </div>
  );
}

// ══ APP PRINCIPAL ══
export default function MotoristaApp(){
  const[token,setToken]=useState(null);const[user,setUser]=useState(null);
  const[appData,setAppData]=useState(null);const[assinatura,setAss]=useState(null);
  const[tab,setTab]=useState(0);const[saved,setSaved]=useState(false);
  const[mesSel,setMesSel]=useState(getMes(0));const[diaAberto,setDiaAberto]=useState(null);
  const[showOnboarding,setShowOnboarding]=useState(false);
  const[online,setOnline]=useState(navigator.onLine);
  const[showAvancado,setShowAvancado]=useState(false);
  const[cookieOk,setCookieOk]=useState(()=>!!localStorage.getItem("cookie_consent"));
  const DEMO=token==="DEMO";

  const[fC,setFC]=useState({data:today(),plataforma:"Uber",ganho:"",km:"",horas:"",numCorridas:"",turno:"",combustivel:""});
  const[fA,setFA]=useState({data:today(),litros:"",valor:"",kmOdometro:""});
  const[fD,setFD]=useState({nome:"",valor:"",mes:getMes(0)});
  const[fM,setFM]=useState({data:today(),tipo:"",descricao:"",valor:"",km:""});
  const[cfgForm,setCfgForm]=useState(null);const[platForms,setPlatForms]=useState(null);const[novaPlat,setNovaPlat]=useState({nome:"",comissao:""});

  useEffect(()=>{
    const goOn=()=>setOnline(true);const goOff=()=>setOnline(false);
    window.addEventListener("online",goOn);window.addEventListener("offline",goOff);
    return()=>{window.removeEventListener("online",goOn);window.removeEventListener("offline",goOff);};
  },[]);

  useEffect(()=>{
    try{const s=localStorage.getItem(LOCAL_KEY);if(s){const{token:t,user:u}=JSON.parse(s);if(t&&u){setToken(t);setUser(u);}}}catch{}
  },[]);

  useEffect(()=>{
    if(!token||!user)return;
    if(DEMO){try{const r=localStorage.getItem("moto_demo");setAppData(r?JSON.parse(r):defaultData());}catch{setAppData(defaultData());}setAss({status:"demo"});if(!localStorage.getItem("moto_onboarded"))setShowOnboarding(true);return;}
    loadSupabase();loadAss();
  },[token]);

  async function loadSupabase(){
    try{
      // Tenta com user.id (UUID)
      const r=await sbFetch(`/motorista_dados?user_id=eq.${user.id}&select=dados`,{_token:token});
      if(r&&r.length>0){
        setAppData(JSON.parse(r[0].dados));
        if(!localStorage.getItem("moto_onboarded"))setShowOnboarding(true);
      } else {
        // Tenta com email como fallback
        const r2=await sbFetch(`/motorista_dados?user_id=eq.${encodeURIComponent(user.email)}&select=dados`,{_token:token});
        if(r2&&r2.length>0){setAppData(JSON.parse(r2[0].dados));if(!localStorage.getItem("moto_onboarded"))setShowOnboarding(true);}
        else{setAppData(defaultData());setShowOnboarding(true);}
      }
    } catch(e){
      console.error("loadSupabase error:",e);
      // Tenta carregar do cache offline
      try{const cache=localStorage.getItem("moto_offline_cache");if(cache){setAppData(JSON.parse(cache));return;}}catch{}
      setAppData(defaultData());setShowOnboarding(true);
    }
  }
  async function loadAss(){
    try{const r=await sbFetch(`/assinaturas?email=eq.${encodeURIComponent(user.email)}&select=status,trial_end,assinatura_end`,{_token:token});
    if(r&&r.length>0)setAss(r[0]);
    else{await sbFetch("/assinaturas",{method:"POST",_token:token,body:JSON.stringify({email:user.email,user_id:user.id,status:"trial",trial_end:new Date(Date.now()+15*864e5).toISOString()})});setAss({status:"trial",trial_end:new Date(Date.now()+15*864e5).toISOString()});}}
    catch{setAss({status:"trial",trial_end:new Date(Date.now()+15*864e5).toISOString()});}
  }

  function getAcesso(){
    if(!assinatura)return{ok:false,daysLeft:0,status:"carregando"};
    if(assinatura.status==="demo"){const s=parseInt(localStorage.getItem(DEMO_KEY)||Date.now());const dl=Math.max(DEMO_DAYS-Math.floor((Date.now()-s)/864e5),0);return{ok:dl>0,daysLeft:dl,status:"demo"};}
    if(assinatura.status==="active"){const dl=Math.max(Math.ceil((new Date(assinatura.assinatura_end)-Date.now())/864e5),0);return{ok:dl>0,daysLeft:dl,status:"active"};}
    if(assinatura.status==="trial"){const dl=Math.max(Math.ceil((new Date(assinatura.trial_end)-Date.now())/864e5),0);return{ok:dl>0,daysLeft:dl,status:"trial"};}
    return{ok:false,daysLeft:0,status:assinatura.status};
  }

  async function saveData(nd){
    setAppData(nd);
    if(DEMO){localStorage.setItem("moto_demo",JSON.stringify(nd));return;}
    // Salva sempre no cache local primeiro
    localStorage.setItem("moto_offline_cache",JSON.stringify(nd));
    if(!online){return;}
    try{
      // Usa o UUID do usuário como user_id
      await sbFetch("/motorista_dados",{
        method:"POST",
        _token:token,
        headers:{Prefer:"resolution=merge-duplicates"},
        body:JSON.stringify({user_id:user.id,dados:JSON.stringify(nd)})
      });
    } catch(e){
      console.error("saveData error:",e);
      // Tenta com email como fallback
      try{
        await sbFetch("/motorista_dados",{
          method:"POST",
          _token:token,
          headers:{Prefer:"resolution=merge-duplicates"},
          body:JSON.stringify({user_id:user.email,dados:JSON.stringify(nd)})
        });
      } catch(e2){console.error("saveData fallback error:",e2);}
    }
  }

  function flash(){setSaved(true);setTimeout(()=>setSaved(false),2000);}
  function logout(){localStorage.removeItem(LOCAL_KEY);setToken(null);setUser(null);setAppData(null);setAss(null);}

  function handleOnboarding({modelo,plats,meta,notif}){
    const pl=DEFAULT_PLATAFORMAS.filter(p=>plats.includes(p.nome));
    const nd={...defaultData(),plataformas:pl,config:{...DEFAULT_CONFIG,metaMensal:meta,modeloCarro:modelo,notificacoesAtivas:notif}};
    saveData(nd);localStorage.setItem("moto_onboarded","1");setShowOnboarding(false);
  }

  if(!token||!user)return(
    <>
      <AuthScreen onLogin={(t,u)=>{setToken(t);setUser(u);}}/>
      {!cookieOk&&<CookieBanner onAccept={()=>{localStorage.setItem("cookie_consent","1");setCookieOk(true);}}/>}
    </>
  );;
  if(DEMO){const s=parseInt(localStorage.getItem(DEMO_KEY)||Date.now());if(Math.floor((Date.now()-s)/864e5)>=DEMO_DAYS&&appData)return<BloqueioScreen onLogout={logout} tipo="demo"/>;}
  if(!appData||!assinatura)return<div style={{background:"#0f172a",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}><div style={{fontSize:40}}>🚘</div><div style={{color:"#94a3b8",fontSize:14}}>Carregando...</div></div>;
  if(showOnboarding)return<Onboarding onComplete={handleOnboarding}/>;
  const acesso=getAcesso();
  if(!acesso.ok&&!DEMO)return<BloqueioScreen onLogout={logout} tipo={acesso.status}/>;

  const d=appData;
  function getComissao(nome){return(d.plataformas.find(p=>p.nome===nome)||{comissao:25}).comissao;}
  function calcLucro(c){return c.ganho-c.ganho*getComissao(c.plataforma)/100-c.km*d.config.custoPorKm-(c.combustivel||0);}

  const corridasMes=d.corridas.filter(c=>c.data.startsWith(mesSel));
  const despMes=d.despesasFixas.filter(x=>x.mes===mesSel);
  const abastMes=d.abastecimentos.filter(a=>a.data.startsWith(mesSel));
  const manutMes=d.manutencoes?d.manutencoes.filter(m=>m.data.startsWith(mesSel)):[];
  const ganhoMes=corridasMes.reduce((s,c)=>s+c.ganho,0);
  const lucroMes=corridasMes.reduce((s,c)=>s+calcLucro(c),0);
  const kmMes=corridasMes.reduce((s,c)=>s+c.km,0);
  const horasMes=corridasMes.reduce((s,c)=>s+(c.horas||0),0);
  const totalDesp=despMes.reduce((s,x)=>s+x.valor,0);
  const totalManut=manutMes.reduce((s,m)=>s+m.valor,0);
  const totalAbast=abastMes.reduce((s,a)=>s+a.valor,0);
  const totalLitros=abastMes.reduce((s,a)=>s+a.litros,0);
  const kmPorLitro=totalLitros>0?kmMes/totalLitros:0;
  const lucroLiq=lucroMes-totalDesp-totalManut;
  const progMeta=Math.min((lucroLiq/d.config.metaMensal)*100,100);
  const diasNoMes=new Date(+mesSel.split("-")[0],+mesSel.split("-")[1],0).getDate();
  const diaAtual=mesSel===getMes(0)?new Date().getDate():diasNoMes;
  const diasRest=Math.max(diasNoMes-diaAtual,0);
  const faltaMeta=Math.max(d.config.metaMensal-lucroLiq,0);
  const porDia=diasRest>0?faltaMeta/diasRest:0;

  const rankPlat={};
  corridasMes.forEach(c=>{if(!rankPlat[c.plataforma])rankPlat[c.plataforma]={ganho:0,lucro:0,km:0,horas:0};rankPlat[c.plataforma].ganho+=c.ganho;rankPlat[c.plataforma].lucro+=calcLucro(c);rankPlat[c.plataforma].km+=c.km;rankPlat[c.plataforma].horas+=c.horas||0;});
  const rankSorted=Object.entries(rankPlat).sort((a,b)=>b[1].lucro-a[1].lucro);
  const diasUnicos=[...new Set(corridasMes.map(c=>c.data))].sort((a,b)=>b.localeCompare(a));

  const comAtual=getComissao(fC.plataforma);
  const pg=parseFloat(fC.ganho)||0,pk=parseFloat(fC.km)||0,pc=parseFloat(fC.combustivel)||0;
  const prevLucro=pg-pg*comAtual/100-pk*d.config.custoPorKm-pc;

  function addCorrida(){if(!fC.ganho||!fC.km)return;const nd={...d,corridas:[{id:Date.now(),data:fC.data,plataforma:fC.plataforma,ganho:parseFloat(fC.ganho),km:parseFloat(fC.km),combustivel:parseFloat(fC.combustivel)||0,horas:parseFloat(fC.horas)||0,numCorridas:parseInt(fC.numCorridas)||1,turno:fC.turno},...d.corridas]};saveData(nd);setFC(f=>({...f,ganho:"",km:"",horas:"",numCorridas:"",turno:"",combustivel:""}));flash();}
  function addAbast(){if(!fA.litros||!fA.valor)return;const nd={...d,abastecimentos:[{id:Date.now(),data:fA.data,litros:parseFloat(fA.litros),valor:parseFloat(fA.valor),kmOdometro:parseFloat(fA.kmOdometro)||0},...d.abastecimentos]};saveData(nd);setFA({data:today(),litros:"",valor:"",kmOdometro:""});flash();}
  function addDesp(){if(!fD.nome||!fD.valor)return;const nd={...d,despesasFixas:[{id:Date.now(),nome:fD.nome,valor:parseFloat(fD.valor),mes:fD.mes},...d.despesasFixas]};saveData(nd);setFD({nome:"",valor:"",mes:getMes(0)});flash();}
  function addManut(){if(!fM.tipo||!fM.valor)return;const nd={...d,manutencoes:[{id:Date.now(),data:fM.data,tipo:fM.tipo,descricao:fM.descricao,valor:parseFloat(fM.valor),km:parseFloat(fM.km)||0},...(d.manutencoes||[])]};saveData(nd);setFM({data:today(),tipo:"",descricao:"",valor:"",km:""});flash();}
  function del(tipo,id){saveData({...d,[tipo]:d[tipo].filter(x=>x.id!==id)});}
  function delManut(id){saveData({...d,manutencoes:(d.manutencoes||[]).filter(x=>x.id!==id)});}
  function saveCfg(){saveData({...d,plataformas:platForms||d.plataformas,config:cfgForm||d.config});setPlatForms(null);setCfgForm(null);flash();}
  function navMes(dir){const d2=new Date(mesSel+"-01");d2.setMonth(d2.getMonth()+dir);const n=d2.toISOString().slice(0,7);if(n<=getMes(0))setMesSel(n);}

  const platsEx=platForms||d.plataformas;const cfgEx=cfgForm||d.config;const hasChanges=platForms!==null||cfgForm!==null;
  const nomeUser=user?.user_metadata?.nome||user?.email?.split("@")[0]||"Motorista";
  const insights=gerarInsights(d,corridasMes,lucroLiq,faltaMeta,porDia,diasRest);

  const corMap={verde:{bg:"#064e3b",border:"#22c55e44",text:"#4ade80"},azul:{bg:"#1e3a5f",border:"#3b82f644",text:"#60a5fa"},amarelo:{bg:"#78350f",border:"#f59e0b44",text:"#fbbf24"},vermelho:{bg:"#7f1d1d",border:"#ef444444",text:"#f87171"}};

  return(
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.hInner}>
          <div style={S.logo}><span style={{fontSize:22}}>🚘</span><div><div style={S.logoT}>MotoristaApp</div><div style={S.logoS}>Olá, {nomeUser}! {DEMO&&<span style={{background:"#f59e0b",color:"#000",fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:99}}>DEMO</span>}</div></div></div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {!online&&<div style={{background:"#334155",color:"#94a3b8",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99}}>📶 Offline</div>}
            {saved&&<div style={{background:"#22c55e",color:"#fff",fontSize:11,padding:"3px 8px",borderRadius:20,fontWeight:700}}>✓</div>}
            <button style={S.logoutBtn} onClick={logout}>Sair</button>
          </div>
        </div>
      </div>

      {acesso.status==="demo"&&acesso.daysLeft<=1&&<div style={{background:"linear-gradient(90deg,#7f1d1d,#991b1b)",padding:"8px 16px",fontSize:12,color:"#fca5a5",textAlign:"center",fontWeight:600}}>⚠️ Último dia do demo! <span style={{textDecoration:"underline",cursor:"pointer"}} onClick={()=>window.open("/","_self")}>Criar conta grátis</span></div>}
      {acesso.status==="trial"&&acesso.daysLeft<=5&&<div style={{background:"linear-gradient(90deg,#92400e,#78350f)",padding:"8px 16px",fontSize:12,color:"#fcd34d",textAlign:"center",fontWeight:600}}>⚠️ Teste termina em {acesso.daysLeft} dia{acesso.daysLeft!==1?"s":""} · <span style={{textDecoration:"underline",cursor:"pointer"}} onClick={()=>window.open("https://app.cakto.com.br/SEU_LINK_MENSAL","_blank")}>Assinar por R$12,90/mês</span></div>}
      {acesso.status==="trial"&&acesso.daysLeft>5&&<div style={{background:"#1e293b",padding:"5px 16px",fontSize:11,color:"#64748b",textAlign:"center",borderBottom:"1px solid #334155"}}>🎁 {acesso.daysLeft} dias de teste restantes · Assine por R$12,90/mês</div>}

      <div style={S.content}>

        {/* ══ DASHBOARD ══ */}
        {tab===0&&<div style={S.page}>
          <div style={S.mesSel}>
            <button style={S.mesBtn} onClick={()=>navMes(-1)}>‹</button>
            <span style={S.mesNome}>{nomeMes(mesSel)}</span>
            <button style={S.mesBtn} onClick={()=>navMes(1)} disabled={mesSel>=getMes(0)}>›</button>
          </div>
          <div style={S.sec}>Resultados</div>
          <div style={S.row2}><Card label="Ganho Bruto" value={fmt(ganhoMes)} grad={S.cGreen}/><Card label="Lucro Operacional" value={fmt(lucroMes)} grad={S.cBlue}/></div>
          <div style={S.row2}><Card label="Despesas Fixas" value={fmt(totalDesp+totalManut)} grad={S.cRed}/><Card label="Lucro Líquido" value={fmt(lucroLiq)} grad={S.cPurple}/></div>
          {horasMes>0&&<div style={S.row2}><Card label="Horas" value={`${horasMes.toFixed(1)}h`} grad={S.cSlate}/><Card label="Lucro/hora" value={fmt(lucroMes/horasMes)} grad={S.cTeal}/></div>}
          <div style={{...S.card,...S.cFull}}><div style={S.cardLbl}>KM rodados</div><div style={S.cardVal}>{kmMes.toFixed(0)} km</div></div>
          <div style={S.metaCard}>
            <div style={S.metaTop}><span style={S.metaLbl}>Meta mensal</span><span style={S.metaVals}>{fmt(lucroLiq)} / {fmt(d.config.metaMensal)}</span></div>
            <div style={S.progBg}><div style={{...S.progBar,width:`${progMeta}%`,background:progMeta>=100?"#22c55e":progMeta>=60?"#f59e0b":"#3b82f6"}}/></div>
            <div style={S.metaInfo}>{progMeta.toFixed(0)}% · falta {fmt(faltaMeta)} · {fmt(porDia)}/dia</div>
          </div>
          {rankSorted.length>0&&<><div style={S.sec}>🏆 Ranking</div>{rankSorted.map(([nome,v],i)=>(<div key={nome} style={S.rankRow}><div style={S.rankLeft}><span style={S.rankPos}>{i+1}º</span><div><div style={S.rankNome}>{nome}</div><div style={S.rankSub}>{v.km}km{v.horas>0?` · ${fmt(v.lucro/v.horas)}/h`:` · ${getComissao(nome)}%`}</div></div></div><div style={S.rankRight}><div style={S.rankLucro}>{fmt(v.lucro)}</div><div style={S.rankBruto}>{fmt(v.ganho)} bruto</div></div></div>))}</>}
          {corridasMes.length===0&&<div style={S.empty}>Nenhum registro em {nomeMes(mesSel)}.<br/>Lance seu primeiro dia! 🚗</div>}
        </div>}

        {/* ══ LANÇAR ══ */}
        {tab===1&&<div style={S.page}>
          <div style={S.sec}>Lançar dia de trabalho</div>
          <div style={S.formCard}>
            <FR l="Data"><input style={S.inp} type="date" value={fC.data} onChange={e=>setFC(f=>({...f,data:e.target.value}))}/></FR>
            <FR l="Plataforma"><select style={S.inp} value={fC.plataforma} onChange={e=>setFC(f=>({...f,plataforma:e.target.value}))}>{d.plataformas.map(p=><option key={p.nome}>{p.nome}</option>)}</select><div style={S.comBadge}>Comissão: <b>{comAtual}%</b></div></FR>
            <FR l="Ganho bruto (R$) *"><input style={S.inp} type="number" placeholder="Ex: 180.00" value={fC.ganho} onChange={e=>setFC(f=>({...f,ganho:e.target.value}))}/></FR>
            <FR l="KM rodados *"><input style={S.inp} type="number" placeholder="Ex: 120" value={fC.km} onChange={e=>setFC(f=>({...f,km:e.target.value}))}/></FR>
            <FR l="Horas trabalhadas"><input style={S.inp} type="number" placeholder="Ex: 8.5" step="0.5" value={fC.horas} onChange={e=>setFC(f=>({...f,horas:e.target.value}))}/></FR>
            <FR l="Nº de corridas"><input style={S.inp} type="number" placeholder="Ex: 12" value={fC.numCorridas} onChange={e=>setFC(f=>({...f,numCorridas:e.target.value}))}/></FR>
            <FR l="Turno (opcional)">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {TURNOS.map(t=>(
                  <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:fC.turno===t.id?"#1e3a5f":"#0f172a",border:`1.5px solid ${fC.turno===t.id?"#2563eb":"#334155"}`,borderRadius:9,padding:"9px 6px",cursor:"pointer",fontSize:12,fontWeight:600,color:fC.turno===t.id?"#60a5fa":"#64748b"}} onClick={()=>setFC(f=>({...f,turno:f.turno===t.id?"":t.id}))}>
                    <span>{t.icon}</span><span>{t.label}</span>
                  </div>
                ))}
              </div>
            </FR>
            <FR l="Combustível extra (R$)"><input style={S.inp} type="number" placeholder="Opcional" value={fC.combustivel} onChange={e=>setFC(f=>({...f,combustivel:e.target.value}))}/></FR>
            {pg>0&&pk>0&&<div style={S.preview}>
              <div style={S.prevT}>Prévia do lucro real</div>
              <PR l="Ganho bruto" v={fmt(pg)}/><PR l={`— Comissão ${fC.plataforma} (${comAtual}%)`} v={`- ${fmt(pg*comAtual/100)}`} red/><PR l={`— Custo km (${pk}km)`} v={`- ${fmt(pk*d.config.custoPorKm)}`} red/>
              {pc>0&&<PR l="— Combustível" v={`- ${fmt(pc)}`} red/>}<div style={S.divider}/><PR l="= Lucro real" v={fmt(prevLucro)} total green={prevLucro>0}/>
              {parseFloat(fC.horas)>0&&<PR l="Lucro/hora" v={fmt(prevLucro/parseFloat(fC.horas))}/>}
            </div>}
            <button style={S.btn} onClick={addCorrida}>＋ Lançar dia</button>
          </div>
          <div style={S.sec}>Histórico por dia</div>
          {diasUnicos.length===0&&<div style={S.empty}>Nenhum lançamento ainda.</div>}
          {diasUnicos.map(dia=>{
            const cs=corridasMes.filter(c=>c.data===dia);
            const gD=cs.reduce((s,c)=>s+c.ganho,0),lD=cs.reduce((s,c)=>s+calcLucro(c),0);
            const ab=diaAberto===dia;
            return(<div key={dia} style={S.diaCard}>
              <div style={S.diaHeader} onClick={()=>setDiaAberto(ab?null:dia)}>
                <div><div style={S.diaNome}>{new Date(dia+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short",day:"numeric",month:"short"})}</div><div style={S.diaSub}>{cs.length} lançamento{cs.length>1?"s":""}</div></div>
                <div style={S.diaRight}><div style={S.diaLucro}>{fmt(lD)}</div><div style={S.diaBruto}>{fmt(gD)} bruto</div></div>
                <span style={S.diaChev}>{ab?"▲":"▼"}</span>
              </div>
              {ab&&cs.map(c=>(<div key={c.id} style={S.lancRow}>
                <div style={S.lancInfo}>
                  <span style={S.lancPlat}>{c.plataforma}</span>
                  {c.turno&&<span style={{background:"#1d4ed820",color:"#6ee7b7",fontSize:10,padding:"2px 6px",borderRadius:99}}>{TURNOS.find(t=>t.id===c.turno)?.icon} {TURNOS.find(t=>t.id===c.turno)?.label}</span>}
                  {c.horas>0&&<span style={{background:"#22c55e20",color:"#4ade80",fontSize:10,padding:"2px 6px",borderRadius:99}}>{c.horas}h</span>}
                </div>
                <div style={S.lancVals}><span style={S.lancLucro}>{fmt(calcLucro(c))}</span><span style={S.lancBruto}>{fmt(c.ganho)}</span><span style={S.lancKm}>{c.km}km</span><button style={S.delBtn} onClick={()=>del("corridas",c.id)}>✕</button></div>
              </div>))}
            </div>);
          })}
        </div>}

        {/* ══ RADAR ══ */}
        {tab===2&&<div style={S.page}>
          <div style={{background:"linear-gradient(135deg,#1e3a5f,#0f172a)",borderRadius:14,padding:"16px 14px",marginBottom:14,border:"1px solid #34d39944"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#34d399",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>🧠 Radar Inteligente</div>
            <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.6}}>Análise automática do seu desempenho. Atualiza conforme você lança novos dias.</div>
          </div>
          {insights.map((ins,i)=>{
            const c=corMap[ins.cor]||corMap.azul;
            return(<div key={i} style={{background:c.bg,border:`1px solid ${c.border}`,borderRadius:14,padding:"16px 14px",marginBottom:10}}>
              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{fontSize:24,flexShrink:0}}>{ins.icon}</div>
                <div style={{fontSize:13,color:c.text,lineHeight:1.7,fontWeight:500}}>{ins.texto}</div>
              </div>
            </div>);
          })}
          {corridasMes.length<3&&<div style={{background:"#1e293b",borderRadius:12,padding:16,border:"1px solid #334155",textAlign:"center"}}>
            <div style={{fontSize:24,marginBottom:8}}>📊</div>
            <div style={{fontSize:13,color:"#64748b",lineHeight:1.6}}>Lance pelo menos 3 dias de trabalho para o Radar gerar análises completas sobre seu desempenho!</div>
          </div>}
        </div>}

        {/* ══ VEÍCULO ══ */}
        {tab===3&&<div style={S.page}>
          {d.config.modeloCarro&&<div style={{background:"linear-gradient(135deg,#1e3a5f,#0f172a)",borderRadius:14,padding:"14px 16px",marginBottom:12,border:"1px solid #334155",display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:32}}>🚗</div>
            <div><div style={{fontSize:16,fontWeight:800,color:"#f8fafc"}}>{d.config.modeloCarro}</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>Seu veículo cadastrado</div></div>
          </div>}

          {/* resumo custos */}
          <div style={S.sec}>Custos do veículo este mês</div>
          <div style={S.row3}>
            <MC label="Combustível" value={fmt(totalAbast)}/>
            <MC label="Manutenção" value={fmt(totalManut)}/>
            <MC label="Km/litro" value={kmPorLitro>0?`${kmPorLitro.toFixed(1)}`:"—"}/>
          </div>
          <div style={{...S.card,...S.cFull,marginBottom:10}}><div style={S.cardLbl}>Custo total do veículo este mês</div><div style={S.cardVal}>{fmt(totalAbast+totalManut)}</div></div>

          {/* abastecimento */}
          <div style={S.sec}>Abastecimento</div>
          <div style={S.formCard}>
            <FR l="Data"><input style={S.inp} type="date" value={fA.data} onChange={e=>setFA(f=>({...f,data:e.target.value}))}/></FR>
            <FR l="Litros"><input style={S.inp} type="number" step="0.01" placeholder="Ex: 30.5" value={fA.litros} onChange={e=>setFA(f=>({...f,litros:e.target.value}))}/></FR>
            <FR l="Valor (R$)"><input style={S.inp} type="number" placeholder="Ex: 180.00" value={fA.valor} onChange={e=>setFA(f=>({...f,valor:e.target.value}))}/></FR>
            <FR l="KM odômetro"><input style={S.inp} type="number" placeholder="Ex: 45820" value={fA.kmOdometro} onChange={e=>setFA(f=>({...f,kmOdometro:e.target.value}))}/></FR>
            <button style={S.btn} onClick={addAbast}>＋ Registrar abastecimento</button>
          </div>
          {abastMes.length>0&&abastMes.map(a=>(<div key={a.id} style={S.despRow}><div><div style={S.despNome}>{new Date(a.data+"T12:00:00").toLocaleDateString("pt-BR",{day:"numeric",month:"short"})}</div><div style={{fontSize:12,color:"#64748b"}}>{a.litros}L{a.kmOdometro>0?` · ${a.kmOdometro}km`:""}</div></div><div style={S.despRight}><span style={S.despVal}>{fmt(a.valor)}</span><button style={S.delBtn} onClick={()=>del("abastecimentos",a.id)}>✕</button></div></div>))}

          {/* manutenção */}
          <div style={S.sec}>Manutenção e reparos</div>
          <div style={S.formCard}>
            <FR l="Data"><input style={S.inp} type="date" value={fM.data} onChange={e=>setFM(f=>({...f,data:e.target.value}))}/></FR>
            <FR l="Tipo *">
              <select style={S.inp} value={fM.tipo} onChange={e=>setFM(f=>({...f,tipo:e.target.value}))}>
                <option value="">Selecione...</option>
                {["Troca de óleo","Pneu","Freios","Revisão","Seguro","IPVA","Financiamento","Lavagem","Outros"].map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </FR>
            <FR l="Descrição"><input style={S.inp} placeholder="Ex: Óleo 5W30 + filtro" value={fM.descricao} onChange={e=>setFM(f=>({...f,descricao:e.target.value}))}/></FR>
            <FR l="Valor (R$) *"><input style={S.inp} type="number" placeholder="Ex: 250.00" value={fM.valor} onChange={e=>setFM(f=>({...f,valor:e.target.value}))}/></FR>
            <FR l="KM no momento"><input style={S.inp} type="number" placeholder="Ex: 45820" value={fM.km} onChange={e=>setFM(f=>({...f,km:e.target.value}))}/></FR>
            <button style={S.btn} onClick={addManut}>＋ Registrar manutenção</button>
          </div>
          {(d.manutencoes||[]).slice(0,10).map(m=>(<div key={m.id} style={S.despRow}>
            <div><div style={S.despNome}>{m.tipo}</div><div style={{fontSize:12,color:"#64748b"}}>{new Date(m.data+"T12:00:00").toLocaleDateString("pt-BR",{day:"numeric",month:"short"})}{m.km>0?` · ${m.km}km`:""}{m.descricao?` · ${m.descricao}`:""}</div></div>
            <div style={S.despRight}><span style={S.despVal}>{fmt(m.valor)}</span><button style={S.delBtn} onClick={()=>delManut(m.id)}>✕</button></div>
          </div>))}
        </div>}

        {/* ══ CONFIG ══ */}
        {tab===4&&<div style={S.page}>
          <div style={S.sec}>Configurações</div>
          <div style={S.formCard}>
            <FR l="Modelo do carro"><input style={S.inp} placeholder="Ex: HB20 2021" value={cfgEx.modeloCarro||""} onChange={e=>setCfgForm({...(cfgForm||d.config),modeloCarro:e.target.value})}/></FR>
            <FR l="Meta mensal de lucro (R$)"><input style={S.inp} type="number" value={cfgEx.metaMensal} onChange={e=>setCfgForm({...(cfgForm||d.config),metaMensal:parseFloat(e.target.value)})}/></FR>
            <div style={S.fRow}>
              <label style={S.lbl}>Notificações de meta</label>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#0f172a",borderRadius:10,padding:"10px 14px",border:"1px solid #334155"}}>
                <span style={{fontSize:13,color:"#94a3b8"}}>{cfgEx.notificacoesAtivas?"✅ Ativadas":"Desativadas"}</span>
                <button style={{background:cfgEx.notificacoesAtivas?"#065f46":"#1d4ed8",border:"none",borderRadius:8,padding:"6px 14px",color:"#fff",fontSize:12,cursor:"pointer"}} onClick={async()=>{if(!cfgEx.notificacoesAtivas){const p=await Notification.requestPermission();if(p==="granted")setCfgForm({...(cfgForm||d.config),notificacoesAtivas:true});}else{setCfgForm({...(cfgForm||d.config),notificacoesAtivas:false});}}}>{cfgEx.notificacoesAtivas?"Desativar":"Ativar"}</button>
              </div>
            </div>
          </div>

          <div style={S.sec}>Despesas fixas mensais</div>
          <div style={S.formCard}>
            <FR l="Mês"><select style={S.inp} value={fD.mes} onChange={e=>setFD(f=>({...f,mes:e.target.value}))}>{[-2,-1,0].map(o=>{const m=getMes(o);return<option key={m} value={m}>{nomeMes(m)}</option>;})}</select></FR>
            <FR l="Despesa"><input style={S.inp} placeholder="Ex: Seguro, IPVA, Financiamento" value={fD.nome} onChange={e=>setFD(f=>({...f,nome:e.target.value}))}/></FR>
            <FR l="Valor (R$)"><input style={S.inp} type="number" placeholder="Ex: 150.00" value={fD.valor} onChange={e=>setFD(f=>({...f,valor:e.target.value}))}/></FR>
            <button style={S.btn} onClick={addDesp}>＋ Adicionar despesa</button>
          </div>
          {despMes.length>0&&<>{despMes.map(x=>(<div key={x.id} style={S.despRow}><span style={S.despNome}>{x.nome}</span><div style={S.despRight}><span style={S.despVal}>{fmt(x.valor)}</span><button style={S.delBtn} onClick={()=>del("despesasFixas",x.id)}>✕</button></div></div>))}
          <div style={S.despTotal}><span>Total</span><span>{fmt(totalDesp)}</span></div></>}

          <div style={{...S.sec,cursor:"pointer",display:"flex",justifyContent:"space-between"}} onClick={()=>setShowAvancado(!showAvancado)}>
            <span>⚙️ Avançado</span><span>{showAvancado?"▲":"▼"}</span>
          </div>
          {showAvancado&&<><div style={S.formCard}>
            <FR l="Custo por km (R$)"><input style={S.inp} type="number" step="0.01" value={cfgEx.custoPorKm} onChange={e=>setCfgForm({...(cfgForm||d.config),custoPorKm:parseFloat(e.target.value)})}/><div style={S.hint}>Combustível + desgaste + manutenção por km</div></FR>
          </div>
          <div style={{...S.sec,marginTop:12}}>Plataformas e comissões</div>
          <div style={S.formCard}>
            {platsEx.map((p,i)=>(<div key={i} style={S.platRow}><span style={S.platNome}>{p.nome}</span><div style={S.platRight}><input style={S.platInp} type="number" value={p.comissao} onChange={e=>updatePlatCom(i,e.target.value)}/><span style={{color:"#94a3b8",fontSize:13}}>%</span><button style={S.platDel} onClick={()=>removePlat(i)}>✕</button></div></div>))}
            <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #334155"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Adicionar plataforma</div>
              <div style={{display:"flex",gap:8}}><input style={{...S.inp,flex:2}} placeholder="Nome" value={novaPlat.nome} onChange={e=>setNovaPlat(n=>({...n,nome:e.target.value}))}/><input style={{...S.inp,flex:1}} placeholder="%" type="number" value={novaPlat.comissao} onChange={e=>setNovaPlat(n=>({...n,comissao:e.target.value}))}/><button style={{background:"#1d4ed8",border:"none",borderRadius:9,padding:"10px 13px",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",flexShrink:0}} onClick={addPlat}>＋</button></div>
            </div>
          </div></>}

          {hasChanges&&<button style={{...S.btn,marginTop:16}} onClick={saveCfg}>💾 Salvar alterações</button>}

          {/* contato e suporte */}
          <div style={{marginTop:24,paddingTop:20,borderTop:"1px solid #334155"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Suporte e Contato</div>
            <div style={{background:"#1e293b",borderRadius:12,padding:16,border:"1px solid #334155",marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:700,color:"#f1f5f9",marginBottom:4}}>🚘 MotoristaApp</div>
              <div style={{fontSize:12,color:"#64748b",lineHeight:1.8}}>
                Dúvidas ou problemas? Fale com a gente:<br/>
                📧 <a href="mailto:contato.motoristaaapp@gmail.com" style={{color:"#3b82f6"}}>contato.motoristaaapp@gmail.com</a><br/>
                🌐 <a href="https://motoristaaapp.com.br" target="_blank" style={{color:"#3b82f6"}}>motoristaaapp.com.br</a>
              </div>
            </div>
            <a href="mailto:contato.motoristaaapp@gmail.com" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"linear-gradient(135deg,#065f46,#047857)",border:"none",borderRadius:9,padding:"12px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:8,textDecoration:"none",width:"100%",boxSizing:"border-box"}}>
              📧 Enviar email de suporte
            </a>
            <div style={{display:"flex",gap:8}}>
              <a href="/politica-privacidade.html" target="_blank" style={{flex:1,textAlign:"center",fontSize:11,color:"#475569",textDecoration:"none",padding:"8px",background:"#0f172a",borderRadius:8,border:"1px solid #334155"}}>📄 Privacidade</a>
              <a href="/termos-de-uso.html" target="_blank" style={{flex:1,textAlign:"center",fontSize:11,color:"#475569",textDecoration:"none",padding:"8px",background:"#0f172a",borderRadius:8,border:"1px solid #334155"}}>📋 Termos</a>
            </div>
          </div>

          {/* zona de perigo */}
          <div style={{marginTop:32,paddingTop:20,borderTop:"1px solid #334155"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>Zona de perigo</div>
            <div style={{background:"#1e293b",borderRadius:12,padding:16,border:"1px solid #7f1d1d44"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#f87171",marginBottom:6}}>Excluir minha conta</div>
              <div style={{fontSize:12,color:"#64748b",lineHeight:1.6,marginBottom:14}}>Esta ação é irreversível. Todos os seus dados — corridas, despesas, histórico — serão permanentemente excluídos em até 30 dias, conforme nossa Política de Privacidade e a LGPD.</div>
              <button style={{width:"100%",background:"none",border:"1.5px solid #ef4444",borderRadius:9,padding:"11px",color:"#ef4444",fontSize:13,fontWeight:700,cursor:"pointer"}}
                onClick={async()=>{
                  const conf=window.confirm("Tem certeza? Esta ação excluirá TODOS os seus dados permanentemente e não pode ser desfeita.");
                  if(!conf)return;
                  const conf2=window.confirm("Última confirmação: seus dados serão excluídos. Continuar?");
                  if(!conf2)return;
                  try{
                    await sbFetch(`/motorista_dados?user_id=eq.${user.id}`,{method:"DELETE",_token:token});
                    await sbFetch(`/assinaturas?email=eq.${encodeURIComponent(user.email)}`,{method:"DELETE",_token:token});
                  }catch{}
                  localStorage.clear();
                  logout();
                  alert("Sua conta foi marcada para exclusão. Você será desconectado agora.");
                }}>
                🗑️ Excluir minha conta e todos os dados
              </button>
            </div>
            <div style={{display:"flex",gap:12,marginTop:12}}>
              <a href="/politica-privacidade.html" target="_blank" style={{fontSize:12,color:"#475569",textDecoration:"none",flex:1,textAlign:"center",padding:"8px",background:"#1e293b",borderRadius:8,border:"1px solid #334155"}}>📄 Política de Privacidade</a>
              <a href="/termos-de-uso.html" target="_blank" style={{fontSize:12,color:"#475569",textDecoration:"none",flex:1,textAlign:"center",padding:"8px",background:"#1e293b",borderRadius:8,border:"1px solid #334155"}}>📋 Termos de Uso</a>
            </div>
          </div>
        </div>}
      </div>

      <div style={S.botNav}>
        {TABS.map((t,i)=>(
          <button key={t} style={{...S.navBtn,...(tab===i?S.navActive:{})}} onClick={()=>setTab(i)}>
            <span style={{fontSize:16}}>{ICONS[i]}</span>
            <span style={S.navLbl}>{t}</span>
          </button>
        ))}
      </div>
    </div>
  );

  function updatePlatCom(i,v){const arr=[...(platForms||d.plataformas)];arr[i]={...arr[i],comissao:parseFloat(v)||0};setPlatForms(arr);}
  function removePlat(i){setPlatForms((platForms||d.plataformas).filter((_,idx)=>idx!==i));}
  function addPlat(){if(!novaPlat.nome||!novaPlat.comissao)return;setPlatForms([...(platForms||d.plataformas),{nome:novaPlat.nome,comissao:parseFloat(novaPlat.comissao)}]);setNovaPlat({nome:"",comissao:""});}
}

function CookieBanner({onAccept}){
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#1e293b",borderTop:"1px solid #334155",padding:"14px 16px",zIndex:9999,display:"flex",flexDirection:"column",gap:10}}>
      <div style={{fontSize:13,color:"#94a3b8",lineHeight:1.6}}>
        🍪 Usamos cookies essenciais para o funcionamento do app e para salvar sua sessão. Ao continuar, você concorda com nossa <a href="/politica-privacidade.html" target="_blank" style={{color:"#3b82f6"}}>Política de Privacidade</a> e <a href="/termos-de-uso.html" target="_blank" style={{color:"#3b82f6"}}>Termos de Uso</a>.
      </div>
      <div style={{display:"flex",gap:8}}>
        <button style={{flex:1,background:"linear-gradient(135deg,#065f46,#047857)",border:"none",borderRadius:8,padding:"10px",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}} onClick={onAccept}>✓ Aceitar e continuar</button>
        <a href="/politica-privacidade.html" target="_blank" style={{display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:"1px solid #334155",borderRadius:8,padding:"10px 14px",color:"#64748b",fontSize:12,textDecoration:"none",whiteSpace:"nowrap"}}>Saiba mais</a>
      </div>
    </div>
  );
}

function Card({label,value,grad}){return<div style={{...S.card,...grad}}><div style={S.cardLbl}>{label}</div><div style={S.cardVal}>{value}</div></div>;}
function MC({label,value}){return<div style={S.miniCard}><div style={S.miniLbl}>{label}</div><div style={S.miniVal}>{value}</div></div>;}
function FR({l,children}){return<div style={S.fRow}><label style={S.lbl}>{l}</label>{children}</div>;}
function PR({l,v,red,total,green}){return<div style={{...S.prevRow,...(total?S.prevTotal:{})}}><span style={{color:total?"#f1f5f9":"#94a3b8"}}>{l}</span><span style={{color:red?"#f87171":green?"#34d399":"#f1f5f9",fontWeight:total?700:400}}>{v}</span></div>;}

const A={root:{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#0f172a",minHeight:"100vh",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column",color:"#f1f5f9"},splash:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"40px 24px 32px",textAlign:"center"},form:{flex:1,padding:"24px 24px 32px",display:"flex",flexDirection:"column"},back:{background:"none",border:"none",color:"#64748b",fontSize:14,cursor:"pointer",padding:"0 0 20px",textAlign:"left"},inp:{width:"100%",background:"#1e293b",border:"1.5px solid #334155",borderRadius:10,padding:"13px 14px",color:"#f1f5f9",fontSize:15,outline:"none",boxSizing:"border-box"},btnP:{width:"100%",background:"linear-gradient(135deg,#065f46,#047857)",border:"none",borderRadius:12,padding:"15px",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",marginBottom:10},btnS:{width:"100%",background:"transparent",border:"1.5px solid #334155",borderRadius:12,padding:"14px",color:"#94a3b8",fontSize:15,fontWeight:600,cursor:"pointer",marginBottom:12},btnD:{width:"100%",background:"#1e293b",border:"1px dashed #334155",borderRadius:10,padding:"12px",color:"#64748b",fontSize:13,cursor:"pointer",marginBottom:12},msgErr:{background:"#7f1d1d44",border:"1px solid #ef444466",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#fca5a5",marginBottom:14},msgOk:{background:"#05330044",border:"1px solid #22c55e66",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#86efac",marginBottom:14}};

const S={
  root:{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#0f172a",minHeight:"100vh",maxWidth:430,margin:"0 auto",display:"flex",flexDirection:"column",color:"#f1f5f9"},
  header:{background:"linear-gradient(135deg,#1e3a5f,#1e293b)",padding:"12px 16px",borderBottom:"1px solid #334155"},
  hInner:{display:"flex",justifyContent:"space-between",alignItems:"center"},
  logo:{display:"flex",alignItems:"center",gap:8},logoT:{fontSize:15,fontWeight:700,color:"#f8fafc"},logoS:{fontSize:11,color:"#94a3b8"},
  logoutBtn:{background:"none",border:"1px solid #334155",borderRadius:8,padding:"5px 10px",color:"#64748b",fontSize:12,cursor:"pointer"},
  content:{flex:1,overflowY:"auto",paddingBottom:68},page:{padding:"10px 12px 8px"},
  sec:{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:1,marginBottom:8,marginTop:12},
  mesSel:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#1e293b",borderRadius:10,padding:"8px 12px",marginBottom:2,border:"1px solid #334155"},
  mesBtn:{background:"none",border:"none",color:"#94a3b8",fontSize:20,cursor:"pointer",padding:"0 6px"},mesNome:{fontSize:13,fontWeight:700,color:"#f1f5f9",textTransform:"capitalize"},
  row2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7},row3:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:7},
  card:{borderRadius:11,padding:"11px 13px"},cFull:{borderRadius:11,padding:"11px 13px",marginBottom:7,background:"#1e3a5f"},
  cGreen:{background:"linear-gradient(135deg,#064e3b,#065f46)"},cBlue:{background:"linear-gradient(135deg,#064e3b,#065f46)"},
  cRed:{background:"linear-gradient(135deg,#7f1d1d,#991b1b)"},cPurple:{background:"linear-gradient(135deg,#4c1d95,#5b21b6)"},
  cSlate:{background:"linear-gradient(135deg,#1e293b,#334155)"},cTeal:{background:"linear-gradient(135deg,#134e4a,#115e59)"},
  cardLbl:{fontSize:10,color:"#cbd5e1",marginBottom:3,fontWeight:600,textTransform:"uppercase",letterSpacing:0.5},cardVal:{fontSize:17,fontWeight:800,color:"#f8fafc"},
  miniCard:{background:"#1e293b",borderRadius:9,padding:"9px 10px",border:"1px solid #334155"},miniLbl:{fontSize:9,color:"#64748b",fontWeight:600,textTransform:"uppercase",marginBottom:3},miniVal:{fontSize:15,fontWeight:700,color:"#f1f5f9"},
  metaCard:{background:"#1e293b",borderRadius:11,padding:12,marginBottom:7,border:"1px solid #334155"},
  metaTop:{display:"flex",justifyContent:"space-between",marginBottom:7},metaLbl:{fontSize:11,fontWeight:600,color:"#94a3b8"},metaVals:{fontSize:11,fontWeight:700,color:"#f1f5f9"},
  progBg:{background:"#334155",borderRadius:99,height:6,overflow:"hidden"},progBar:{height:"100%",borderRadius:99,transition:"width 0.5s ease"},metaInfo:{fontSize:11,color:"#64748b",marginTop:5},
  rankRow:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#1e293b",borderRadius:11,padding:"11px 13px",marginBottom:6,border:"1px solid #334155"},
  rankLeft:{display:"flex",alignItems:"center",gap:9},rankPos:{fontSize:17,fontWeight:900,color:"#475569",minWidth:22},rankNome:{fontSize:13,fontWeight:700,color:"#f1f5f9"},rankSub:{fontSize:11,color:"#64748b",marginTop:1},
  rankRight:{textAlign:"right"},rankLucro:{fontSize:14,fontWeight:800,color:"#34d399"},rankBruto:{fontSize:11,color:"#64748b"},
  empty:{textAlign:"center",color:"#475569",fontSize:13,padding:"28px 16px",lineHeight:1.6},
  formCard:{background:"#1e293b",borderRadius:12,padding:13,border:"1px solid #334155"},
  fRow:{marginBottom:11},lbl:{display:"block",fontSize:11,fontWeight:600,color:"#94a3b8",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5},
  inp:{width:"100%",background:"#0f172a",border:"1.5px solid #334155",borderRadius:9,padding:"10px 12px",color:"#f1f5f9",fontSize:14,outline:"none",boxSizing:"border-box"},
  hint:{fontSize:11,color:"#475569",marginTop:3},
  comBadge:{background:"#1d4ed820",border:"1px solid #3b82f640",borderRadius:7,padding:"4px 9px",fontSize:11,color:"#6ee7b7",marginTop:4},
  preview:{background:"#0f172a",borderRadius:9,padding:11,marginBottom:11,border:"1px solid #22c55e33"},
  prevT:{fontSize:11,fontWeight:700,color:"#34d399",marginBottom:7,textTransform:"uppercase",letterSpacing:0.5},
  prevRow:{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4},prevTotal:{borderTop:"1px solid #334155",paddingTop:6,marginTop:2,fontSize:13},
  divider:{height:1,background:"#334155",margin:"2px 0"},
  btn:{width:"100%",background:"linear-gradient(135deg,#065f46,#047857)",border:"none",borderRadius:9,padding:12,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",marginTop:2},
  diaCard:{background:"#1e293b",borderRadius:11,marginBottom:7,border:"1px solid #334155",overflow:"hidden"},
  diaHeader:{display:"flex",alignItems:"center",padding:"11px 13px",cursor:"pointer",gap:8},
  diaNome:{fontSize:13,fontWeight:700,color:"#f1f5f9",textTransform:"capitalize"},diaSub:{fontSize:11,color:"#64748b",marginTop:1},
  diaRight:{flex:1,textAlign:"right"},diaLucro:{fontSize:14,fontWeight:800,color:"#34d399"},diaBruto:{fontSize:11,color:"#64748b"},diaChev:{fontSize:11,color:"#475569"},
  lancRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 13px",borderTop:"1px solid #0f172a",background:"#162032"},
  lancInfo:{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"},
  lancPlat:{background:"#3b82f620",color:"#34d399",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:99},
  lancVals:{display:"flex",alignItems:"center",gap:7},
  lancLucro:{fontSize:13,fontWeight:700,color:"#34d399"},lancBruto:{fontSize:11,color:"#64748b"},lancKm:{fontSize:11,color:"#475569"},
  delBtn:{background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:12,padding:"2px 3px"},
  despRow:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#1e293b",borderRadius:9,padding:"10px 13px",marginBottom:5,border:"1px solid #334155"},
  despNome:{fontSize:13,fontWeight:600,color:"#e2e8f0"},despRight:{display:"flex",alignItems:"center",gap:9},despVal:{fontSize:13,fontWeight:700,color:"#f87171"},
  despTotal:{display:"flex",justifyContent:"space-between",padding:"9px 13px",fontSize:13,fontWeight:700,color:"#f1f5f9",borderTop:"1px solid #334155"},
  platRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #334155"},
  platNome:{fontSize:13,fontWeight:600,color:"#e2e8f0"},platRight:{display:"flex",alignItems:"center",gap:5},
  platInp:{width:52,background:"#0f172a",border:"1.5px solid #334155",borderRadius:7,padding:"5px 7px",color:"#f1f5f9",fontSize:13,outline:"none",textAlign:"center"},
  platDel:{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:13,padding:"2px 4px"},
  botNav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"#1e293b",borderTop:"1px solid #334155",display:"flex",zIndex:100},
  navBtn:{flex:1,background:"none",border:"none",padding:"8px 0 6px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2},
  navActive:{background:"#0f172a"},navLbl:{fontSize:9,color:"#64748b",fontWeight:600},
};
