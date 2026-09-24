import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, View } from "react-native";
import { AppTabs } from "@/components/organisms/app-tabs";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Body, Eyebrow, Text, Title } from "@/components/ui/text";
import { api } from "@/lib/api";

type RepaymentState = "available" | "healthy" | "no_funds" | "no_debt" | "unavailable";

export default function HealthScreen() {
  const preview = Constants.appOwnership === "expo";
  const { previewState } = useLocalSearchParams<{ previewState?: string }>();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["health"], queryFn: api.health, enabled: !preview, refetchInterval: 15_000 });
  const health = preview ? {
    debtUsd: previewState === "no_debt" ? 0 : 480,
    walletUsdcUsd: previewState === "no_funds" ? 0 : 120,
    status: previewState === "unavailable" ? "stale" : previewState === "healthy" || previewState === "no_debt" ? "healthy" : "warning"
  } : query.data;
  const repayAmount = health ? Math.floor(Math.min(health.debtUsd, health.walletUsdcUsd) * 100) / 100 : 0;
  const state: RepaymentState = !health || query.error || health.status === "stale" || preview && previewState === "unavailable" ? "unavailable"
    : health.debtUsd < 0.01 ? "no_debt"
    : repayAmount < 0.01 ? "no_funds"
    : health.status === "healthy" ? "healthy" : "available";
  const repay = useMutation({
    mutationFn: () => api.repay(repayAmount),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["health"] });
      void queryClient.invalidateQueries({ queryKey: ["pile"] });
    },
    onError: (error) => {
      void query.refetch();
      Alert.alert("Repayment could not finish", error.message);
    }
  });
  const available = state === "available" || state === "healthy";
  const title = state === "unavailable" ? "Checking your\nborrowing." : state === "no_debt" ? "No borrowing\nto pay back." : state === "no_funds" ? "No USDC ready\nto pay back." : state === "healthy" ? "Pay back a little\nwhen you like." : "Bring your pile\nback in range.";
  const statusTitle = state === "unavailable" ? "Balance temporarily unavailable" : state === "no_debt" ? "Your pile is in a good place" : state === "no_funds" ? "Your wallet has $0.00 USDC" : "Pay back what you can";
  const statusBody = state === "unavailable" ? "We cannot confirm available USDC yet." : state === "no_debt" ? "You do not owe anything right now." : state === "no_funds" ? "You can check your balance again later." : `You have $${repayAmount.toFixed(2)} USDC ready in your wallet.`;
  const explanation = state === "unavailable" ? "Refresh to see your current borrowing before making a repayment." : state === "no_debt" ? "Your card room can change as your pile changes." : state === "no_funds" ? "To repay, add USDC to your Pile wallet first." : "Paying back reduces your debt after the transaction confirms.";
  const risk = state === "unavailable" ? "Available card room shows $0 while balance data is stale." : state === "no_debt" ? "Investments can rise and fall in value." : state === "no_funds" ? "Card room stays at $0 until borrowing returns to the safe range." : state === "healthy" ? "Your available card room may change as your pile changes." : "Your card room updates when your borrowing returns to the safe range.";
  const action = state === "no_debt" ? "Back to my card" : available ? repay.isPending ? "Paying back…" : `Pay back $${repayAmount.toFixed(2)}` : "Refresh balance";
  const onAction = () => {
    if (state === "no_debt") return router.replace("/card");
    if (preview) return Alert.alert("Preview only", "Repayment requires the app build.");
    if (!available) return void query.refetch();
    repay.mutate();
  };

  return <Screen footer={<AppTabs />} footerKind="tabs" className="pt-0"><View className="pt-[50px]">
    <Eyebrow className="text-[12px] tracking-normal">CARD · BALANCE</Eyebrow>
    <Title className="mt-8 text-[36px] font-semibold leading-[47px]">{title}</Title>
    <View className="mt-4 rounded-[20px] bg-pile-fog p-[22px]"><Text className="text-[22px] font-semibold">{statusTitle}</Text><Body className="mt-3 text-[15px]">{statusBody}</Body></View>
    <View className="mt-4 flex-row justify-between py-[10px]"><Text className="text-[15px] text-pile-muted">Borrowed</Text><Text className="text-[15px] font-semibold">{state === "unavailable" ? "—" : `$${health!.debtUsd.toFixed(2)}`}</Text></View>
    <View className="mt-3 flex-row justify-between py-[10px]"><Text className="text-[15px] text-pile-muted">Available to repay</Text><Text className="text-[15px] font-semibold">{state === "unavailable" ? "—" : `$${repayAmount.toFixed(2)}`}</Text></View>
    <Body className="mt-4 text-[15px]">{explanation}</Body>
    <Body className="mt-4 text-[13px]">{risk}</Body>
    <Button className="mt-[126px]" disabled={repay.isPending || query.isFetching && !preview} onPress={onAction}>{action}</Button>
  </View></Screen>;
}
