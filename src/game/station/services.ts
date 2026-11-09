export const stationServices = [
  {
    id: "airlock",
    label: "Embarque",
    name: "Lina",
    color: 0x88ded8,
    dialogue: "Sua nave está pronta. Quer embarcar e desacoplar?",
  },
  {
    id: "market",
    label: "Mercado",
    name: "Nilo",
    color: 0xd4b079,
    dialogue: "Ei, amigo! Quer comprar ou vender seus itens?",
  },
  {
    id: "dealer",
    label: "Concessionária",
    name: "Iara",
    color: 0x9d9ddd,
    dialogue: "Buscando uma nave nova? Quer ver os modelos disponíveis?",
  },
  {
    id: "hangar",
    label: "Hangar",
    name: "Caio",
    color: 0x7ca8da,
    dialogue: "Cuido das naves guardadas aqui. Quer acessar sua frota?",
  },
  {
    id: "workshop",
    label: "Oficina",
    name: "Ravi",
    color: 0xe89767,
    dialogue:
      "Posso consertar seu casco ou abrir a bancada. Quer dar uma olhada?",
  },
  {
    id: "fuel",
    label: "Abastecimento",
    name: "Luma",
    color: 0x8dbb74,
    dialogue: "Precisa de combustível para o próximo salto? Quer abastecer?",
  },
  {
    id: "science",
    label: "Dados científicos",
    name: "Dra. Vega",
    color: 0x89d2ee,
    dialogue:
      "Andou catalogando planetas? Quer negociar seus dados científicos?",
  },
  {
    id: "contracts",
    label: "Contratos",
    name: "Suri",
    color: 0xc898c4,
    dialogue: "Chegaram novos trabalhos para pilotos. Quer ver os contratos?",
  },
  {
    id: "law",
    label: "Registro criminal",
    name: "Agente Sol",
    color: 0xa2b7ce,
    dialogue:
      "Piloto, quer consultar seu registro e verificar se há multas pendentes?",
  },
  {
    id: "clothing",
    label: "Vestuário",
    name: "Mira",
    color: 0xc591ad,
    dialogue:
      "Quer experimentar um visual novo? Tenho bonés, camisetas, calças, viseiras e capacetes. Dá uma olhada na coleção corsária.",
  },
  {
    id: "black-market",
    label: "Mercado clandestino",
    name: "Sombra",
    color: 0xb08098,
    dialogue: "Fale baixo. Quer negociar mercadoria fora do mercado oficial?",
  },
  {
    id: "pirate-clothing",
    label: "Trajes corsários",
    name: "Vesper",
    color: 0xdf816d,
    dialogue:
      "Quer vestir as cores da Bandeira Negra? Tenho peças exclusivas para quem viaja fora da lei.",
  },
] as const;

const standardOnly: ReadonlySet<StationService["id"]> = new Set([
  "market",
  "dealer",
  "science",
  "clothing",
]);
const standardServices = stationServices.filter(
  ({ id }) => id !== "black-market" && id !== "pirate-clothing",
);
const clandestineServices = stationServices.filter(
  ({ id }) => !standardOnly.has(id),
);

export function stationServicesFor(clandestine: boolean) {
  return clandestine ? clandestineServices : standardServices;
}

export type StationService = (typeof stationServices)[number];
