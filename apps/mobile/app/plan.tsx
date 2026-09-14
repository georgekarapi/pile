import { useMutation, useQuery } from "@tanstack/react-query";
import { useStripe } from "@stripe/stripe-react-native";
import { router } from "expo-router";
import { Pause, Play, ReceiptText } from "lucide-react-native";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/stores/app-store";

export default function PlanScreen() {
  const storedPlan = useAppStore((state) => state.plan);
  const setPlan = useAppStore((state) => state.setPlan);
  const persistedPlan = useQuery({ queryKey: ["current-plan"], queryFn: api.currentPlan });
  useEffect(() => { if (persistedPlan.data?.plan) setPlan(persistedPlan.data.plan); }, [persistedPlan.data?.plan, setPlan]);
  const plan = persistedPlan.data?.plan ?? storedPlan;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const activate = useMutation({ mutationFn: async () => {
    if (!plan) throw new Error("Create a plan first");
    const checkout = await api.activatePlan(plan.id);
    if (checkout.mode === "live") {
      if (!checkout.clientSecret || !checkout.ephemeralKey) throw new Error("Stripe checkout details missing");
      const initialized = await initPaymentSheet({ merchantDisplayName: "Pileup", paymentIntentClientSecret: checkout.clientSecret, customerId: checkout.customerId, customerEphemeralKeySecret: checkout.ephemeralKey, returnURL: "pileup://stripe-redirect" });
      if (initialized.error) throw new Error(initialized.error.message);
      const presented = await presentPaymentSheet();
      if (presented.error) throw new Error(presented.error.message);
    }
    return checkout;
  }, onSuccess: () => plan && setPlan({ ...plan, status: "live" }) });
  const pause = useMutation({ mutationFn: () => plan ? api.pausePlan(plan.id) : Promise.reject(new Error("Create a plan first")), onSuccess: () => plan && setPlan({ ...plan, status: "paused" }) });
  if (!plan) return <SafeAreaView className="flex-1 items-center justify-center bg-zinc-950 px-6"><Text className="text-white">No plan yet.</Text><Button className="mt-4" onPress={() => router.replace("/onboarding")}>Create plan</Button></SafeAreaView>;
  const active = plan.status === "live";
  return <SafeAreaView className="flex-1 bg-zinc-950 px-6"><View className="py-8"><Badge tone={active ? "success" : "warning"}>{plan.status.toUpperCase()}</Badge><Text className="mt-4 text-3xl font-bold text-white">Your weekly plan</Text><Card className="mt-6"><Text className="text-sm text-zinc-400">Contribution</Text><Text className="mt-1 text-4xl font-bold text-white">${plan.amountUsd}<Text className="text-base text-zinc-400"> / week</Text></Text><View className="mt-5 gap-3">{plan.weights.map((weight) => <View key={weight.mint} className="flex-row justify-between"><Text className="text-zinc-200">{weight.symbol}</Text><Text className="font-semibold text-white">{weight.bps / 100}%</Text></View>)}</View></Card><Card className="mt-4"><View className="flex-row gap-3"><ReceiptText color="#A78BFA" /><Text className="flex-1 text-sm leading-5 text-zinc-300">A successful test invoice starts a capped demo funding cycle. The purchase, collateral deposit, and borrow then run under your scoped wallet policy.</Text></View></Card>{active ? <Button className="mt-8" variant="secondary" disabled={pause.isPending} onPress={() => pause.mutate()}><Pause size={16} color="white" /><Text className="font-semibold text-white">Pause plan</Text></Button> : <Button className="mt-8" disabled={activate.isPending} onPress={() => activate.mutate()}><Play size={16} color="white" /><Text className="font-semibold text-white">Start subscription</Text></Button>}{(activate.error || pause.error) ? <Text className="mt-3 text-red-300">{(activate.error || pause.error)?.message}</Text> : null}</View></SafeAreaView>;
}
