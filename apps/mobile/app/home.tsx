import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { CreditCard, HeartPulse, Settings2 } from "lucide-react-native";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HealthMeter } from "@/components/health-meter";
import { PileStack } from "@/components/pile-stack";
import { useAppStore } from "@/stores/app-store";

export default function Home() {
  const plan = useAppStore((state) => state.plan);
  const setPlan = useAppStore((state) => state.setPlan);
  const persistedPlan = useQuery({ queryKey: ["current-plan"], queryFn: api.currentPlan });
  const pile = useQuery({ queryKey: ["pile"], queryFn: api.pile, refetchInterval: 30_000 });
  useEffect(() => { if (persistedPlan.data?.plan) setPlan(persistedPlan.data.plan); }, [persistedPlan.data?.plan, setPlan]);
  const currentPlan = persistedPlan.data?.plan ?? plan;
  const health = pile.data?.health;
  const weights = currentPlan?.weights ?? [{ symbol: "SPYx", mint: "spy", bps: 4000 }, { symbol: "NVDAx", mint: "nvda", bps: 3000 }, { symbol: "AAPLx", mint: "aapl", bps: 3000 }];
  const mode = pile.data?.source ?? "demo";
  return <SafeAreaView className="flex-1 bg-zinc-950"><View className="flex-row items-center justify-between px-6 py-4"><View><Text className="text-sm text-zinc-400">Good morning</Text><Text className="text-2xl font-bold text-white">Your pile</Text></View><Badge tone={mode === "demo" ? "warning" : "success"}>{mode.toUpperCase()}</Badge></View><View className="gap-4 px-6"><PileStack weights={weights} valueUsd={health?.collateralUsd ?? 0} bufferUsd={health?.cardAvailableUsd ?? 0} /><Card><Text className="text-sm text-zinc-400">Spendable USDC</Text><Text className="mt-1 text-3xl font-bold text-white">${(health?.cardAvailableUsd ?? 0).toFixed(2)}</Text><Text className="mt-1 text-xs text-zinc-500">Available in your linked wallet, not remaining borrowing room.</Text></Card>{health ? <Card><HealthMeter ltvBps={health.currentLtvBps} ceilingBps={health.safeCeilingLtvBps} /></Card> : null}<View className="flex-row gap-3"><Button className="flex-1" variant="secondary" onPress={() => router.push("/plan")}><Settings2 size={16} color="white" /><Text className="font-semibold text-white">Plan</Text></Button><Button className="flex-1" variant="secondary" onPress={() => router.push("/card")}><CreditCard size={16} color="white" /><Text className="font-semibold text-white">Card</Text></Button><Button className="flex-1" variant="secondary" onPress={() => router.push("/health")}><HeartPulse size={16} color="white" /><Text className="font-semibold text-white">Health</Text></Button></View></View></SafeAreaView>;
}
