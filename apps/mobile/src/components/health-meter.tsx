import { Text, View } from "react-native";
export function HealthMeter({ ltvBps, ceilingBps }: { ltvBps: number; ceilingBps: number }) {
  const ratio = ceilingBps === 0 ? 0 : Math.min(1, ltvBps / ceilingBps);
  return <View><View className="mb-2 flex-row justify-between"><Text className="text-sm text-zinc-300">LTV health</Text><Text className="text-sm font-semibold text-white">{(ltvBps / 100).toFixed(1)}%</Text></View><View className="h-3 overflow-hidden rounded-full bg-white/10"><View className={`h-full rounded-full ${ratio > .85 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${ratio * 100}%` }} /></View><Text className="mt-2 text-xs text-zinc-400">Safe ceiling {(ceilingBps / 100).toFixed(1)}%</Text></View>;
}
