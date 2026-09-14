import { useMutation } from "@tanstack/react-query";
import { CreditCard, LockKeyhole, Snowflake } from "lucide-react-native";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/stores/app-store";

export default function CardScreen() {
  const cardId = useAppStore((state) => state.cardId);
  const setCardId = useAppStore((state) => state.setCardId);
  const provision = useMutation({ mutationFn: api.card, onSuccess: ({ card }) => setCardId(card.bridgeCardAccountId) });
  const freeze = useMutation({ mutationFn: (frozen: boolean) => cardId ? api.freezeCard(cardId, frozen) : Promise.reject(new Error("No card")) });
  return <SafeAreaView className="flex-1 bg-zinc-950 px-6"><View className="py-8"><Badge tone="warning">BRIDGE SANDBOX</Badge><Text className="mt-4 text-3xl font-bold text-white">Your overflow card</Text><Card className="mt-8 h-52 justify-between bg-pile-700"><View className="flex-row justify-between"><Text className="text-lg font-bold text-white">PILEUP</Text><CreditCard color="white" /></View><Text className="text-xl tracking-widest text-white">•••• 4242</Text><View className="flex-row justify-between"><Text className="text-sm text-violet-100">USDC buffer</Text><Text className="text-sm text-violet-100">VIRTUAL</Text></View></Card><Text className="mt-4 text-sm leading-5 text-zinc-400">Sandbox card events are simulated. Live card spending is enabled only after Bridge program approval.</Text>{cardId ? <View className="mt-8 gap-3"><Button variant="secondary" disabled={freeze.isPending} onPress={() => freeze.mutate(true)}><Snowflake size={16} color="white" /><Text className="font-semibold text-white">Freeze card</Text></Button><Button variant="ghost" disabled={freeze.isPending} onPress={() => freeze.mutate(false)}><LockKeyhole size={16} color="white" /><Text className="font-semibold text-white">Unfreeze card</Text></Button></View> : <Button className="mt-8" disabled={provision.isPending} onPress={() => provision.mutate()}>{provision.isPending ? "Provisioning…" : "Complete KYC & provision card"}</Button>}{(provision.error || freeze.error) ? <Text className="mt-3 text-red-300">{(provision.error || freeze.error)?.message}</Text> : null}</View></SafeAreaView>;
}
