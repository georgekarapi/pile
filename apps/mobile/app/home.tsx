import { useQuery } from "@tanstack/react-query";
import type { FundingCycle, Health, Plan } from "@pile/shared";
import Constants from "expo-constants";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight, ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { AppTabs } from "@/components/organisms/app-tabs";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Body, Eyebrow, Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useAppStore, type MixId } from "@/stores/app-store";

const money = (amount: number) => `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const selectedWeights: Record<MixId, { symbol: string; bps: number }[]> = {
  prestocks: [{ symbol: "OPENAI", bps: 4000 }, { symbol: "SPACEX", bps: 3000 }, { symbol: "ANTHROPIC", bps: 3000 }],
  balanced: [{ symbol: "SPYx", bps: 4000 }, { symbol: "AAPLx", bps: 3000 }, { symbol: "NVDAx", bps: 3000 }],
  market: [{ symbol: "SPYx", bps: 10_000 }],
  tech: [{ symbol: "AAPLx", bps: 5000 }, { symbol: "NVDAx", bps: 5000 }]
};
const mixName = (weights: { symbol: string; bps: number }[]) =>
  weights.some((w) => w.symbol === "OPENAI" || w.symbol === "SPACEX" || w.symbol === "ANTHROPIC")
    ? "Pre-IPO Giants (PreStocks)"
    : weights.length === 1
      ? "The whole market"
      : weights.length === 2
        ? "Big tech"
        : "A bit of both";
const mixColor: Record<string, string> = {
  OPENAI: "#10A37F",
  SPACEX: "#1E3A8A",
  ANTHROPIC: "#CC785C",
  ANDURIL: "#D97706",
  SPYx: "#111110",
  AAPLx: "#CED25F",
  NVDAx: "#777A67"
};

function pieSlice(start: number, sweep: number) {
  const point = (degrees: number) => ({ x: 32 + 32 * Math.cos(degrees * Math.PI / 180), y: 32 + 32 * Math.sin(degrees * Math.PI / 180) });
  const from = point(start);
  const to = point(start + sweep);
  return `M 32 32 L ${from.x} ${from.y} A 32 32 0 ${sweep > 180 ? 1 : 0} 1 ${to.x} ${to.y} Z`;
}

function MixPie({ weights }: { weights: { symbol: string; bps: number }[] }) {
  let angle = -90;
  return <Svg width={64} height={64} viewBox="0 0 64 64" accessibilityLabel="Selected weekly mix">
    {weights.length === 1 ? <Circle cx={32} cy={32} r={32} fill={mixColor[weights[0].symbol] ?? "#111110"} /> : weights.map(({ symbol, bps }) => {
      const sweep = 360 * bps / 10_000;
      const path = <Path key={symbol} d={pieSlice(angle, sweep)} fill={mixColor[symbol] ?? "#B7B9AA"} />;
      angle += sweep;
      return path;
    })}
  </Svg>;
}

function InvestmentCard({ health, preview }: { health?: Health; preview: boolean }) {
  const status = preview ? "Preview" : health?.status === "healthy" ? "Healthy" : health?.status === "warning" ? "Watchful" : health?.status === "critical" ? "Needs care" : "Updating";
  const fill = health && health.effectiveMaxLtvBps > 0 ? Math.min(100, Math.max(0, health.currentLtvBps / health.effectiveMaxLtvBps * 100)) : 0;
  const marker = health && health.effectiveMaxLtvBps > 0 ? Math.min(100, Math.max(0, health.safeCeilingLtvBps / health.effectiveMaxLtvBps * 100)) : 32.5;
  return <View className="mt-4 h-[214px] rounded-[24px] bg-pile-ink p-5">
    <View className="absolute right-5 top-4 rounded-full bg-pile-stone px-4 py-[5px]"><Text className="text-[11px] font-semibold">{status}</Text></View>
    <Text className="text-[10px] font-semibold text-pile-stone">INVESTMENT VALUE</Text>
    <Text className="mt-1 text-[32px] font-semibold leading-[40px] text-white">{health ? money(health.collateralUsd) : preview ? "$0.00" : "—"}</Text>
    <Text className="mt-1 max-w-[290px] text-[12px] leading-[16px] text-pile-stone">{preview ? "No investment has been made in this preview." : "Your pile can back card spending when eligible."}</Text>
    <View className="mt-[18px] h-[10px] rounded-full bg-[#FFFFFF26]"><View className="h-[10px] rounded-full bg-[#CED25F]" style={{ width: `${fill}%` }} /><View className="absolute top-[-23px] items-center" style={{ left: `${marker}%`, transform: [{ translateX: -23 }] }}><Text className="text-[10px] text-pile-stone">card limit</Text><View className="mt-1 h-[22px] w-[2px] bg-pile-stone" /></View></View>
    <View className="mt-[14px] flex-row justify-between"><View><Text className="text-[10px] font-semibold text-pile-stone">HEALTH LIMITER</Text><Text className="mt-1 text-[14px] text-white">{health ? `${money(health.debtUsd)} borrowed` : "No borrowing"}</Text></View><Text className="self-end text-[11px] text-pile-stone">{health?.status === "healthy" ? "within limit" : status.toLowerCase()}</Text></View>
  </View>;
}

function LatestContribution({ cycle, preview, paymentIssue }: { cycle?: FundingCycle | null; preview: boolean; paymentIssue?: boolean }) {
  const detail = paymentIssue ? "Weekly payment needs attention" : !cycle || preview ? "No contributions yet" : cycle.state === "complete" ? `Latest: ${money(cycle.expectedUsd)} contribution complete` : cycle.state === "needs_attention" ? "Contribution needs attention" : `${money(cycle.expectedUsd)} contribution in progress`;
  return <Pressable disabled={!cycle && !preview && !paymentIssue} onPress={() => router.push(paymentIssue ? (preview ? { pathname: "/payment-issue", params: { previewState: "payment_failed" } } : "/payment-issue") : (preview ? { pathname: "/funding" } : "/funding"))} className="mt-5 h-[58px] flex-row items-center rounded-[18px] border border-pile-stone px-4">
    <Text className="text-[20px]">◒</Text><Text className="ml-3 flex-1 text-[12px] font-semibold">{detail}</Text><ChevronRight size={18} color="#62625E" />
  </Pressable>;
}

export default function Home() {
  const preview = Constants.appOwnership === "expo";
  const { previewState } = useLocalSearchParams<{ previewState?: string }>();
  const storedPlan = useAppStore((s) => s.plan);
  const draftAmount = useAppStore((s) => s.draftAmount);
  const draftMix = useAppStore((s) => s.draftMix);
  const planQuery = useQuery({ queryKey: ["current-plan"], queryFn: api.currentPlan, enabled: !preview });
  const pileQuery = useQuery({ queryKey: ["pile"], queryFn: api.pile, refetchInterval: 30_000, enabled: !preview });
  const cycleQuery = useQuery({ queryKey: ["latest-funding-cycle"], queryFn: api.latestFundingCycle, enabled: !preview });
  const plan: Plan | undefined = preview ? storedPlan : planQuery.data?.plan ?? undefined;
  const weights = plan?.weights ?? selectedWeights[draftMix];
  const amount = plan?.amountUsd ?? draftAmount;
  const toPlan = () => router.push("/weekly-plan");
  const isPreviewPaymentIssue = preview && (previewState === "payment_issue" || previewState === "payment_failed");
  const hasPaymentIssue = (!preview && (plan?.status === "live" || plan?.status === "paused") && Boolean(plan?.paymentIssue)) || isPreviewPaymentIssue;
  return <Screen className="pt-0" footer={<AppTabs />} footerKind="tabs">
    <View className="pt-[60px]">
      <View className="h-8 flex-row items-center justify-between"><Text className="text-[14px] text-pile-muted">Good morning</Text><View className="h-8 w-8 items-center justify-center rounded-full bg-[#CED25F]"><View className="h-[5px] w-[5px] rounded-full bg-pile-ink" /></View></View>
      <InvestmentCard health={pileQuery.data?.health} preview={preview} />
      <View className="mt-[18px] h-[74px] flex-row items-center"><MixPie weights={weights} /><View className="ml-[18px] flex-1"><Eyebrow className="text-[10px] tracking-normal">YOUR WEEKLY MIX</Eyebrow><View className="mt-2 flex-row flex-wrap gap-y-1">{weights.map(({ symbol, bps }) => <View key={symbol} className="w-1/2 flex-row items-center"><View className="mr-1 h-2 w-2 rounded-full" style={{ backgroundColor: mixColor[symbol] ?? "#B7B9AA" }} /><Text className="text-[12px]">{symbol} {Math.round(bps / 100)}%</Text></View>)}</View></View></View>
      <Eyebrow className="mt-6 text-[10px] tracking-normal">WEEKLY PLAN</Eyebrow>
      <Pressable onPress={toPlan} className="mt-2 h-[98px] flex-row items-center justify-between rounded-[18px] bg-pile-fog px-5"><View><Text className="text-[20px] font-semibold">${amount} every week</Text><Text className="mt-2 text-[13px] text-pile-muted">{mixName(weights)} · Change plan</Text></View><ArrowRight size={22} color="#111110" /></Pressable>
      <LatestContribution cycle={cycleQuery.data?.cycle} preview={preview} paymentIssue={hasPaymentIssue} />
      <Button className="mt-[30px]" onPress={toPlan}><View className="w-full flex-row items-center justify-between"><Text className="font-semibold text-white">See weekly plan</Text><ArrowRight size={21} color="#FAFAF8" /></View></Button>
      {pileQuery.error ? <Body className="mt-3 text-xs">Investment value is unavailable right now.</Body> : null}
    </View>
  </Screen>;
}
