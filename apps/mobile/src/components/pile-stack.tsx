import { Text, View } from "react-native";
import type { BasketWeight } from "@pile/shared";

const colors = ["bg-violet-400", "bg-fuchsia-400", "bg-indigo-300"];
export function PileStack({ weights, valueUsd, bufferUsd }: { weights: BasketWeight[]; valueUsd: number; bufferUsd: number }) {
  return <View className="h-72 justify-end overflow-hidden rounded-[32px] border border-white/10 bg-pile-950 p-5">
    <Text className="mb-auto text-sm text-violet-200">Your pile</Text>
    {weights.map((weight, index) => <View key={weight.mint} style={{ height: index === 0 ? 80 : 64 }} className={`mb-1 justify-center rounded-xl px-4 ${colors[index % colors.length]}`}>
      <Text className="font-bold text-pile-950">{weight.symbol} · {weight.bps / 100}%</Text>
    </View>)}
    <View className="mt-3 h-10 justify-center rounded-xl border border-dashed border-violet-200/60 bg-violet-300/15 px-4"><Text className="font-semibold text-violet-100">${bufferUsd.toFixed(2)} spendable overflow</Text></View>
    <Text className="mt-3 text-2xl font-bold text-white">${valueUsd.toFixed(2)}</Text>
  </View>;
}
