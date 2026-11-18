"use client";

const caixa: React.CSSProperties = {
  minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--papel)",
};
const cartao: React.CSSProperties = {
  maxWidth: 420, background: "var(--superficie)", borderRadius: "var(--raio)",
  boxShadow: "var(--sombra-alta)", padding: 32,
};

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={caixa}>
      <div style={cartao}>
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Algo deu errado nesta tela</h1>
        <p style={{ margin: "0 0 20px", color: "var(--cinza)" }}>
          Os dados não foram alterados. Tente carregar de novo; se continuar, avise a diretoria.
        </p>
        <button onClick={reset} style={{
          background: "var(--lima)", color: "var(--tinta)", border: 0, borderRadius: "var(--raio-p)",
          padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>Tentar de novo</button>
      </div>
    </div>
  );
}
