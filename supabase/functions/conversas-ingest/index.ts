// Porta de entrada das conversas com cliente.
// Entende o formato do Pigeon Post (eventType + content) e, para qualquer outro
// formato, cai no reconhecimento genérico. O corpo bruto é sempre guardado.
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

function normTel(t: unknown) {
  let d = soDigitos(t);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && "6789".includes(d[2])) d = d.slice(0, 2) + "9" + d.slice(2);
  return d.length >= 10 ? d : null;
}

function achar(obj: unknown, nomes: string[], profundidade = 0): unknown {
  if (!obj || typeof obj !== "object" || profundidade > 6) return null;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (nomes.includes(k.toLowerCase()) && v !== null && v !== "" && typeof v !== "object") return v;
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const achado = achar(v, nomes, profundidade + 1);
    if (achado !== null) return achado;
  }
  return null;
}

const texto = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s || null;
};

const quandoIso = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(isNaN(Number(v)) ? String(v) : Number(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

// Mensagem enviada pela empresa: o cliente é o destinatário.
// Mensagem recebida: o cliente é o remetente.
const ENVIADA = new Set(["MESSAGE_SENT", "MESSAGE_UPDATED"]);

type Linha = Record<string, unknown>;

// Formato do Pigeon Post. Devolve null quando o corpo não é desse formato.
function lerPigeon(c: any, origem: string): Linha | null {
  if (!c || typeof c !== "object" || typeof c.eventType !== "string" || !("content" in c)) return null;
  const tipo: string = c.eventType;
  const d = c.content ?? {};
  const det = d.details ?? {};

  const mensagem = tipo.startsWith("MESSAGE");
  const cliente = mensagem ? (ENVIADA.has(tipo) ? det.to : det.from) : null;

  const tel = cliente
    ?? det.to ?? det.from
    ?? d.contact?.phone ?? d.contact?.number
    ?? achar(c, ["phone", "whatsapp", "number", "telefone", "celular"]);

  return {
    origem,
    evento: tipo,
    conversa_id: texto(d.sessionId ?? (tipo.startsWith("SESSION") ? d.id : null) ?? d.session?.id),
    contato_id: texto(d.contactId ?? d.contact?.id ?? d.session?.contactId),
    email_norm: texto(d.contact?.email ?? achar(c, ["email", "mail"]))?.toLowerCase() ?? null,
    telefone_norm: normTel(tel),
    nome: texto(d.contact?.name ?? d.name ?? d.session?.contact?.name),
    canal: texto(d.channelId ?? d.channel?.name ?? d.channel?.id ?? d.session?.channelId),
    // Para mensagem, o sentido vem do próprio evento, que é inequívoco.
    // O campo direction do Pigeon fica guardado no corpo bruto.
    direcao: mensagem ? (ENVIADA.has(tipo) ? "saida" : "entrada") : texto(d.direction),
    atendente: texto(d.userId ?? d.user?.id ?? d.assignedUserId ?? d.session?.userId),
    ocorrido_em: quandoIso(d.timestamp ?? d.createdAt ?? d.finishedAt ?? c.date),
    corpo: c,
  };
}

function lerGenerico(c: any, origem: string): Linha {
  const email = texto(achar(c, ["email", "e_mail", "mail"]))?.toLowerCase() ?? null;
  return {
    origem,
    evento: texto(achar(c, ["evento", "event", "event_type", "eventtype"])),
    conversa_id: texto(achar(c, ["conversa_id", "conversation_id", "chat_id", "ticket_id", "session_id", "sessionid"])),
    contato_id: texto(achar(c, ["contato_id", "contact_id", "contactid", "customer_id", "lead_id"])),
    email_norm: email,
    telefone_norm: normTel(achar(c, ["telefone", "phone", "whatsapp", "number", "from", "to", "celular"])),
    nome: texto(achar(c, ["nome", "name", "contact_name", "pushname"])),
    canal: texto(achar(c, ["canal", "channel", "platform"])),
    direcao: texto(achar(c, ["direcao", "direction", "fromme", "is_from_me"])),
    atendente: texto(achar(c, ["atendente", "agent", "operator", "assigned_to", "userid"])),
    ocorrido_em: quandoIso(achar(c, ["ocorrido_em", "timestamp", "created_at", "createdat", "data", "date", "sent_at"])),
    corpo: c,
  };
}

function mapear(c: unknown, origem: string): Linha {
  return lerPigeon(c, origem) ?? lerGenerico(c, origem);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type, x-chave-painel",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  if (req.method !== "POST") return new Response("método não permitido", { status: 405 });

  const url = new URL(req.url);
  const chave = url.searchParams.get("chave") ?? req.headers.get("x-chave-painel") ?? "";
  const { data } = await db.rpc("credencial_obter", { p_servico: "webhook" });
  const esperada = data?.[0]?.access_token;
  if (!esperada || chave !== esperada) return new Response("não autorizado", { status: 401 });

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return new Response("corpo inválido", { status: 400 });
  }

  const origem = url.searchParams.get("origem") ?? "pigeon-post";
  const lista = Array.isArray(corpo) ? corpo : [corpo];
  const linhas = lista.map((c) => mapear(c, origem));

  const { error } = await db.from("conversas_eventos").insert(linhas);
  if (error) return Response.json({ ok: false, erro: error.message }, { status: 500 });
  // 200 sempre que o corpo foi guardado: o Pigeon reenvia quando não recebe 200.
  return Response.json({ ok: true, recebidos: linhas.length });
});
