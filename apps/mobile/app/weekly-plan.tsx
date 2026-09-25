import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Alert, Pressable, View } from "react-native";
import { LabeledRow } from "@/components/molecules/labeled-row";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Body, Text, Title } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useAppStore, type MixId } from "@/stores/app-store";

export default function WeeklyPlan() {
  const preview = Constants.appOwnership === "expo";
  const { previewState } = useLocalSearchParams<{ previewState?: string }>();
  const storedPlan = useAppStore((s) => s.plan);
  const draftAmount = useAppStore((s) => s.draftAmount);
  const draftMix = useAppStore((s) => s.draftMix);
  const setDraft = useAppStore((s) => s.setDraft);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["current-plan"], queryFn: api.currentPlan, enabled: !preview });
  const optionsQuery = useQuery({ queryKey: ["plan-options"], queryFn: api.planOptions });
  const options = optionsQuery.data?.options;
  const plan = preview ? storedPlan : query.data?.plan ?? undefined;
  useEffect(() => {
    if (preview || !query.isSuccess) return;
    if (!plan) router.replace({ pathname: "/onboarding", params: { signedIn: "1" } });
    else if (plan.status === "draft") router.replace("/plan");
    else if (plan.status === "pending_payment" || plan.status === "blocked") router.replace("/funding");
  }, [preview, query.isSuccess, plan?.status]);
  const paused = plan?.status === "paused" || (preview && previewState === "paused");
  const amount = plan?.amountUsd ?? draftAmount;
  const matchedOption = options?.find((o) => {
    if (!plan) return o.id === draftMix;
    if (o.weights.length !== plan.weights.length) return false;
    const bySymbol = new Map(plan.weights.map((w) => [w.symbol, w.bps]));
    return o.weights.every((w) => bySymbol.get(w.symbol) === w.bps);
  });
  const mix = matchedOption?.title ?? (
    plan?.weights.some((w) => w.symbol === "OPENAI" || w.symbol === "SPACEX" || w.symbol === "ANTHROPIC" || w.symbol === "ANDURIL") || draftMix === "prestocks"
      ? "Pre-IPO Giants (PreStocks)"
      : plan?.weights.length === 1 || draftMix === "market"
        ? "The whole market"
        : plan?.weights.length === 2 || draftMix === "tech"
          ? "Big tech"
          : "A bit of both"
  );
  const pause = useMutation({ mutationFn: () => plan ? api.pausePlan(plan.id, plan.updatedAt) : Promise.reject(new Error("No weekly plan")), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["current-plan"] }); router.replace("/home"); } });
  const resume = useMutation({ mutationFn: () => plan ? api.resumePlan(plan.id, plan.updatedAt) : Promise.reject(new Error("No weekly plan")), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["current-plan"] }); } });
  const paymentMethod = useMutation({ mutationFn: async () => {
    const { url } = await api.paymentMethodSession();
    await WebBrowser.openBrowserAsync(url);
    return api.syncPaymentMethod();
  }, onSuccess: ({ changed }) => { void queryClient.invalidateQueries({ queryKey: ["current-plan"] }); Alert.alert(changed ? "Payment method updated" : "No changes made", changed ? "Future weekly collections will use your updated payment method." : "Your weekly payment method is the same."); } });
  const confirmPause = () => Alert.alert("Pause your weekly plan?", "Future weekly collections will stop. Your existing investments remain in your pile.", [{ text: "Keep plan", style: "cancel" }, { text: "Pause plan", onPress: () => pause.mutate() }]);
  const change = () => {
    if (preview || !plan) return router.push("/onboarding");
    if (plan.status !== "live") return Alert.alert("Plan unavailable", "A weekly plan must be active before it can be changed.");
    const matchedOption = options?.find((o) => {
      if (o.weights.length !== plan.weights.length) return false;
      const bySymbol = new Map(plan.weights.map((w) => [w.symbol, w.bps]));
      return o.weights.every((w) => bySymbol.get(w.symbol) === w.bps);
    });
    setDraft({
      draftAmount: plan.amountUsd,
      draftMix: (matchedOption?.id as MixId) ?? (
        plan.weights.some((w) => w.symbol === "OPENAI" || w.symbol === "SPACEX" || w.symbol === "ANTHROPIC" || w.symbol === "ANDURIL")
          ? "prestocks"
          : plan.weights.some((w) => w.symbol === "METAx" || w.symbol === "NFLXx")
            ? "faang"
            : plan.weights.some((w) => w.symbol === "GOOGLx" || w.symbol === "MSFTx")
              ? "bigfour"
              : plan.weights.length === 1
                ? "market"
                : plan.weights.length === 2
                  ? "tech"
                  : "bigfour"
      )
    });
    router.push({ pathname: "/onboarding", params: { mode: "edit", planId: plan.id } });
  };
  if (!preview && (!query.isSuccess || !plan || (plan.status !== "live" && plan.status !== "paused"))) {
    return <WeeklyPlanUnavailable loading={query.isPending || query.isSuccess} onRetry={() => void query.refetch()} />;
  }
  return <Screen className="pt-0" footerClassName="pb-[88px]" footer={paused ? <View className="gap-3"><Button disabled={resume.isPending} onPress={() => preview ? Alert.alert("Preview only", "No billing change is made in Expo Go.") : resume.mutate()}>{resume.isPending ? "Resuming…" : "Resume weekly plan"}</Button><Button variant="secondary" onPress={() => router.replace("/home")}>Return to my pile</Button></View> : <View className="gap-3"><Button onPress={change}>Change weekly amount</Button><Button variant="secondary" disabled={(!preview && (!plan || plan.status !== "live")) || pause.isPending} onPress={() => preview ? Alert.alert("Preview only", "No billing change is made in Expo Go.") : confirmPause()}>{pause.isPending ? "Pausing…" : "Pause my plan"}</Button></View>}>
    <View className="pt-[60px]">
      <Pressable onPress={() => router.back()}><Text className="text-[14px] text-pile-muted">←  Your pile</Text></Pressable>
      <Title className="mt-4 text-[36px] font-semibold leading-[47px]">Your weekly{"\n"}rhythm.</Title>
      <Text className="mt-4 text-[62px] font-semibold leading-[73px]">${amount}</Text>
      <Text className="mt-2 text-[16px] text-pile-muted">Every week</Text>
      <View className="mt-4"><LabeledRow label="Your mix" value={`${mix} →`} onPress={change} /><LabeledRow label="Next contribution" value={paused ? "Paused" : `Weekly · $${amount}`} /><LabeledRow label="Payment method" value={preview ? "Preview" : plan?.stripeSubscriptionId ? "On file →" : "Add securely →"} onPress={preview || paymentMethod.isPending ? undefined : () => paymentMethod.mutate()} /></View>
      <Body className="mt-4 text-[14px] leading-[21px]">{paused ? "Your weekly collections are paused. Your existing investments remain in your pile." : "Make it fit your life. Changing or pausing your plan affects future contributions."}</Body>
      {preview ? <Text className="mt-3 text-xs text-pile-muted">Sample plan · No payment changes are made.</Text> : null}
      {pause.error || resume.error || paymentMethod.error ? <Text className="mt-3 text-sm">{(pause.error || resume.error || paymentMethod.error)?.message}</Text> : null}
    </View>
  </Screen>;
}

function WeeklyPlanUnavailable({ loading, onRetry }: { loading: boolean; onRetry: () => void }) {
  return <Screen className="pt-0" footerClassName="pb-[120px]" footer={<Button disabled={loading} onPress={onRetry}>{loading ? "Checking…" : "Try again"}</Button>}>
    <View className="pt-[60px]">
      <Pressable onPress={() => router.replace("/home")}><Text className="text-[14px] text-pile-muted">←  Your pile</Text></Pressable>
      <Title className="mt-4 text-[36px] font-semibold leading-[47px]">Your weekly{"\n"}rhythm.</Title>
      <Text className="mt-4 text-[62px] font-semibold leading-[73px]">—</Text>
      <Text className="mt-2 text-[16px] text-pile-muted">Updating</Text>
      <View className="mt-4"><LabeledRow label="Your mix" value="—" /><LabeledRow label="Next contribution" value="—" /><LabeledRow label="Payment method" value="—" /></View>
      <Body className="mt-4 text-[14px] leading-[21px]">{loading ? "Finding your weekly plan. This only takes a moment." : "We cannot show your weekly plan right now. Try again in a moment."}</Body>
    </View>
  </Screen>;
}
