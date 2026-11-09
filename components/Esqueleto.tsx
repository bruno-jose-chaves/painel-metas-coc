"use client";

// O lugar do dado enquanto ele não chega.
//
// Até aqui toda tela escrevia "Carregando" e deixava o resto em branco. Mesmo
// com o banco rápido, o branco faz a tela parecer parada: a pessoa não sabe se
// vem tabela, cartão ou gráfico, nem quanto espaço aquilo vai ocupar, e a
// página pula quando o conteúdo entra.
//
// O esqueleto resolve as duas coisas. Ele desenha a forma do que vem, então a
// espera parece curta, e ocupa a altura certa, então nada pula no lugar.
//
// Quem não quer animação na tela (preferência do sistema operacional) recebe o
// bloco parado: a informação é a forma, não o brilho.

type Tipo = "tabela" | "faixa" | "cartoes" | "grafico" | "linhas";

export default function Esqueleto({
  tipo = "tabela", linhas = 5, estilo,
}: { tipo?: Tipo; linhas?: number; estilo?: React.CSSProperties }) {
  const barra = (largura: string, altura = 13) => (
    <span className="ossinho" style={{ width: largura, height: altura }} />
  );

  if (tipo === "faixa") {
    return (
      <div className="esqueleto faixa" aria-busy="true" aria-label="Carregando" style={estilo}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            {barra("52%", 9)}
            {barra("72%", 22)}
            {barra("38%", 9)}
          </div>
        ))}
      </div>
    );
  }

  if (tipo === "cartoes") {
    return (
      <div className="esqueleto cards" aria-busy="true" aria-label="Carregando" style={estilo}>
        {Array.from({ length: 3 }, (_, i) => (
          <article className="card" key={i}>
            {barra("40%", 9)}
            {barra("78%", 18)}
            {barra("100%", 34)}
            {barra("60%", 11)}
          </article>
        ))}
      </div>
    );
  }

  if (tipo === "grafico") {
    return (
      <div className="esqueleto grafico-vazio" aria-busy="true" aria-label="Carregando" style={estilo}>
        <span className="ossinho bloco" />
      </div>
    );
  }

  if (tipo === "linhas") {
    return (
      <div className="esqueleto" aria-busy="true" aria-label="Carregando" style={estilo}>
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="esqueleto-linha">{barra(`${92 - i * 11}%`)}</div>
        ))}
      </div>
    );
  }

  // Tabela: uma linha de cabeçalho mais magra e as linhas de dado.
  return (
    <div className="esqueleto" aria-busy="true" aria-label="Carregando" style={estilo}>
      <div className="esqueleto-linha cabeca">
        {barra("18%", 9)}{barra("12%", 9)}{barra("12%", 9)}{barra("14%", 9)}
      </div>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="esqueleto-linha">
          {barra("26%")}{barra("10%")}{barra("10%")}{barra("16%")}
        </div>
      ))}
    </div>
  );
}
