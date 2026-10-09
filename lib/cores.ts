// As cores do gráfico vinham escritas à mão em cada tela, e por isso já tinham
// três pretos e dois cinzas diferentes rodando no mesmo site. Aqui é a fonte
// única, e os valores são exatamente os mesmos tokens do globals.css.
export const COR = {
  tinta: "#121211",
  tinta2: "#3E3D39",
  cinza: "#76746D",
  cinzaClaro: "#A8A59C",
  linha: "#12121222",
  lima: "#CFFF04",
  limaEscura: "#A8CF04",
  ok: "#1B7A42",
  alerta: "#96650C",
  ruim: "#B5301A",
} as const;

// Ordem de uso quando um gráfico tem mais de uma série. Primeiro a tinta, que é
// o número principal; depois o cinza, que é sempre a comparação.
export const SERIES = [COR.tinta, COR.cinza, COR.ruim, COR.limaEscura, COR.alerta] as const;
