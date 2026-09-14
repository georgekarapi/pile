import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { Check, Shield } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/stores/app-store";

const amounts = [30, 50, 100] as const;
export default function Onboarding() {
  const [amount, setAmount] = useState<30 | 50 | 100>(50);
  const setPlan = useAppStore((state) => state.setPlan);
  const create = useMutation({ mutationFn: () => api.createPlan(amount), onSuccess: ({ plan }) => { setPlan(plan); router.replace("/home"); } });
  return <SafeAreaView className="flex-1 bg-zinc-950 px-6"><View className="py-8"><Badge tone="neutral">STEP 1 OF 2</Badge><Text className="mt-4 text-3xl font-bold text-white">Set your weekly pile.</Text><Text className="mt-2 text-zinc-400">We buy the same 40/30/30 xStocks basket each funded cycle.</Text><View className="mt-8 flex-row gap-3">{amounts.map((value) => <Button key={value} variant={amount === value ? "primary" : "secondary"} className="flex-1" onPress={() => setAmount(value)}><Text className="font-semibold text-white">${value}</Text></Button>)}</View><Card className="mt-8 gap-4"><View className="flex-row items-center justify-between"><Text className="font-semibold text-white">SPYx</Text><Text className="text-zinc-300">40%</Text></View><View className="flex-row items-center justify-between"><Text className="font-semibold text-white">NVDAx</Text><Text className="text-zinc-300">30%</Text></View><View className="flex-row items-center justify-between"><Text className="font-semibold text-white">AAPLx</Text><Text className="text-zinc-300">30%</Text></View></Card><Card className="mt-4"><View className="flex-row gap-3"><Shield color="#A78BFA" /><Text className="flex-1 text-sm leading-5 text-zinc-300">Pileup targets a conservative LTV. It never automatically sells your collateral.</Text></View></Card><Button className="mt-8" disabled={create.isPending} onPress={() => create.mutate()}><Text className="font-semibold text-white">{create.isPending ? "Creating…" : "Continue"}</Text><Check size={16} color="white" /></Button>{create.error ? <Text className="mt-3 text-center text-red-300">{create.error.message}</Text> : null}</View></SafeAreaView>;
}
