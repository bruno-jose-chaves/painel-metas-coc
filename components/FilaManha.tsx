"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import { num, dataHora } from "@/lib/formato";

// Quem recebe a própria fila de manhã.
//
// O nome do dono muda de fonte para fonte: "Marcia" no WhatsApp e
// "Marcia  Laurett" no CRM são a mesma pessoa. Por isso cada pessoa guarda os
// outros nomes pelos quais ela aparece, e a tela já sugere quem está com
// trabalho parado e ainda não foi cadastrado.
type Pessoa = { id: number; nome: string; apelidos: string[]; telefone: string; ativo: boolean };
type Dono = { dono: string; quantos: number };
type Envio = { nome: string; itens: number; enviado_em: string };

const vazia = { nome: "", apelidos: "", telefone: "", ativo: true };

export default function FilaManha({ admin }: { admin: boolean }) {
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);
  const [faltando, setFaltando] = useState<Dono[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [form, setForm] = useState({ ...vazia });
  const [editando, setEditando] = useState<number | null>(null);
  const [previa, setPrevia] = useState<{ nome: string; texto: string } | null>(null);
  const [aviso, setAviso] = useState("");

  function carregar() {
    supabase.from("pessoas_fila").select("*").order("nome")
      .then(({ data }) => setPessoas((data as Pessoa[]) ?? []));
    supabase.rpc("fila_donos_sem_cadastro").then(({ data }) => setFaltando((data as Dono[]) ?? []));
    supabase.rpc("fila_ultimos_envios").then(({ data }) => setEnvios((data as Envio[]) ?? []));
  }

  useEffect(carregar, []);

  const apelidosDe = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const linha = {
      nome: form.nome.trim(),
      apelidos: apelidosDe(form.apelidos),
      telefone: form.telefone.replace(/\D/g, ""),
      ativo: form.ativo,
    };
    if (!linha.nome || linha.telefone.length < 10) {
      setAviso("Falta o nome ou o telefone com DDD.");
      return;
    }
    const { error } = editando
      ? await supabase.from("pessoas_fila").update(linha).eq("id", editando)
      : await supabase.from("pessoas_fila").insert(linha);
    if (error) { setAviso(error.message); return; }
    setForm({ ...vazia }); setEditando(null);
    setAviso(`${linha.nome} passa a receber a fila dela de manhã.`);
    carregar();
  }

  async function tirar(p: Pessoa) {
    if (!confirm(`Tirar ${p.nome} da fila de manhã? Ela para de receber a mensagem. O trabalho dela continua aparecendo no painel.`)) return;
    const { error } = await supabase.from("pessoas_fila").delete().eq("id", p.id);
    if (error) { setAviso(error.message); return; }
    setAviso(`${p.nome} saiu da lista e não recebe mais a fila.`);
    if (editando === p.id) { setEditando(null); setForm({ ...vazia }); }
    carregar();
  }

  async function verMensagem(nome: string) {
    setPrevia({ nome, texto: "Montando..." });
    const { data, error } = await supabase.rpc("fila_da_pessoa", { p_nome: nome });
    setPrevia({ nome, texto: error ? error.message : (data as string) ?? "Fila limpa. Esta pessoa não recebe mensagem hoje." });
  }

  async function enviarAgora() {
    setAviso("Enviando...");
    const { data, error } = await supabase.rpc("enviar_fila_manha", { p_so_teste: false });
    if (error) { setAviso(error.message); return; }
    const r = data as { enviados: number; sem_fila: number };
    setAviso(`Enviado para ${r.enviados} pessoa${r.enviados === 1 ? "" : "s"}. ${r.sem_fila} estava${r.sem_fila === 1 ? "" : "m"} com a fila limpa.`);
    carregar();
  }

  return (
    <>
      <h2><span className="idx" /> Fila de manhã</h2>
      <div className="bloco">
        <p style={{ marginTop: 0 }}>
          Toda manhã, às 8h30, de segunda a sexta, cada pessoa recebe no WhatsApp só o que está parado
          na mão dela, e a diretoria recebe o consolidado.
          <Ajuda titulo="Como a mensagem é montada"
            fontes={["A fila é a mesma de Comercial, O que está escapando",
                     "O envio usa o mesmo caminho da mensagem das 20h",
                     "Quem está com a fila limpa não recebe mensagem"]}>
            A mensagem traz, de cada tipo de problema, os três mais antigos, com nome, telefone, há
            quantos dias está parado e o que fazer, e diz quantos ficaram de fora. Quem está sem nada
            parado não recebe nada: mensagem vazia todo dia ensina o time a ignorar as que importam.
          </Ajuda>
        </p>

        {faltando.length > 0 && (
          <p className="aviso-leve ruim">
            Tem trabalho parado na mão de quem ainda não recebe a fila:{" "}
            {faltando.map((d) => `${d.dono} (${num(d.quantos)})`).join(", ")}.
            {admin && " Clique no nome abaixo para cadastrar."}
          </p>
        )}

        {admin && faltando.length > 0 && (
          <div className="atalhos" style={{ marginBottom: 12 }}>
            {faltando.map((d) => (
              <button key={d.dono} onClick={() => { setEditando(null); setForm({ ...vazia, nome: d.dono.replace(/\s+/g, " ").trim(), apelidos: d.dono }); }}>
                {d.dono} ({num(d.quantos)})
              </button>
            ))}
          </div>
        )}

        {!pessoas ? <p className="rotulo">Carregando</p> : pessoas.length === 0 ? (
          <p className="mudo">Ninguém cadastrado ainda. Enquanto isso, a fila só existe dentro do painel.</p>
        ) : (
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr><th>Pessoa</th><th>Também aparece como</th><th>WhatsApp</th><th>Recebe</th><th /></tr>
              </thead>
              <tbody>
                {pessoas.map((p) => (
                  <tr key={p.id} className={p.ativo ? undefined : "fora"}>
                    <td><b>{p.nome}</b></td>
                    <td className="mudo">{p.apelidos.join(", ") || "-"}</td>
                    <td className="num">{p.telefone}</td>
                    <td>
                      <span className={"selo " + (p.ativo ? "no_ritmo" : "encerrada")}>
                        {p.ativo ? "sim" : "não"}
                      </span>
                    </td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="btn claro" onClick={() => verMensagem(p.nome)}>Ver a mensagem</button>
                      {admin && (
                        <>
                          <button className="btn claro" onClick={() => {
                            setEditando(p.id);
                            setForm({ nome: p.nome, apelidos: p.apelidos.join(", "), telefone: p.telefone, ativo: p.ativo });
                          }}>Mudar</button>
                          <button className="btn claro" onClick={() => tirar(p)}>Tirar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {admin && (
          <form onSubmit={salvar} style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 14, alignItems: "end" }}>
            <label className="campo" style={{ margin: 0 }}><span className="rotulo">Pessoa</span>
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Marcia Laurett" /></label>
            <label className="campo" style={{ margin: 0 }}><span className="rotulo">Também aparece como</span>
              <input value={form.apelidos} onChange={(e) => setForm({ ...form, apelidos: e.target.value })}
                placeholder="Marcia, Marcia  Laurett" /></label>
            <label className="campo" style={{ margin: 0 }}><span className="rotulo">WhatsApp com DDD</span>
              <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="47999999999" /></label>
            <label className="campo" style={{ margin: 0 }}><span className="rotulo">Recebe a fila</span>
              <select value={form.ativo ? "sim" : "nao"} onChange={(e) => setForm({ ...form, ativo: e.target.value === "sim" })}>
                <option value="sim">Sim</option><option value="nao">Não</option>
              </select></label>
            <button className="btn">{editando ? "Salvar" : "Cadastrar"}</button>
            {editando && <button type="button" className="btn claro" onClick={() => { setEditando(null); setForm({ ...vazia }); }}>Cancelar</button>}
          </form>
        )}

        {aviso && <div className="aviso ok" style={{ marginTop: 12 }}>{aviso}</div>}

        {previa && (
          <div style={{ marginTop: 14 }}>
            <div className="rotulo">O que {previa.nome} recebe hoje</div>
            <pre className="previa">{previa.texto}</pre>
            <button className="btn claro" onClick={() => setPrevia(null)}>Fechar</button>
          </div>
        )}

        {admin && (pessoas?.length ?? 0) > 0 && (
          <p className="rodape" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn claro" onClick={enviarAgora}>Enviar agora, sem esperar amanhã</button>
            <span>
              Manda a mensagem de verdade para todo mundo que está com <b>Recebe: sim</b>. Para testar
              sem envolver o time, deixe só você na lista, ou ponha os outros em <b>Recebe: não</b>.
            </span>
          </p>
        )}

        {envios.length > 0 && (
          <>
            <div className="rotulo" style={{ marginTop: 16 }}>Últimos envios</div>
            <div className="rolar">
              <table className="tabela">
                <thead><tr><th>Pessoa</th><th className="n">Itens</th><th>Quando</th></tr></thead>
                <tbody>
                  {envios.map((e, i) => (
                    <tr key={i}>
                      <td>{e.nome}</td>
                      <td className="n">{e.itens ? num(e.itens) : "-"}</td>
                      <td className="mudo num">{dataHora(e.enviado_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
