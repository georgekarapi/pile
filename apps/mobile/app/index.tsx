import { router } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { ArrowRight, Layers3, ShieldCheck } from "lucide-react-native";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Welcome() {
  const { user } = usePrivy();
  return <SafeAreaView className="flex-1 bg-zinc-950 px-6"><View className="flex-1 justify-between py-10"><View><View className="mb-8 h-14 w-14 items-center justify-center rounded-2xl bg-pile-500"><Layers3 color="white" size={28} /></View><Text className="text-5xl font-bold tracking-tight text-white">Pileup</Text><Text className="mt-4 text-xl leading-8 text-zinc-300">Keep the pile.{"\n"}Spend the overflow.</Text></View><View className="gap-3"><Card><View className="flex-row gap-3"><ShieldCheck color="#A78BFA" /><Text className="flex-1 text-sm leading-5 text-zinc-300">Your xStocks remain yours. Your card spends a conservative USDC buffer.</Text></View></Card><Button onPress={() => router.push(user ? "/onboarding" : "/sign-in")}><Text className="font-semibold text-white">Build my pile</Text><ArrowRight size={16} color="white" /></Button><Text className="text-center text-xs leading-5 text-zinc-500">Demo only. Tokenized equities and lending carry risk.</Text></View></View></SafeAreaView>;
}
