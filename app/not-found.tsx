import Link from "next/link";

export default function NaoEncontrada() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--papel)" }}>
      <div style={{ maxWidth: 420, background: "var(--superficie)", borderRadius: "var(--raio)", boxShadow: "var(--sombra-alta)", padding: 32 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Página não encontrada</h1>
        <p style={{ margin: "0 0 20px", color: "var(--cinza)" }}>
          O endereço não existe ou mudou de lugar.
        </p>
        <Link href="/" style={{ color: "var(--tinta)", fontWeight: 700 }}>Voltar ao painel</Link>
      </div>
    </div>
  );
}
