"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Ajuda from "@/components/Ajuda";
import { useAtualizacao, horaCurta } from "@/lib/atualizacao";
import { brl, num, dataCurta } from "@/lib/formato";

// Cursos e produtos.
//
// 1.052 matrículas, quase um quinto do total, não pertenciam a produto nenhum
// porque o nome na planilha não batia com nenhuma expressão. Expressão em nome
// de curso erra: "Coc Aprova Med" e "COC APROVA MED" são o mesmo curso e já
// eram dois.
//
// Aqui cada nome aparece com para onde vai e por qual caminho, e o destino pode
// ser apontado na mão. O manual sempre ganha da regra. "Outros" não é balde:
// cada nome continua discriminado, com quantos e quanto.

type Curso = {
  curso: string; curso_norm: string; grafias: string | null;
  produto_id: string | null; produto: string | null;
  conta_aluno: boolean; origem: "apontado" | "regra" | "sem destino";
  vendas: number; faturamento: number; primeira: string; ultima: string; anos: string;
};
type Produto = { id: string; nome: string; ordem: number; conta_aluno: boolean };

const SELO: Record<string, string> = {
  apontado: "apontado na mão", regra: "pela regra", "sem destino": "sem destino",
};
const CLASSE: Record<string, string> = {
  apontado: "no_ritmo", regra: "", "sem destino": "atras",
};

