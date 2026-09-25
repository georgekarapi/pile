import { describe, expect, it } from "vitest";
import { fetchPreStocks } from "./prestocks.js";

describe("fetchPreStocks", () => {
  it("returns prestocks list containing OpenAI, SpaceX, Anthropic, and Anduril with official mints", async () => {
    const list = await fetchPreStocks();
    expect(list.length).toBeGreaterThan(0);

    const openai = list.find((item) => item.symbol === "OPENAI");
    expect(openai).toBeDefined();
    expect(openai?.contract_address).toBe("PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF");

    const spacex = list.find((item) => item.symbol === "SPACEX");
    expect(spacex).toBeDefined();
    expect(spacex?.contract_address).toBe("PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh");

    const anthropic = list.find((item) => item.symbol === "ANTHROPIC");
    expect(anthropic).toBeDefined();
    expect(anthropic?.contract_address).toBe("Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw");

    const anduril = list.find((item) => item.symbol === "ANDURIL");
    expect(anduril).toBeDefined();
    expect(anduril?.contract_address).toBe("PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB");
  });
});
