export type PreStockItem = {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url: string;
  contract_address: string;
  markPrice: number;
  markValuation: number;
  tokenPrice: number;
  impliedValuation: number;
  supply: number;
};

// Snapshot from live https://prestocks.com/api/prestocks as fallback
const FALLBACK_PRESTOCKS: PreStockItem[] = [
  {
    name: "OpenAI PreStocks",
    symbol: "OPENAI",
    description: "OpenAI pioneers large-language models like GPT and DALL·E, enabling advanced AI applications.",
    image: "https://www.prestocks.com/logos/openai.png",
    external_url: "https://www.prestocks.com/openai",
    contract_address: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
    markPrice: 1023.71,
    markValuation: 1268309849870,
    tokenPrice: 1320.05,
    impliedValuation: 1635455893748,
    supply: 2826.34
  },
  {
    name: "SpaceX PreStocks",
    symbol: "SPACEX",
    description: "SpaceX engineers reusable launch vehicles and Starlink satellite constellation for global broadband.",
    image: "https://www.prestocks.com/logos/spacex.png",
    external_url: "https://www.prestocks.com/spacex",
    contract_address: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    markPrice: 147.49,
    markValuation: 1933782150285,
    tokenPrice: 116.26,
    impliedValuation: 1524276714562,
    supply: 43712.53
  },
  {
    name: "Anthropic PreStocks",
    symbol: "ANTHROPIC",
    description: "Anthropic is an AI safety and research company developing Claude, a leading AI assistant.",
    image: "https://www.prestocks.com/logos/anthropic.png",
    external_url: "https://www.prestocks.com/anthropic",
    contract_address: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw",
    markPrice: 1037.99,
    markValuation: 1700578558020,
    tokenPrice: 1035.02,
    impliedValuation: 1695710638687,
    supply: 7381.80
  },
  {
    name: "Anduril PreStocks",
    symbol: "ANDURIL",
    description: "Anduril builds AI-driven defense systems, including autonomous drones and perimeter sensors.",
    image: "https://www.prestocks.com/logos/anduril.png",
    external_url: "https://www.prestocks.com/anduril",
    contract_address: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB",
    markPrice: 153.29,
    markValuation: 135612799183,
    tokenPrice: 162.86,
    impliedValuation: 144080176628,
    supply: 11805.82
  },
  {
    name: "Figure AI PreStocks",
    symbol: "FIGUREAI",
    description: "Figure AI builds general-purpose humanoid robots for homes and industrial work.",
    image: "https://www.prestocks.com/logos/figureai.png",
    external_url: "https://www.prestocks.com/figureai",
    contract_address: "PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd",
    markPrice: 180.59,
    markValuation: 39374164925,
    tokenPrice: 170.15,
    impliedValuation: 37096811358,
    supply: 3012.86
  },
  {
    name: "Kalshi PreStocks",
    symbol: "KALSHI",
    description: "Kalshi is a CFTC-regulated prediction market where users trade event contracts.",
    image: "https://www.prestocks.com/logos/kalshi.png",
    external_url: "https://www.prestocks.com/kalshi",
    contract_address: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua",
    markPrice: 881.31,
    markValuation: 32054989551,
    tokenPrice: 869.18,
    impliedValuation: 31613785575,
    supply: 904.87
  },
  {
    name: "Neuralink PreStocks",
    symbol: "NEURALINK",
    description: "Neuralink develops implantable brain-computer interfaces to restore independence and augment capabilities.",
    image: "https://www.prestocks.com/logos/neuralink.png",
    external_url: "https://www.prestocks.com/neuralink",
    contract_address: "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S",
    markPrice: 336.34,
    markValuation: 64070319210,
    tokenPrice: 432.52,
    impliedValuation: 82392047508,
    supply: 2595.27
  },
  {
    name: "Polymarket PreStocks",
    symbol: "POLYMARKET",
    description: "Polymarket is a decentralized prediction market for real-world events.",
    image: "https://www.prestocks.com/logos/polymarket.png",
    external_url: "https://www.prestocks.com/polymarket",
    contract_address: "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP",
    markPrice: 144.32,
    markValuation: 15025435608,
    tokenPrice: 146.69,
    impliedValuation: 15271867873,
    supply: 4816.94
  }
];

let cache: { data: PreStockItem[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

export async function fetchPreStocks(): Promise<PreStockItem[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://prestocks.com/api/prestocks", { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`PreStocks API HTTP ${res.status}`);
    const items = (await res.json()) as PreStockItem[];
    if (Array.isArray(items) && items.length > 0) {
      cache = { data: items, fetchedAt: now };
      return items;
    }
  } catch (err) {
    console.warn("PreStocks live fetch fallback:", err instanceof Error ? err.message : err);
  }

  return cache ? cache.data : FALLBACK_PRESTOCKS;
}
