"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import Chave from "@/components/Chave";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { num, dataCurta } from "@/lib/formato";

type Pendente = {
  etiqueta: string; pessoas: number; conversoes: number;
  primeira: string; ultima: string; sugestao: string | null;
};
type Regra = { id: number; etiqueta: string; produto_id: string };
type Produto = { id: string; nome: string };

export default function Etiquetas({ admin, embutido }: { admin: boolean; embutido?: boolean }) {
  const { volta, em, minutos } = useAtualizacao();
  const [lista, setLista] = useState<Pendente[] | null>(null);
  const [regras, setRegras] = useState<Regra[] | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [aviso, setAviso] = useState("");
  const [tudo, setTudo] = useState(false);

  function carregar() {
    supabase.rpc("painel_etiquetas_pendentes", { p_desde: "2026-01-01", p_minimo: tudo ? 1 : 5 })
      .then(({ data }) => setLista((data as Pendente[]) ?? []));
    supabase.from("etiqueta_regras").select("id,etiqueta,produto_id").order("etiqueta")
      .then(({ data }) => setRegras((data as Regra[]) ?? []));
  }

  useEffect(() => {
    supabase.from("produtos").select("id,nome").order("ordem")
      .then(({ data }) => setProdutos((data as Produto[]) ?? []));
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volta, tudo]);

  async function apontar(etiqueta: string, produto: string) {
    const { error } = await supabase.from("etiqueta_regras").insert({ etiqueta, produto_id: produto });
    setAviso(error ? error.message : `"${etiqueta}" passou a valer como ${nomeProduto(produto)}.`);
    if (!error) carregar();
  }

  async function remover(id: number) {
    const { error } = await supabase.from("etiqueta_regras").delete().eq("id", id);
    setAviso(error ? error.message : "Regra removida.");
    if (!error) carregar();
  }

  const nomeProduto = (id: string) => produtos.find((p) => p.id === id)?.nome ?? id;
  const conversoes = lista?.reduce((s, e) => s + Number(e.conversoes), 0) ?? 0;

  return (
    <>
      {!embutido && (
        <>
          <div className="rotulo">Etiquetas</div>
          <h1>Etiqueta para curso</h1>
          <p className="carimbo num">
            Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
          </p>
        </>
      )}

      <div className="faixa">
        <div>
          <div className="rotulo">Etiquetas sem curso</div>
          <div className="valor num">{lista ? num(lista.length) : "..."}</div>
        </div>
        <div>
          <div className="rotulo">Conversões presas nelas</div>
          <div className="valor num">{lista ? num(conversoes) : "..."}</div>
        </div>
        <div>
          <div className="rotulo">Regras já apontadas</div>
          <div className="valor num">{regras ? num(regras.length) : "..."}</div>
        </div>
      </div>

      <h2><span className="idx" /> Esperando a sua decisão</h2>
      <p className="nota">
        Etiquetas que chegam do RD e ainda não têm curso apontado.
        <Ajuda titulo="Por que a etiqueta importa"
          fontes={["Etiquetas: RD Station Marketing",
                   "A regra apontada aqui fica guardada no painel"]}>
          A etiqueta é o sinal mais barato que existe na base: vem preenchida em quase toda conversão e é o
          próprio marketing que escreve. Apontar uma etiqueta para um curso classifica de uma vez todo lead que
          a carrega.
        </Ajuda>
      </p>
      <div className="filtros">
        <div className="atalhos">
        <div className="chaves-filtro">
        <Chave ligada={tudo} aoMudar={setTudo}
               ajuda="Desligado, mostra só etiqueta com 5 ou mais leads. Ligado, mostra a cauda inteira.">
          Mostrar também os de pouco volume
        </Chave>
        </div>
        </div>
      </div>

      {!lista ? <p className="rotulo">Carregando</p> : lista.length === 0 ? (
        <p className="mudo">Nenhuma etiqueta pendente. Tudo apontado.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead>
              <tr>
                <th>Etiqueta</th><th className="n">Pessoas</th><th className="n">Conversões</th>
                <th>Período</th>{admin && <th>Curso</th>}
              </tr>
            </thead>
            <tbody>
              {lista.map((e) => (
                <tr key={e.etiqueta}>
                  <td style={{ maxWidth: 320, wordBreak: "break-word" }}>
                    <b>{e.etiqueta}</b>
                    {e.sugestao && <div className="rotulo">parece {nomeProduto(e.sugestao)}</div>}
                  </td>
                  <td className="n">{num(e.pessoas)}</td>
                  <td className="n"><b>{num(e.conversoes)}</b></td>
                  <td className="mudo num">{dataCurta(e.primeira)} a {dataCurta(e.ultima)}</td>
                  {admin && (
                    <td>
                      <select
                        defaultValue=""
                        onChange={(ev) => {
                          if (!ev.target.value) return;
                          apontar(e.etiqueta, ev.target.value);
                          ev.target.value = "";
                        }}
                      >
                        <option value="">escolher</option>
                        {produtos.map((p) => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {aviso && <div className="aviso ok" style={{ marginTop: 12 }}>{aviso}</div>}

      <h2><span className="idx" /> Regras já apontadas</h2>
      {!regras ? <p className="rotulo">Carregando</p> : regras.length === 0 ? (
        <p className="mudo">Nenhuma regra de etiqueta cadastrada.</p>
      ) : (
        <div className="rolar">
          <table className="tabela">
            <thead><tr><th>Etiqueta</th><th>Curso</th>{admin && <th />}</tr></thead>
            <tbody>
              {regras.map((r) => (
                <tr key={r.id}>
                  <td style={{ wordBreak: "break-word" }}>{r.etiqueta}</td>
                  <td>{nomeProduto(r.produto_id)}</td>
                  {admin && <td><button className="btn claro" onClick={() => remover(r.id)}>Tirar</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="rodape">
        A etiqueta do RD é o quarto degrau da classificação de curso.
        <Ajuda titulo="A ordem da conferência, degrau por degrau">
          O painel tenta nesta ordem e para no primeiro que responde, então o que foi classificado por um
          degrau acima não é reclassificado por um de baixo:
          <br />1. a regra apontada à mão nesta tela e em A classificar;
          <br />2. a regra do formulário que a pessoa preencheu;
          <br />3. o nome da campanha no CRM;
          <br />4. a etiqueta do RD Station;
          <br />5. o anúncio pelo qual a pessoa chegou;
          <br />6. a primeira mensagem que ela mandou no WhatsApp;
          <br />7. a etiqueta do Pigeon, pelo histórico de troca de etiqueta, porque ela não fica no contato;
          <br />8. o que a pessoa comprou, que só vale para quem já fechou.
          <br /><br />
          O dono do contato segue a mesma lógica: primeiro o dono da negociação no CRM, depois a etiqueta de
          dono no Pigeon, depois quem atendeu a conversa.
        </Ajuda>
      </p>
    </>
  );
}