export default function Cursos({ admin }: { admin: boolean }) {
  const { volta, em, minutos } = useAtualizacao();
  const [cursos, setCursos] = useState<Curso[] | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");

  const ler = () => {
    supabase.rpc("painel_cursos").then(({ data }) => setCursos((data as Curso[]) ?? []));
  };

  useEffect(() => {
    ler();
    supabase.from("produtos").select("id,nome,ordem,conta_aluno").order("ordem")
      .then(({ data }) => setProdutos((data as Produto[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volta]);

  async function apontar(curso: string, produto: string) {
    setSalvando(curso); setRecado(null);
    const { data, error } = await supabase.rpc("apontar_curso", { p_curso: curso, p_produto: produto });
    setSalvando(null);
    setRecado(error ? "Não deu para salvar: " + error.message : `${curso}: ${data}`);
    if (!error) ler();
  }

  const lista = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return (cursos ?? []).filter((c) =>
      !f || c.curso.toLowerCase().includes(f) || (c.produto ?? "").toLowerCase().includes(f));
  }, [cursos, filtro]);

  // Por produto, para a pessoa ver o tamanho de cada balde antes de mexer nos
  // nomes um a um.
  const porProduto = useMemo(() => {
    const m = new Map<string, { nome: string; nomes: number; vendas: number; fat: number; conta: boolean }>();
    for (const c of cursos ?? []) {
      const k = c.produto_id ?? "(sem destino)";
      const a = m.get(k) ?? { nome: c.produto ?? "Sem destino", nomes: 0, vendas: 0, fat: 0, conta: c.conta_aluno };
      a.nomes += 1; a.vendas += Number(c.vendas); a.fat += Number(c.faturamento);
      m.set(k, a);
    }
    return [...m.entries()];
  }, [cursos]);

  const semDestino = (cursos ?? []).filter((c) => c.origem === "sem destino").length;

  return (
    <>
      <div className="rotulo">Cursos e produtos</div>
      <h1>Para onde cada curso da planilha vai</h1>
      <p className="carimbo num">
        Dados de {horaCurta(em)}, atualiza sozinho a cada {minutos} minutos.
      </p>

      <p className="nota">
        Todo nome de curso que aparece na planilha, com o produto de destino e por qual caminho.
        <Ajuda titulo="Como o destino é resolvido"
          fontes={["Nomes de curso: a coluna Curso da planilha comercial",
                   "O que foi apontado à mão nesta tela",
                   "A regra automática pelo nome, cadastrada em cada produto",
                   "Material avulso não conta como aluno: marcado no cadastro do produto"]}>
          Primeiro o painel procura o nome no de-para manual. Se não achar, tenta as expressões de cada
          produto, na ordem. O manual sempre ganha da regra, então apontar aqui resolve de vez.
          Maiúscula, acento e espaço repetido são ignorados na comparação, por isso "Coc Aprova Med" e
          "COC APROVA MED" são o mesmo curso.
        </Ajuda>
      </p>

      {semDestino > 0 ? (
        <p className="aviso-leve">
          {semDestino} nome{semDestino > 1 ? "s" : ""} de curso ainda sem destino. Enquanto ficarem
          assim, essas matrículas não entram em nenhum produto e somem de qualquer tela filtrada.
        </p>
      ) : null}

      {!cursos ? <p className="rotulo">Carregando</p> : (
        <>
          <h2><span className="idx" /> O tamanho de cada produto</h2>
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="n">Nomes de curso</th>
                  <th className="n">Matrículas</th>
                  <th className="n">Faturamento</th>
                  <th>Conta como aluno</th>
                </tr>
              </thead>
              <tbody>
                {porProduto.map(([id, a]) => (
                  <tr key={id}>
                    <td><b>{a.nome}</b></td>
                    <td className="n">{num(a.nomes)}</td>
                    <td className="n">{num(a.vendas)}</td>
                    <td className="n">{brl(a.fat)}</td>
                    <td>
                      {a.conta
                        ? <span className="mudo">sim</span>
                        : <span className="selo atencao">não, é venda mas não é matrícula</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2><span className="idx" /> Cada nome, um a um</h2>
          <p className="nota">
            {admin
              ? "Trocar o produto reclassifica na hora todas as matrículas daquele nome."
              : "Só a diretoria pode apontar destino. Aqui a lista é de leitura."}
          </p>
          <div className="filtros">
            <label>
              <span className="rotulo">Procurar</span>
              <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)}
                     placeholder="nome do curso ou do produto" />
            </label>
          </div>
          {recado && <p className="aviso-leve">{recado}</p>}
          <div className="rolar">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Curso na planilha</th>
                  <th className="n">Matrículas</th>
                  <th className="n">Faturamento</th>
                  <th>Anos</th>
                  <th>Período</th>
                  <th>Caminho</th>
                  <th style={{ minWidth: 190 }}>Produto</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.curso_norm + c.curso} className={c.origem === "sem destino" ? "fora" : undefined}>
                    <td>
                      <b>{c.curso}</b>
                      {/* Mesma coisa escrita de jeitos diferentes na planilha.
                          Conta como um curso só e as grafias ficam à vista. */}
                      {c.grafias && <div className="ids">também aparece como: {c.grafias}</div>}
                    </td>
                    <td className="n">{num(c.vendas)}</td>
                    <td className="n">{brl(c.faturamento)}</td>
                    <td className="mudo num">{c.anos}</td>
                    <td className="mudo num">{dataCurta(c.primeira)} a {dataCurta(c.ultima)}</td>
                    <td>
                      <span className={"selo " + (CLASSE[c.origem] ?? "")}>{SELO[c.origem]}</span>
                    </td>
                    <td>
                      {admin ? (
                        <select
                          value={c.produto_id ?? ""}
                          disabled={salvando === c.curso}
                          onChange={(e) => apontar(c.curso, e.target.value)}
                        >
                          <option value="" disabled>escolher</option>
                          {/* Se o produto atual não estiver na lista, o navegador
                              mostraria em silêncio a primeira opção, e a pessoa
                              leria o destino errado. Então ele entra na lista. */}
                          {c.produto_id && !produtos.some((p) => p.id === c.produto_id) && (
                            <option value={c.produto_id}>{c.produto ?? c.produto_id}</option>
                          )}
                          {produtos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome}{p.conta_aluno === false ? " (não conta aluno)" : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>{c.produto ?? "-"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rodape">
            Produto sem venda em um ano simplesmente não aparece nas telas daquele ano, mas o histórico
            dele continua aqui e no Histórico entre anos. É o caso da Preparação ENEM, que não teve
            turma em 2025 e volta agora.
          </p>
        </>
      )}
    </>
  );
}
