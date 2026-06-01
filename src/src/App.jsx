import { useState, useEffect } from "react";

// ─────────────────────────────────────────────
// SUPABASE CONFIG — substitua pelos seus dados
// ─────────────────────────────────────────────
const SUPABASE_URL = "https://crlcqtfejjewxisriksi.supabase.co";
const SUPABASE_KEY = "sb_publishable_-GHLYHf7u4bv3uD8hDwE9Q_43M6ucoK";

// Helpers Supabase REST
async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${(opts._token || SUPABASE_KEY)}`,
      Prefer: "return=representation",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
  return res.status === 204 ? null : res.json();
}
async function sbAuth(endpoint, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Erro");
  return data;
}

// ─────────────────────────────────────────────
const LOCAL_KEY = "motorista_session";
const DEFAULT_PLATAFORMAS = [
  { nome: "Uber", comissao: 25 },
  { nome: "99", comissao: 20 },
  { nome: "InDriver", comissao: 15 },
  { nome: "Cabify", comissao: 22 },
];
const DEFAULT_CONFIG = { custoPorKm: 0.45, metaMensal: 3000 };

function fmt(v) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0); }
function today() { return new Date().toISOString().split("T")[0]; }
function getMes(offset = 0) {
  const d = new Date(); d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
}
function nomeMes(m) {
  const [y, mo] = m.split("-");
  return new Date(+y, +mo - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const TABS = ["Dashboard", "Corridas", "Despesas", "Histórico", "Config"];
const ICONS = ["📊", "🚗", "💸", "📅", "⚙️"];

// ══════════════════════════════════════════════
// TELA DE BOAS-VINDAS / LOGIN / CADASTRO
// ══════════════════════════════════════════════
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("welcome"); // welcome | login | signup
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState("");

  async function handleLogin() {
    if (!email || !senha) return setErro("Preencha email e senha.");
    setLoading(true); setErro("");
    try {
      const data = await sbAuth("token?grant_type=password", { email, password: senha });
      localStorage.setItem(LOCAL_KEY, JSON.stringify({ token: data.access_token, user: data.user }));
      onLogin(data.access_token, data.user);
    } catch (e) { setErro(e.message); }
    setLoading(false);
  }

  async function handleSignup() {
    if (!nome || !email || !senha) return setErro("Preencha todos os campos.");
    if (senha.length < 6) return setErro("Senha deve ter pelo menos 6 caracteres.");
    setLoading(true); setErro("");
    try {
      await sbAuth("signup", { email, password: senha, data: { nome } });
      setOk("Conta criada! Verifique seu email para confirmar, depois faça login.");
      setMode("login");
    } catch (e) { setErro(e.message); }
    setLoading(false);
  }

  // TELA DE BOAS-VINDAS
  if (mode === "welcome") return (
    <div style={A.root}>
      <div style={A.splash}>
        <div style={A.splashIcon}>🚘</div>
        <div style={A.splashTitle}>MotoristaApp</div>
        <div style={A.splashSub}>Descubra seu lucro real.<br />Bata suas metas. Dirija melhor.</div>
        <div style={A.features}>
          {["💰 Lucro real por plataforma", "📊 Controle de despesas", "⛽ Consumo do seu carro", "🏆 Ranking de apps", "📅 Histórico mensal", "📤 Exportar relatórios"].map(f => (
            <div key={f} style={A.featureItem}>{f}</div>
          ))}
        </div>
        <button style={A.btnPrimary} onClick={() => setMode("signup")}>Criar conta — 15 dias grátis</button>
        <button style={A.btnSecondary} onClick={() => setMode("login")}>Já tenho conta — entrar</button>
        <button style={A.demoBtn} onClick={() => onLogin("DEMO", { id: "demo", email: "demo@motoristaapp.com", user_metadata: { nome: "Motorista Demo" }, trialStart: Date.now() })}>
          🎮 Experimentar agora sem cadastro
        </button>
        <div style={A.terms}>15 dias grátis · Sem cartão de crédito</div>
      </div>
    </div>
  );

  // LOGIN
  if (mode === "login") return (
    <div style={A.root}>
      <div style={A.formScreen}>
        <button style={A.backBtn} onClick={() => { setMode("welcome"); setErro(""); setOk(""); }}>← Voltar</button>
        <div style={A.formIcon}>🚘</div>
        <div style={A.formTitle}>Entrar na conta</div>
        {ok && <div style={A.msgOk}>{ok}</div>}
        {erro && <div style={A.msgErr}>{erro}</div>}
        <div style={A.fRow}><label style={A.lbl}>Email</label><input style={A.inp} type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div style={A.fRow}><label style={A.lbl}>Senha</label><input style={A.inp} type="password" placeholder="••••••" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} /></div>
        <button style={{ ...A.btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={handleLogin} disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
        <div style={A.switchText}>Não tem conta? <span style={A.switchLink} onClick={() => { setMode("signup"); setErro(""); }}>Criar agora</span></div>


      </div>
    </div>
  );

  // CADASTRO
  return (
    <div style={A.root}>
      <div style={A.formScreen}>
        <button style={A.backBtn} onClick={() => { setMode("welcome"); setErro(""); }}>← Voltar</button>
        <div style={A.formIcon}>🚘</div>
        <div style={A.formTitle}>Criar conta grátis</div>
        {erro && <div style={A.msgErr}>{erro}</div>}
        <div style={A.fRow}><label style={A.lbl}>Seu nome</label><input style={A.inp} placeholder="Ex: João Silva" value={nome} onChange={e => setNome(e.target.value)} /></div>
        <div style={A.fRow}><label style={A.lbl}>Email</label><input style={A.inp} type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div style={A.fRow}><label style={A.lbl}>Senha</label><input style={A.inp} type="password" placeholder="Mínimo 6 caracteres" value={senha} onChange={e => setSenha(e.target.value)} /></div>
        <button style={{ ...A.btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={handleSignup} disabled={loading}>{loading ? "Criando conta..." : "Criar conta grátis"}</button>
        <div style={A.switchText}>Já tem conta? <span style={A.switchLink} onClick={() => { setMode("login"); setErro(""); }}>Entrar</span></div>
      </div>
    </div>
  );
}

const A = {
  root: { fontFamily: "'Segoe UI',system-ui,sans-serif", background: "#0f172a", minHeight: "100vh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", color: "#f1f5f9" },
  splash: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px 32px", textAlign: "center" },
  splashIcon: { fontSize: 64, marginBottom: 12 },
  splashTitle: { fontSize: 32, fontWeight: 900, color: "#f8fafc", letterSpacing: -1, marginBottom: 8 },
  splashSub: { fontSize: 16, color: "#94a3b8", lineHeight: 1.6, marginBottom: 32 },
  features: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%", marginBottom: 32 },
  featureItem: { background: "#1e293b", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#cbd5e1", textAlign: "left", border: "1px solid #334155" },
  btnPrimary: { width: "100%", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none", borderRadius: 12, padding: "15px", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 10 },
  btnSecondary: { width: "100%", background: "transparent", border: "1.5px solid #334155", borderRadius: 12, padding: "14px", color: "#94a3b8", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 12 },
  terms: { fontSize: 12, color: "#475569" },
  formScreen: { flex: 1, padding: "24px 24px 32px", display: "flex", flexDirection: "column" },
  backBtn: { background: "none", border: "none", color: "#64748b", fontSize: 14, cursor: "pointer", padding: "0 0 20px", textAlign: "left" },
  formIcon: { fontSize: 40, textAlign: "center", marginBottom: 8 },
  formTitle: { fontSize: 24, fontWeight: 800, color: "#f8fafc", textAlign: "center", marginBottom: 24 },
  fRow: { marginBottom: 14 },
  lbl: { display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  inp: { width: "100%", background: "#1e293b", border: "1.5px solid #334155", borderRadius: 10, padding: "13px 14px", color: "#f1f5f9", fontSize: 15, outline: "none", boxSizing: "border-box" },
  msgErr: { background: "#7f1d1d44", border: "1px solid #ef444466", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#fca5a5", marginBottom: 14 },
  msgOk: { background: "#05330044", border: "1px solid #22c55e66", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#86efac", marginBottom: 14 },
  switchText: { textAlign: "center", fontSize: 14, color: "#64748b", marginTop: 16 },
  switchLink: { color: "#3b82f6", cursor: "pointer", fontWeight: 600 },
  demoBtn: { marginTop: 20, background: "#1e293b", border: "1px dashed #334155", borderRadius: 10, padding: "12px", color: "#64748b", fontSize: 13, cursor: "pointer", width: "100%" },
};

// ══════════════════════════════════════════════
// APP PRINCIPAL
// ══════════════════════════════════════════════
export default function MotoristaApp() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [appData, setAppData] = useState(null); // carregado do Supabase ou local
  const [tab, setTab] = useState(0);
  const [saved, setSaved] = useState(false);
  const [mesSel, setMesSel] = useState(getMes(0));
  const [diaAberto, setDiaAberto] = useState(null);
  const DEMO = token === "DEMO";

  // forms
  const [fC, setFC] = useState({ data: today(), plataforma: "Uber", ganho: "", km: "", combustivel: "", horas: "", numCorridas: "" });
  const [fA, setFA] = useState({ data: today(), litros: "", valor: "", kmOdometro: "" });
  const [fD, setFD] = useState({ nome: "", valor: "", mes: getMes(0) });
  const [cfgForm, setCfgForm] = useState(null);
  const [platForms, setPlatForms] = useState(null);
  const [novaPlat, setNovaPlat] = useState({ nome: "", comissao: "" });

  // ── estado de assinatura ──
  const [assinatura, setAssinatura] = useState(null); // null=carregando | objeto=carregado

  // ── auth persistida ──
  useEffect(() => {
    try {
      const s = localStorage.getItem(LOCAL_KEY);
      if (s) { const { token: t, user: u } = JSON.parse(s); if (t && u) { setToken(t); setUser(u); } }
    } catch {}
  }, []);

  // ── carregar dados + assinatura ──
  useEffect(() => {
    if (!token || !user) return;
    if (DEMO) {
      try {
        const raw = localStorage.getItem("moto_demo");
        setAppData(raw ? JSON.parse(raw) : defaultData());
      } catch { setAppData(defaultData()); }
      setAssinatura({ status: "demo" });
      return;
    }
    loadFromSupabase();
    loadAssinatura();
  }, [token]);

  async function loadAssinatura() {
    try {
      const rows = await sbFetch(
        `/assinaturas?email=eq.${encodeURIComponent(user.email)}&select=status,trial_end,assinatura_end,cancelado_em`,
        { _token: token }
      );
      if (rows && rows.length > 0) {
        setAssinatura(rows[0]);
      } else {
        // Primeiro acesso — cria registro de trial
        await sbFetch("/assinaturas", {
          method: "POST",
          _token: token,
          body: JSON.stringify({
            email: user.email,
            user_id: user.id,
            status: "trial",
            trial_start: new Date().toISOString(),
            trial_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        });
        setAssinatura({ status: "trial", trial_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() });
      }
    } catch { setAssinatura({ status: "trial", trial_end: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() }); }
  }

  function getAcessoInfo() {
    if (!assinatura) return { liberado: false, daysLeft: 0, status: "carregando" };
    if (assinatura.status === "demo") return { liberado: true, daysLeft: 999, status: "demo" };
    if (assinatura.status === "active") {
      const fim = new Date(assinatura.assinatura_end);
      const daysLeft = Math.max(Math.ceil((fim - Date.now()) / (1000 * 60 * 60 * 24)), 0);
      return { liberado: daysLeft > 0, daysLeft, status: "active" };
    }
    if (assinatura.status === "trial") {
      const fim = new Date(assinatura.trial_end);
      const daysLeft = Math.max(Math.ceil((fim - Date.now()) / (1000 * 60 * 60 * 24)), 0);
      return { liberado: daysLeft > 0, daysLeft, status: "trial" };
    }
    return { liberado: false, daysLeft: 0, status: assinatura.status };
  }

  function defaultData() {
    return { corridas: [], abastecimentos: [], despesasFixas: [], plataformas: DEFAULT_PLATAFORMAS, config: DEFAULT_CONFIG };
  }

  async function loadFromSupabase() {
    try {
      const rows = await sbFetch(`/motorista_dados?user_id=eq.${user.id}&select=dados`, { _token: token });
      if (rows && rows.length > 0) setAppData(JSON.parse(rows[0].dados));
      else setAppData(defaultData());
    } catch { setAppData(defaultData()); }
  }

  async function saveData(newData) {
    setAppData(newData);
    if (DEMO) { localStorage.setItem("moto_demo", JSON.stringify(newData)); return; }
    try {
      // upsert no Supabase
      await sbFetch("/motorista_dados", {
        method: "POST",
        _token: token,
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ user_id: user.id, dados: JSON.stringify(newData) }),
      });
    } catch (e) { console.error("Erro ao salvar:", e); }
  }

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 2000); }

  function logout() {
    localStorage.removeItem(LOCAL_KEY);
    setToken(null); setUser(null); setAppData(null);
  }

  // ── aguardando login ──
  if (!token || !user) return <AuthScreen onLogin={(t, u) => { setToken(t); setUser(u); }} />;
  if (!appData || !assinatura) return (
    <div style={{ background: "#0f172a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 40 }}>🚘</div>
      <div style={{ color: "#94a3b8", fontSize: 14 }}>Carregando seus dados...</div>
    </div>
  );

  // ── validação de acesso ──
  const acesso = getAcessoInfo();

  if (!acesso.liberado) return (
    <div style={{ fontFamily: "'Segoe UI',system-ui,sans-serif", background: "#0f172a", minHeight: "100vh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", marginBottom: 8 }}>
        {acesso.status === "cancelled" ? "Assinatura cancelada" : "Período de teste encerrado"}
      </div>
      <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7, marginBottom: 32 }}>
        {acesso.status === "cancelled"
          ? "Sua assinatura foi cancelada. Reative para continuar acessando seus dados."
          : "Seus 15 dias gratuitos terminaram. Assine para continuar usando o MotoristaApp e manter todos os seus dados."}
      </div>
      <div style={{ background: "linear-gradient(135deg,#1e3a8a,#1e40af)", borderRadius: 16, padding: "24px 20px", width: "100%", marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#93c5fd", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Plano Mensal</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>R$12,90<span style={{ fontSize: 14, color: "#93c5fd" }}>/mês</span></div>
        <div style={{ fontSize: 13, color: "#bfdbfe", marginTop: 8 }}>Cancele quando quiser · Seus dados ficam salvos</div>
      </div>
      <button style={{ width: "100%", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none", borderRadius: 12, padding: 15, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}
        onClick={() => window.open("https://seulink.kiwify.com.br", "_blank")}>
        ✅ Assinar agora — R$12,90/mês
      </button>
      <button style={{ background: "none", border: "none", color: "#475569", fontSize: 13, cursor: "pointer" }} onClick={logout}>Usar outra conta</button>
    </div>
  );

  const d = appData;
  function getComissao(nome) { return (d.plataformas.find(p => p.nome === nome) || { comissao: 25 }).comissao; }
  function calcLucro(c) { return c.ganho - c.ganho * getComissao(c.plataforma) / 100 - c.km * d.config.custoPorKm - (c.combustivel || 0); }

  const corridasMes = d.corridas.filter(c => c.data.startsWith(mesSel));
  const abastMes    = d.abastecimentos.filter(a => a.data.startsWith(mesSel));
  const despMes     = d.despesasFixas.filter(x => x.mes === mesSel);

  const ganhoMes      = corridasMes.reduce((s, c) => s + c.ganho, 0);
  const lucroMes      = corridasMes.reduce((s, c) => s + calcLucro(c), 0);
  const kmMes         = corridasMes.reduce((s, c) => s + c.km, 0);
  const horasMes      = corridasMes.reduce((s, c) => s + (c.horas || 0), 0);
  const totalDesp     = despMes.reduce((s, x) => s + x.valor, 0);
  const lucroLiquido  = lucroMes - totalDesp;
  const ganhoPorHora  = horasMes > 0 ? lucroMes / horasMes : 0;
  const totalAbast    = abastMes.reduce((s, a) => s + a.valor, 0);
  const totalLitros   = abastMes.reduce((s, a) => s + a.litros, 0);
  const kmPorLitro    = totalLitros > 0 ? kmMes / totalLitros : 0;

  const progMeta = Math.min((lucroLiquido / d.config.metaMensal) * 100, 100);
  const diasNoMes = new Date(+mesSel.split("-")[0], +mesSel.split("-")[1], 0).getDate();
  const diaAtual = mesSel === getMes(0) ? new Date().getDate() : diasNoMes;
  const diasRest = Math.max(diasNoMes - diaAtual, 0);
  const faltaMeta = Math.max(d.config.metaMensal - lucroLiquido, 0);
  const porDia = diasRest > 0 ? faltaMeta / diasRest : 0;

  const rankPlat = {};
  corridasMes.forEach(c => {
    if (!rankPlat[c.plataforma]) rankPlat[c.plataforma] = { ganho: 0, lucro: 0, km: 0, horas: 0 };
    rankPlat[c.plataforma].ganho += c.ganho;
    rankPlat[c.plataforma].lucro += calcLucro(c);
    rankPlat[c.plataforma].km += c.km;
    rankPlat[c.plataforma].horas += c.horas || 0;
  });
  const rankSorted = Object.entries(rankPlat).sort((a, b) => b[1].lucro - a[1].lucro);
  const diasUnicos = [...new Set(corridasMes.map(c => c.data))].sort((a, b) => b.localeCompare(a));

  const comAtual = getComissao(fC.plataforma);
  const pg = parseFloat(fC.ganho) || 0, pk = parseFloat(fC.km) || 0, pc = parseFloat(fC.combustivel) || 0;
  const prevLucro = pg - pg * comAtual / 100 - pk * d.config.custoPorKm - pc;

  function addCorrida() {
    if (!fC.ganho || !fC.km) return;
    const nd = { ...d, corridas: [{ id: Date.now(), data: fC.data, plataforma: fC.plataforma, ganho: parseFloat(fC.ganho), km: parseFloat(fC.km), combustivel: parseFloat(fC.combustivel) || 0, horas: parseFloat(fC.horas) || 0, numCorridas: parseInt(fC.numCorridas) || 1 }, ...d.corridas] };
    saveData(nd); setFC(f => ({ ...f, ganho: "", km: "", combustivel: "", horas: "", numCorridas: "" })); flash();
  }
  function addAbast() {
    if (!fA.litros || !fA.valor) return;
    const nd = { ...d, abastecimentos: [{ id: Date.now(), data: fA.data, litros: parseFloat(fA.litros), valor: parseFloat(fA.valor), kmOdometro: parseFloat(fA.kmOdometro) || 0 }, ...d.abastecimentos] };
    saveData(nd); setFA({ data: today(), litros: "", valor: "", kmOdometro: "" }); flash();
  }
  function addDesp() {
    if (!fD.nome || !fD.valor) return;
    const nd = { ...d, despesasFixas: [{ id: Date.now(), nome: fD.nome, valor: parseFloat(fD.valor), mes: fD.mes }, ...d.despesasFixas] };
    saveData(nd); setFD({ nome: "", valor: "", mes: getMes(0) }); flash();
  }
  function del(tipo, id) {
    const nd = { ...d, [tipo]: d[tipo].filter(x => x.id !== id) };
    saveData(nd);
  }
  function saveCfg() {
    const nd = { ...d, plataformas: platForms || d.plataformas, config: cfgForm || d.config };
    saveData(nd); setPlatForms(null); setCfgForm(null); flash();
  }
  function updatePlatCom(i, v) { const arr = [...(platForms || d.plataformas)]; arr[i] = { ...arr[i], comissao: parseFloat(v) || 0 }; setPlatForms(arr); }
  function removePlat(i) { setPlatForms((platForms || d.plataformas).filter((_, idx) => idx !== i)); }
  function addPlat() {
    if (!novaPlat.nome || !novaPlat.comissao) return;
    setPlatForms([...(platForms || d.plataformas), { nome: novaPlat.nome, comissao: parseFloat(novaPlat.comissao) }]);
    setNovaPlat({ nome: "", comissao: "" });
  }

  const platsEx = platForms || d.plataformas;
  const cfgEx   = cfgForm   || d.config;
  const hasChanges = platForms !== null || cfgForm !== null;
  const nomeUser = user?.user_metadata?.nome || user?.email?.split("@")[0] || "Motorista";

  function exportar() {
    const linhas = [`RELATÓRIO — ${nomeMes(mesSel).toUpperCase()}`, `Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, "", "=== RESUMO ===", `Ganho Bruto: ${fmt(ganhoMes)}`, `Lucro Operacional: ${fmt(lucroMes)}`, `Despesas Fixas: ${fmt(totalDesp)}`, `LUCRO LÍQUIDO: ${fmt(lucroLiquido)}`, `KM Rodados: ${kmMes.toFixed(0)} km`, horasMes > 0 ? `Horas: ${horasMes.toFixed(1)}h | Lucro/hora: ${fmt(ganhoPorHora)}` : "", "", "=== POR PLATAFORMA ===", ...rankSorted.map(([n, v]) => `${n}: Lucro ${fmt(v.lucro)} | Ganho ${fmt(v.ganho)} | ${v.km}km`), "", "=== DESPESAS FIXAS ===", ...despMes.map(x => `${x.nome}: ${fmt(x.valor)}`), "", "=== ABASTECIMENTOS ===", `Total: ${fmt(totalAbast)} | ${totalLitros.toFixed(1)}L`, kmPorLitro > 0 ? `Média: ${kmPorLitro.toFixed(1)} km/litro` : ""].filter(Boolean);
    const blob = new Blob([linhas.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `relatorio-${mesSel}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  function navMes(dir) {
    const d2 = new Date(mesSel + "-01"); d2.setMonth(d2.getMonth() + dir);
    const novo = d2.toISOString().slice(0, 7);
    if (novo <= getMes(0)) setMesSel(novo);
  }

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.hInner}>
          <div style={S.logo}><span style={{ fontSize: 22 }}>🚘</span><div><div style={S.logoT}>MotoristaApp</div><div style={S.logoS}>Olá, {nomeUser}! {DEMO && <span style={S.demoBadge}>DEMO</span>}</div></div></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {saved && <div style={S.savedBadge}>✓</div>}
            <button style={S.logoutBtn} onClick={logout}>Sair</button>
          </div>
        </div>
      </div>

      {/* Banner trial/assinatura */}
      {acesso.status === "trial" && acesso.daysLeft <= 5 && (
        <div style={{ background: "linear-gradient(90deg,#92400e,#78350f)", padding: "8px 16px", fontSize: 12, color: "#fcd34d", textAlign: "center", fontWeight: 600 }}>
          ⚠️ Teste termina em {acesso.daysLeft} dia{acesso.daysLeft !== 1 ? "s" : ""} · <span style={{ textDecoration: "underline", cursor: "pointer" }} onClick={() => window.open("https://seulink.kiwify.com.br", "_blank")}>Assinar agora</span>
        </div>
      )}
      {acesso.status === "trial" && acesso.daysLeft > 5 && (
        <div style={{ background: "#1e293b", padding: "6px 16px", fontSize: 11, color: "#64748b", textAlign: "center", borderBottom: "1px solid #334155" }}>
          🎁 Teste grátis · {acesso.daysLeft} dias restantes
        </div>
      )}
      <div style={S.content}>

        {/* ══ DASHBOARD ══ */}
        {tab === 0 && (
          <div style={S.page}>
            <div style={S.mesSel}>
              <button style={S.mesBtn} onClick={() => navMes(-1)}>‹</button>
              <span style={S.mesNome}>{nomeMes(mesSel)}</span>
              <button style={S.mesBtn} onClick={() => navMes(1)} disabled={mesSel >= getMes(0)}>›</button>
            </div>
            <div style={S.sec}>Resultados</div>
            <div style={S.row2}>
              <Card label="Ganho Bruto"        value={fmt(ganhoMes)}    grad={S.cGreen}  />
              <Card label="Lucro Operacional"  value={fmt(lucroMes)}    grad={S.cBlue}   />
            </div>
            <div style={S.row2}>
              <Card label="Despesas Fixas"     value={fmt(totalDesp)}   grad={S.cRed}    />
              <Card label="Lucro Líquido"      value={fmt(lucroLiquido)} grad={S.cPurple} />
            </div>
            {horasMes > 0 && (
              <div style={S.row2}>
                <Card label="Horas Trabalhadas" value={`${horasMes.toFixed(1)}h`} grad={S.cSlate} />
                <Card label="Lucro por Hora"    value={fmt(ganhoPorHora)}          grad={S.cTeal}  />
              </div>
            )}
            <div style={{ ...S.card, ...S.cFull }}><div style={S.cardLbl}>KM rodados</div><div style={S.cardVal}>{kmMes.toFixed(0)} km</div></div>

            <div style={S.metaCard}>
              <div style={S.metaTop}><span style={S.metaLbl}>Meta mensal</span><span style={S.metaVals}>{fmt(lucroLiquido)} / {fmt(d.config.metaMensal)}</span></div>
              <div style={S.progBg}><div style={{ ...S.progBar, width: `${progMeta}%`, background: progMeta >= 100 ? "#22c55e" : progMeta >= 60 ? "#f59e0b" : "#3b82f6" }} /></div>
              <div style={S.metaInfo}>{progMeta.toFixed(0)}% — falta {fmt(faltaMeta)} · {fmt(porDia)}/dia</div>
            </div>

            {rankSorted.length > 0 && (
              <>
                <div style={S.sec}>🏆 Ranking de plataformas</div>
                {rankSorted.map(([nome, v], i) => (
                  <div key={nome} style={S.rankRow}>
                    <div style={S.rankLeft}>
                      <span style={S.rankPos}>{i + 1}º</span>
                      <div><div style={S.rankNome}>{nome}</div><div style={S.rankSub}>{v.km}km · {v.horas > 0 ? `${v.horas.toFixed(1)}h · ${fmt(v.lucro / v.horas)}/h` : `${getComissao(nome)}% comissão`}</div></div>
                    </div>
                    <div style={S.rankRight}><div style={S.rankLucro}>{fmt(v.lucro)}</div><div style={S.rankBruto}>{fmt(v.ganho)} bruto</div></div>
                  </div>
                ))}
              </>
            )}
            <button style={S.exportBtn} onClick={exportar}>📤 Exportar relatório</button>
            {corridasMes.length === 0 && <div style={S.empty}>Nenhum registro em {nomeMes(mesSel)}.<br />Lance seu primeiro dia na aba Corridas!</div>}
          </div>
        )}

        {/* ══ CORRIDAS ══ */}
        {tab === 1 && (
          <div style={S.page}>
            <div style={S.sec}>Lançar dia de trabalho</div>
            <div style={S.formCard}>
              <FR l="Data"><input style={S.inp} type="date" value={fC.data} onChange={e => setFC(f => ({ ...f, data: e.target.value }))} /></FR>
              <FR l="Plataforma">
                <select style={S.inp} value={fC.plataforma} onChange={e => setFC(f => ({ ...f, plataforma: e.target.value }))}>
                  {d.plataformas.map(p => <option key={p.nome}>{p.nome}</option>)}
                </select>
                <div style={S.comBadge}>Comissão: <b>{comAtual}%</b></div>
              </FR>
              <FR l="Ganho bruto (R$) *"><input style={S.inp} type="number" placeholder="Ex: 180.00" value={fC.ganho} onChange={e => setFC(f => ({ ...f, ganho: e.target.value }))} /></FR>
              <FR l="KM rodados *"><input style={S.inp} type="number" placeholder="Ex: 120" value={fC.km} onChange={e => setFC(f => ({ ...f, km: e.target.value }))} /></FR>
              <FR l="Combustível extra (R$)"><input style={S.inp} type="number" placeholder="Ex: 45.00" value={fC.combustivel} onChange={e => setFC(f => ({ ...f, combustivel: e.target.value }))} /></FR>
              <FR l="Horas trabalhadas"><input style={S.inp} type="number" placeholder="Ex: 8.5" step="0.5" value={fC.horas} onChange={e => setFC(f => ({ ...f, horas: e.target.value }))} /></FR>
              <FR l="Nº de corridas"><input style={S.inp} type="number" placeholder="Ex: 12" value={fC.numCorridas} onChange={e => setFC(f => ({ ...f, numCorridas: e.target.value }))} /></FR>
              {pg > 0 && pk > 0 && (
                <div style={S.preview}>
                  <div style={S.prevT}>Prévia do lucro real</div>
                  <PR l="Ganho bruto" v={fmt(pg)} />
                  <PR l={`— Comissão ${fC.plataforma} (${comAtual}%)`} v={`- ${fmt(pg * comAtual / 100)}`} red />
                  <PR l={`— Custo km (${pk}km)`} v={`- ${fmt(pk * d.config.custoPorKm)}`} red />
                  {pc > 0 && <PR l="— Combustível" v={`- ${fmt(pc)}`} red />}
                  <div style={S.divider} />
                  <PR l="= Lucro real" v={fmt(prevLucro)} total green={prevLucro > 0} />
                  {parseFloat(fC.horas) > 0 && <PR l="Lucro/hora" v={fmt(prevLucro / parseFloat(fC.horas))} />}
                </div>
              )}
              <button style={S.btn} onClick={addCorrida}>＋ Lançar dia</button>
            </div>

            <div style={S.sec}>Histórico por dia</div>
            {diasUnicos.length === 0 && <div style={S.empty}>Nenhum lançamento ainda.</div>}
            {diasUnicos.map(dia => {
              const cs = corridasMes.filter(c => c.data === dia);
              const gD = cs.reduce((s, c) => s + c.ganho, 0);
              const lD = cs.reduce((s, c) => s + calcLucro(c), 0);
              const ab = diaAberto === dia;
              return (
                <div key={dia} style={S.diaCard}>
                  <div style={S.diaHeader} onClick={() => setDiaAberto(ab ? null : dia)}>
                    <div><div style={S.diaNome}>{new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}</div><div style={S.diaSub}>{cs.length} lançamento{cs.length > 1 ? "s" : ""}</div></div>
                    <div style={S.diaRight}><div style={S.diaLucro}>{fmt(lD)}</div><div style={S.diaBruto}>{fmt(gD)} bruto</div></div>
                    <span style={S.diaChev}>{ab ? "▲" : "▼"}</span>
                  </div>
                  {ab && cs.map(c => (
                    <div key={c.id} style={S.lancRow}>
                      <div style={S.lancInfo}>
                        <span style={S.lancPlat}>{c.plataforma}</span>
                        {c.numCorridas > 1 && <span style={S.lancNum}>{c.numCorridas} corridas</span>}
                        {c.horas > 0 && <span style={S.lancHora}>{c.horas}h</span>}
                      </div>
                      <div style={S.lancVals}>
                        <span style={S.lancLucro}>{fmt(calcLucro(c))}</span>
                        <span style={S.lancBruto}>{fmt(c.ganho)}</span>
                        <span style={S.lancKm}>{c.km}km</span>
                        <button style={S.delBtn} onClick={() => del("corridas", c.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ DESPESAS ══ */}
        {tab === 2 && (
          <div style={S.page}>
            <div style={S.sec}>Despesas fixas do mês</div>
            <div style={S.formCard}>
              <FR l="Mês"><select style={S.inp} value={fD.mes} onChange={e => setFD(f => ({ ...f, mes: e.target.value }))}>{[-2,-1,0].map(o => { const m = getMes(o); return <option key={m} value={m}>{nomeMes(m)}</option>; })}</select></FR>
              <FR l="Despesa"><input style={S.inp} placeholder="Ex: Seguro, Revisão, Financiamento" value={fD.nome} onChange={e => setFD(f => ({ ...f, nome: e.target.value }))} /></FR>
              <FR l="Valor (R$)"><input style={S.inp} type="number" placeholder="Ex: 150.00" value={fD.valor} onChange={e => setFD(f => ({ ...f, valor: e.target.value }))} /></FR>
              <button style={S.btn} onClick={addDesp}>＋ Adicionar despesa</button>
            </div>
            {despMes.length > 0 && (<>
              <div style={S.sec}>Despesas em {nomeMes(mesSel)}</div>
              {despMes.map(x => (<div key={x.id} style={S.despRow}><span style={S.despNome}>{x.nome}</span><div style={S.despRight}><span style={S.despVal}>{fmt(x.valor)}</span><button style={S.delBtn} onClick={() => del("despesasFixas", x.id)}>✕</button></div></div>))}
              <div style={S.despTotal}><span>Total</span><span>{fmt(totalDesp)}</span></div>
            </>)}

            <div style={S.sec}>Abastecimento</div>
            <div style={S.formCard}>
              <FR l="Data"><input style={S.inp} type="date" value={fA.data} onChange={e => setFA(f => ({ ...f, data: e.target.value }))} /></FR>
              <FR l="Litros"><input style={S.inp} type="number" step="0.01" placeholder="Ex: 30.5" value={fA.litros} onChange={e => setFA(f => ({ ...f, litros: e.target.value }))} /></FR>
              <FR l="Valor total (R$)"><input style={S.inp} type="number" placeholder="Ex: 180.00" value={fA.valor} onChange={e => setFA(f => ({ ...f, valor: e.target.value }))} /></FR>
              <FR l="KM do odômetro"><input style={S.inp} type="number" placeholder="Ex: 45820" value={fA.kmOdometro} onChange={e => setFA(f => ({ ...f, kmOdometro: e.target.value }))} /></FR>
              <button style={S.btn} onClick={addAbast}>＋ Registrar abastecimento</button>
            </div>
            {abastMes.length > 0 && (<>
              <div style={S.sec}>Abastecimentos do mês</div>
              <div style={S.row3}>
                <MC label="Total gasto" value={fmt(totalAbast)} />
                <MC label="Litros" value={`${totalLitros.toFixed(1)}L`} />
                <MC label="Km/litro" value={kmPorLitro > 0 ? kmPorLitro.toFixed(1) : "—"} />
              </div>
              {abastMes.map(a => (<div key={a.id} style={S.despRow}><div><div style={S.despNome}>{new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</div><div style={{ fontSize: 12, color: "#64748b" }}>{a.litros}L{a.kmOdometro > 0 ? ` · ${a.kmOdometro}km` : ""}</div></div><div style={S.despRight}><span style={S.despVal}>{fmt(a.valor)}</span><button style={S.delBtn} onClick={() => del("abastecimentos", a.id)}>✕</button></div></div>))}
            </>)}
          </div>
        )}

        {/* ══ HISTÓRICO ══ */}
        {tab === 3 && (
          <div style={S.page}>
            <div style={S.sec}>Comparativo mensal</div>
            {[-5,-4,-3,-2,-1,0].map(o => {
              const m = getMes(o);
              const cs = d.corridas.filter(c => c.data.startsWith(m));
              const ds = d.despesasFixas.filter(x => x.mes === m);
              const lb = cs.reduce((s, c) => s + c.ganho, 0);
              const lo = cs.reduce((s, c) => s + calcLucro(c), 0);
              const df = ds.reduce((s, x) => s + x.valor, 0);
              const ll = lo - df;
              if (cs.length === 0 && ds.length === 0) return null;
              const pct = Math.min((ll / d.config.metaMensal) * 100, 100);
              return (
                <div key={m} style={{ ...S.histCard, ...(m === mesSel ? S.histAtivo : {}) }} onClick={() => { setMesSel(m); setTab(0); }}>
                  <div style={S.histTop}><span style={S.histNome}>{nomeMes(m)}</span><span style={S.histLucro}>{fmt(ll)}</span></div>
                  <div style={S.progBg}><div style={{ ...S.progBar, width: `${pct}%`, background: pct >= 100 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#3b82f6" }} /></div>
                  <div style={S.histSub}>Bruto {fmt(lb)} · {cs.length} dias · {pct.toFixed(0)}% da meta</div>
                </div>
              );
            })}
            {d.corridas.length === 0 && <div style={S.empty}>Nenhum histórico ainda.</div>}
          </div>
        )}

        {/* ══ CONFIG ══ */}
        {tab === 4 && (
          <div style={S.page}>
            <div style={S.sec}>Plataformas e comissões</div>
            <div style={S.formCard}>
              {platsEx.map((p, i) => (
                <div key={i} style={S.platRow}>
                  <span style={S.platNome}>{p.nome}</span>
                  <div style={S.platRight}>
                    <input style={S.platInp} type="number" value={p.comissao} onChange={e => updatePlatCom(i, e.target.value)} />
                    <span style={{ color: "#94a3b8", fontSize: 13 }}>%</span>
                    <button style={S.platDel} onClick={() => removePlat(i)}>✕</button>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #334155" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Adicionar plataforma</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...S.inp, flex: 2 }} placeholder="Nome" value={novaPlat.nome} onChange={e => setNovaPlat(n => ({ ...n, nome: e.target.value }))} />
                  <input style={{ ...S.inp, flex: 1 }} placeholder="%" type="number" value={novaPlat.comissao} onChange={e => setNovaPlat(n => ({ ...n, comissao: e.target.value }))} />
                  <button style={S.addBtn} onClick={addPlat}>＋</button>
                </div>
              </div>
            </div>

            <div style={S.sec}>Configurações gerais</div>
            <div style={S.formCard}>
              <FR l="Custo por km (R$)"><input style={S.inp} type="number" step="0.01" value={cfgEx.custoPorKm} onChange={e => setCfgForm({ ...(cfgForm || d.config), custoPorKm: parseFloat(e.target.value) })} /><div style={S.hint}>Combustível + desgaste + manutenção</div></FR>
              <FR l="Meta mensal de lucro (R$)"><input style={S.inp} type="number" value={cfgEx.metaMensal} onChange={e => setCfgForm({ ...(cfgForm || d.config), metaMensal: parseFloat(e.target.value) })} /></FR>
            </div>
            {hasChanges && <button style={{ ...S.btn, marginTop: 14 }} onClick={saveCfg}>💾 Salvar alterações</button>}

            <div style={S.infoBox}>
              <div style={S.infoT}>Conectar ao Supabase (nuvem)</div>
              <div style={S.infoTxt}>
                Para salvar dados na nuvem, edite o topo do arquivo e substitua:<br /><br />
                <code style={S.code}>SUPABASE_URL = "https://xxxx.supabase.co"</code><br />
                <code style={S.code}>SUPABASE_KEY = "sua-chave-anon-aqui"</code><br /><br />
                Crie a tabela <b>motorista_dados</b> com colunas: <b>user_id</b> (text, primary key) e <b>dados</b> (text).
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={S.botNav}>
        {TABS.map((t, i) => (
          <button key={t} style={{ ...S.navBtn, ...(tab === i ? S.navActive : {}) }} onClick={() => setTab(i)}>
            <span style={{ fontSize: 17 }}>{ICONS[i]}</span>
            <span style={S.navLbl}>{t}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Card({ label, value, grad }) { return <div style={{ ...S.card, ...grad }}><div style={S.cardLbl}>{label}</div><div style={S.cardVal}>{value}</div></div>; }
function MC({ label, value }) { return <div style={S.miniCard}><div style={S.miniLbl}>{label}</div><div style={S.miniVal}>{value}</div></div>; }
function FR({ l, children }) { return <div style={S.fRow}><label style={S.lbl}>{l}</label>{children}</div>; }
function PR({ l, v, red, total, green }) {
  return <div style={{ ...S.prevRow, ...(total ? S.prevTotal : {}) }}><span style={{ color: total ? "#f1f5f9" : "#94a3b8" }}>{l}</span><span style={{ color: red ? "#f87171" : green ? "#34d399" : "#f1f5f9", fontWeight: total ? 700 : 400 }}>{v}</span></div>;
}

const S = {
  root: { fontFamily: "'Segoe UI',system-ui,sans-serif", background: "#0f172a", minHeight: "100vh", maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column", color: "#f1f5f9" },
  header: { background: "linear-gradient(135deg,#1e3a5f,#1e293b)", padding: "12px 16px", borderBottom: "1px solid #334155" },
  hInner: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  logo: { display: "flex", alignItems: "center", gap: 8 },
  logoT: { fontSize: 15, fontWeight: 700, color: "#f8fafc" },
  logoS: { fontSize: 11, color: "#94a3b8" },
  demoBadge: { background: "#f59e0b", color: "#000", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99 },
  savedBadge: { background: "#22c55e", color: "#fff", fontSize: 11, padding: "3px 8px", borderRadius: 20, fontWeight: 700 },
  logoutBtn: { background: "none", border: "1px solid #334155", borderRadius: 8, padding: "5px 10px", color: "#64748b", fontSize: 12, cursor: "pointer" },
  content: { flex: 1, overflowY: "auto", paddingBottom: 68 },
  page: { padding: "10px 12px 8px" },
  sec: { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, marginTop: 12 },
  mesSel: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1e293b", borderRadius: 10, padding: "8px 12px", marginBottom: 2, border: "1px solid #334155" },
  mesBtn: { background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer", padding: "0 6px" },
  mesNome: { fontSize: 13, fontWeight: 700, color: "#f1f5f9", textTransform: "capitalize" },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 },
  row3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 7 },
  card: { borderRadius: 11, padding: "11px 13px" },
  cFull: { borderRadius: 11, padding: "11px 13px", marginBottom: 7, background: "#1e3a5f" },
  cGreen:  { background: "linear-gradient(135deg,#064e3b,#065f46)" },
  cBlue:   { background: "linear-gradient(135deg,#1e3a8a,#1e40af)" },
  cRed:    { background: "linear-gradient(135deg,#7f1d1d,#991b1b)" },
  cPurple: { background: "linear-gradient(135deg,#4c1d95,#5b21b6)" },
  cSlate:  { background: "linear-gradient(135deg,#1e293b,#334155)" },
  cTeal:   { background: "linear-gradient(135deg,#134e4a,#115e59)" },
  cardLbl: { fontSize: 10, color: "#cbd5e1", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
  cardVal: { fontSize: 17, fontWeight: 800, color: "#f8fafc" },
  miniCard: { background: "#1e293b", borderRadius: 9, padding: "9px 10px", border: "1px solid #334155" },
  miniLbl: { fontSize: 9, color: "#64748b", fontWeight: 600, textTransform: "uppercase", marginBottom: 3 },
  miniVal: { fontSize: 15, fontWeight: 700, color: "#f1f5f9" },
  metaCard: { background: "#1e293b", borderRadius: 11, padding: 12, marginBottom: 7, border: "1px solid #334155" },
  metaTop: { display: "flex", justifyContent: "space-between", marginBottom: 7 },
  metaLbl: { fontSize: 11, fontWeight: 600, color: "#94a3b8" },
  metaVals: { fontSize: 11, fontWeight: 700, color: "#f1f5f9" },
  progBg: { background: "#334155", borderRadius: 99, height: 6, overflow: "hidden" },
  progBar: { height: "100%", borderRadius: 99, transition: "width 0.5s ease" },
  metaInfo: { fontSize: 11, color: "#64748b", marginTop: 5 },
  rankRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", borderRadius: 11, padding: "11px 13px", marginBottom: 6, border: "1px solid #334155" },
  rankLeft: { display: "flex", alignItems: "center", gap: 9 },
  rankPos: { fontSize: 17, fontWeight: 900, color: "#475569", minWidth: 22 },
  rankNome: { fontSize: 13, fontWeight: 700, color: "#f1f5f9" },
  rankSub: { fontSize: 11, color: "#64748b", marginTop: 1 },
  rankRight: { textAlign: "right" },
  rankLucro: { fontSize: 14, fontWeight: 800, color: "#34d399" },
  rankBruto: { fontSize: 11, color: "#64748b" },
  exportBtn: { width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 11, padding: 11, color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 6 },
  empty: { textAlign: "center", color: "#475569", fontSize: 13, padding: "28px 16px", lineHeight: 1.6 },
  formCard: { background: "#1e293b", borderRadius: 12, padding: 13, border: "1px solid #334155" },
  fRow: { marginBottom: 11 },
  lbl: { display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 },
  inp: { width: "100%", background: "#0f172a", border: "1.5px solid #334155", borderRadius: 9, padding: "10px 12px", color: "#f1f5f9", fontSize: 14, outline: "none", boxSizing: "border-box" },
  hint: { fontSize: 11, color: "#475569", marginTop: 3 },
  comBadge: { background: "#1d4ed820", border: "1px solid #3b82f640", borderRadius: 7, padding: "4px 9px", fontSize: 11, color: "#93c5fd", marginTop: 4 },
  preview: { background: "#0f172a", borderRadius: 9, padding: 11, marginBottom: 11, border: "1px solid #22c55e33" },
  prevT: { fontSize: 11, fontWeight: 700, color: "#34d399", marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.5 },
  prevRow: { display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 },
  prevTotal: { borderTop: "1px solid #334155", paddingTop: 6, marginTop: 2, fontSize: 13 },
  divider: { height: 1, background: "#334155", margin: "2px 0" },
  btn: { width: "100%", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", border: "none", borderRadius: 9, padding: 12, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 2 },
  diaCard: { background: "#1e293b", borderRadius: 11, marginBottom: 7, border: "1px solid #334155", overflow: "hidden" },
  diaHeader: { display: "flex", alignItems: "center", padding: "11px 13px", cursor: "pointer", gap: 8 },
  diaNome: { fontSize: 13, fontWeight: 700, color: "#f1f5f9", textTransform: "capitalize" },
  diaSub: { fontSize: 11, color: "#64748b", marginTop: 1 },
  diaRight: { flex: 1, textAlign: "right" },
  diaLucro: { fontSize: 14, fontWeight: 800, color: "#34d399" },
  diaBruto: { fontSize: 11, color: "#64748b" },
  diaChev: { fontSize: 11, color: "#475569" },
  lancRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 13px", borderTop: "1px solid #0f172a", background: "#162032" },
  lancInfo: { display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" },
  lancPlat: { background: "#3b82f620", color: "#60a5fa", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99 },
  lancNum: { background: "#f59e0b20", color: "#fbbf24", fontSize: 10, padding: "2px 6px", borderRadius: 99 },
  lancHora: { background: "#22c55e20", color: "#4ade80", fontSize: 10, padding: "2px 6px", borderRadius: 99 },
  lancVals: { display: "flex", alignItems: "center", gap: 7 },
  lancLucro: { fontSize: 13, fontWeight: 700, color: "#34d399" },
  lancBruto: { fontSize: 11, color: "#64748b" },
  lancKm: { fontSize: 11, color: "#475569" },
  delBtn: { background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 12, padding: "2px 3px" },
  despRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1e293b", borderRadius: 9, padding: "10px 13px", marginBottom: 5, border: "1px solid #334155" },
  despNome: { fontSize: 13, fontWeight: 600, color: "#e2e8f0" },
  despRight: { display: "flex", alignItems: "center", gap: 9 },
  despVal: { fontSize: 13, fontWeight: 700, color: "#f87171" },
  despTotal: { display: "flex", justifyContent: "space-between", padding: "9px 13px", fontSize: 13, fontWeight: 700, color: "#f1f5f9", borderTop: "1px solid #334155" },
  platRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #334155" },
  platNome: { fontSize: 13, fontWeight: 600, color: "#e2e8f0" },
  platRight: { display: "flex", alignItems: "center", gap: 5 },
  platInp: { width: 52, background: "#0f172a", border: "1.5px solid #334155", borderRadius: 7, padding: "5px 7px", color: "#f1f5f9", fontSize: 13, outline: "none", textAlign: "center" },
  platDel: { background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13, padding: "2px 4px" },
  addBtn: { background: "#1d4ed8", border: "none", borderRadius: 9, padding: "10px 13px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", flexShrink: 0 },
  histCard: { background: "#1e293b", borderRadius: 11, padding: "11px 13px", marginBottom: 7, border: "1px solid #334155", cursor: "pointer" },
  histAtivo: { border: "1px solid #3b82f6", background: "#1e3a5f" },
  histTop: { display: "flex", justifyContent: "space-between", marginBottom: 7 },
  histNome: { fontSize: 13, fontWeight: 700, color: "#f1f5f9", textTransform: "capitalize" },
  histLucro: { fontSize: 14, fontWeight: 800, color: "#34d399" },
  histSub: { fontSize: 11, color: "#64748b", marginTop: 4 },
  infoBox: { background: "#1e293b", borderRadius: 11, padding: 13, border: "1px solid #334155", marginTop: 12 },
  infoT: { fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 },
  infoTxt: { fontSize: 12, color: "#94a3b8", lineHeight: 1.8 },
  code: { background: "#0f172a", borderRadius: 5, padding: "2px 6px", fontSize: 11, color: "#34d399", display: "block", marginBottom: 4 },
  botNav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#1e293b", borderTop: "1px solid #334155", display: "flex", zIndex: 100 },
  navBtn: { flex: 1, background: "none", border: "none", padding: "8px 0 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  navActive: { background: "#0f172a" },
  navLbl: { fontSize: 9, color: "#64748b", fontWeight: 600 },
};
