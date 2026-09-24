import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStripe } from "@stripe/stripe-react-native";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, View } from "react-native";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { LabeledRow } from "@/components/molecules/labeled-row";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Body, Eyebrow, Text, Title } from "@/components/ui/text";
import { useAppStore, type MixId } from "@/stores/app-store";

const termsUrl = process.env.EXPO_PUBLIC_INVESTMENT_TERMS_URL;
function reviewCosts() {
  if (!termsUrl) return Alert.alert("Costs unavailable", "Set EXPO_PUBLIC_INVESTMENT_TERMS_URL to review investment costs and terms.");
  void WebBrowser.openBrowserAsync(termsUrl);
}

function matchesMix(weights: { symbol: string; bps: number }[], mix: MixId) {
  const bySymbol = new Map(weights.map(({ symbol, bps }) => [symbol, bps]));
  if (mix === "market") return weights.length === 1 && bySymbol.get("SPYx") === 10_000;
  if (mix === "tech") return weights.length === 2 && bySymbol.get("NVDAx") === 5_000 && bySymbol.get("AAPLx") === 5_000;
  return weights.length === 3 && bySymbol.get("SPYx") === 4_000 && bySymbol.get("NVDAx") === 3_000 && bySymbol.get("AAPLx") === 3_000;
}

export default function PlanScreen() {
  return Constants.appOwnership === "expo" ? <ExpoGoPlan /> : <NativePlan />;
}

function ExpoGoPlan() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const editing = mode === "edit";
  const amount = useAppStore((s) => s.draftAmount);
  const mix = useAppStore((s) => s.draftMix);
  const displayMix = mix === "balanced" ? "A bit of both" : mix === "market" ? "The whole market" : "Big tech";
  return <ReviewContent
    amount={amount}
    mix={displayMix}
    paymentMethod={editing ? "Preview" : "Add securely"}
    accountChecks="Preview"
    action={editing ? "Update weekly plan" : "Start my weekly pile"}
    onAction={() => router.replace(editing ? "/weekly-plan" : "/funding")}
    preview
    editing={editing}
  />;
}

function NativePlan() {
  const { mode, planId } = useLocalSearchParams<{ mode?: string; planId?: string }>();
  const editing = mode === "edit" && Boolean(planId);
  const setPlan = useAppStore((s) => s.setPlan); const amount = useAppStore((s) => s.draftAmount); const mix = useAppStore((s) => s.draftMix);
  const queryClient = useQueryClient();
  const persisted = useQuery({ queryKey: ["current-plan"], queryFn: api.currentPlan }); const plan = persisted.data?.plan; const { initPaymentSheet, presentPaymentSheet } = useStripe();
  useEffect(() => {
    if (!editing && plan?.status === "pending_payment") router.replace("/funding");
    else if (!editing && (plan?.status === "live" || plan?.status === "paused")) router.replace("/home");
  }, [editing, plan?.status]);
  const start = useMutation({ mutationFn: async () => {
    if (!persisted.isSuccess) throw new Error("Weekly plan status is unavailable. Try again in a moment.");
    if (!termsUrl) throw new Error("Investment costs and terms must be configured before a plan can start.");
    if (editing) {
      if (!plan || plan.id !== planId || plan.status !== "live") throw new Error("The active plan changed; return to your weekly plan and try again.");
      return { plan: (await api.changePlan(plan.id, amount, mix, plan.updatedAt)).plan, mode: "changed" as const };
    }
    const activePlan = plan?.status === "draft" && plan.amountUsd === amount && matchesMix(plan.weights, mix) ? plan : (await api.createPlan(amount, mix)).plan;
    setPlan(activePlan);
    const checkout = await api.activatePlan(activePlan.id);
    if (checkout.mode === "live") {
      if (!checkout.clientSecret || !checkout.ephemeralKey) throw new Error("Payment setup is incomplete");
      const initialized = await initPaymentSheet({ merchantDisplayName: "Pileup", paymentIntentClientSecret: checkout.clientSecret, customerId: checkout.customerId, customerEphemeralKeySecret: checkout.ephemeralKey, returnURL: "pileup://stripe-redirect" });
      if (initialized.error) throw new Error(initialized.error.message);
      const presented = await presentPaymentSheet();
      if (presented.error) throw new Error(presented.error.message);
    }
    return { plan: activePlan, mode: checkout.mode };
  }, onSuccess: ({ plan: activePlan, mode }) => {
    setPlan(mode === "changed" ? activePlan : { ...activePlan, status: mode === "demo" ? "live" : "pending_payment" });
    void queryClient.invalidateQueries({ queryKey: ["current-plan"] });
    router.replace(mode === "changed" ? "/weekly-plan" : "/funding");
  } });
  const displayAmount = amount; const displayMix = mix === "balanced" ? "A bit of both" : mix === "market" ? "The whole market" : "Big tech";
  return <ReviewContent amount={displayAmount} mix={displayMix} paymentMethod={editing ? "On file" : "Add securely"} accountChecks="Signed in" action={start.isPending ? editing ? "Updating…" : "Starting…" : editing ? "Update weekly plan" : "Start my weekly pile"} onAction={() => start.mutate()} disabled={start.isPending || !persisted.isSuccess} error={start.error?.message ?? persisted.error?.message} editing={editing} />;
}
function ReviewContent({ amount, mix, paymentMethod, accountChecks, action, onAction, disabled, error, preview = false, editing = false }: { amount: number; mix: string; paymentMethod: string; accountChecks: string; action: string; onAction: () => void; disabled?: boolean; error?: string; preview?: boolean; editing?: boolean }) {
  return <Screen className="pt-0" footer={<Button disabled={disabled} onPress={onAction}>{action}</Button>}>
    <View className="pt-[60px]">
      <Eyebrow className="tracking-normal">{editing ? "REVIEW CHANGES" : "4 OF 4 · REVIEW"}</Eyebrow>
      <Title className="mt-3 text-[36px] font-semibold leading-[47px]">One small{"\n"}weekly habit.</Title>
      <View className="mt-3">
        <LabeledRow label="Every week" value={`$${amount}`} />
        <LabeledRow label="Your mix" value={mix} />
        <LabeledRow label="First collection" value={editing ? "Next billing day" : "Today"} />
        <LabeledRow label="Payment method" value={paymentMethod} />
        <LabeledRow label="Account checks" value={accountChecks} />
        <LabeledRow label="Investment terms" value="Review costs →" onPress={reviewCosts} />
      </View>
      <Body className="mt-3 text-[14px] leading-[18px]">{editing ? preview ? "Preview only. Your new amount and mix would apply to future weekly collections; no payment is made in Expo Go." : "Your new amount and mix apply to future weekly collections. No payment is taken now." : preview ? `Preview only. No $${amount} payment or investment is made in Expo Go.` : `By starting, you authorize $${amount} today, then $${amount} each week. You can change or pause your plan.`}</Body>
      <Text className="mt-3 text-[13px] text-pile-muted">Investments can rise and fall in value.</Text>
      {error ? <Text className="mt-4 text-sm">{error}</Text> : null}
    </View>
  </Screen>;
}
