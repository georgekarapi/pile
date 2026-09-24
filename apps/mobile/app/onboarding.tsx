import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight, Check } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { WeeklyAmountSlider } from "@/components/molecules/weekly-amount-slider";
import { WeeklyForecast } from "@/components/organisms/weekly-forecast";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Body, Eyebrow, Text, Title } from "@/components/ui/text";
import { useAppStore, type MixId } from "@/stores/app-store";

type MixOption = {
  id: MixId;
  title: string;
  detail: string;
  tag?: string;
  holdings?: string;
  isPartner?: boolean;
};

const mixes: MixOption[] = [
  {
    id: "prestocks",
    title: "Pre-IPO Giants",
    detail: "OpenAI, SpaceX & Anthropic",
    tag: "POWERED BY PRESTOCKS",
    isPartner: true,
    holdings: "40% OpenAI · 30% SpaceX · 30% Anthropic"
  },
  {
    id: "balanced",
    title: "A bit of both",
    detail: "Big tech + the whole market",
    holdings: "40% SPY · 30% NVDA · 30% AAPL"
  },
  {
    id: "market",
    title: "The whole market",
    detail: "A little of almost everything",
    holdings: "100% S&P 500 ETF"
  },
  {
    id: "tech",
    title: "Big tech",
    detail: "A focused, bumpier pile",
    holdings: "50% NVDA · 50% AAPL"
  }
];

export default function Onboarding() {
  const { mode, planId, signedIn } = useLocalSearchParams<{ mode?: string; planId?: string; signedIn?: string }>();
  const [step, setStep] = useState<1 | 2>(1);
  const amount = useAppStore((s) => s.draftAmount);
  const mix = useAppStore((s) => s.draftMix);
  const setDraft = useAppStore((s) => s.setDraft);
  const { height } = useWindowDimensions();
  const topInset = Math.max(44, Math.min(64, height - 780));
  const changeAmount = useCallback((draftAmount: number) => setDraft({ draftAmount }), [setDraft]);

  return <Screen className="pt-0" footer={<Button onPress={() => step === 1 ? setStep(2) : mode === "edit" && planId ? router.push({ pathname: "/plan", params: { mode: "edit", planId } }) : signedIn === "1" ? router.push("/plan") : router.push("/sign-in")}><View className="w-full flex-row items-center justify-between"><Text className="font-semibold text-white">{step === 1 ? "Choose my mix" : "Save my pile"}</Text><ArrowRight size={21} color="#FAFAF8" /></View></Button>}>
    <View style={{ paddingTop: topInset }}>
      <Eyebrow className="text-[12px] tracking-normal">{step} OF 4 · {step === 1 ? "AMOUNT" : "MIX"}</Eyebrow>
      <Title className="mt-[20px] text-[34px] font-semibold leading-[42px]">{step === 1 ? "Choose your\nweekly amount." : "What goes\nin your pile?"}</Title>
      <Body className="mt-[6px] max-w-[320px] text-[14px] leading-[18px]">{step === 1 ? "Slide to see how a small weekly habit could grow over time." : "Choose a simple mix. Tap a choice to see the holdings and costs."}</Body>
      {step === 1 ? <>
        <View className="mt-[28px]"><WeeklyForecast amountUsd={amount} /></View>
        <Eyebrow className="mt-[30px] text-[12px] tracking-normal">EACH WEEK</Eyebrow>
        <View className="mt-[5px] flex-row items-end"><Text className="text-[62px] font-semibold leading-[75px]">${amount}</Text><Text className="mb-[10px] ml-7 text-[15px] text-pile-muted">every week</Text></View>
        <View className="mt-[13px]"><WeeklyAmountSlider amountUsd={amount} onChange={changeAmount} /></View>
      </> : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} className="mt-[24px]">
        <View className="gap-[14px]">
          {mixes.map((option, index) => <MixChoice key={option.id} option={option} stones={3 + (index === 0 ? 1 : index === 2 ? 1 : index === 3 ? -1 : 0)} selected={mix === option.id} onPress={() => setDraft({ draftMix: option.id })} />)}
        </View>
      </ScrollView>}
    </View>
  </Screen>;
}

function MixChoice({ option, stones, selected, onPress }: { option: MixOption; stones: number; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} className={`min-h-[110px] w-full rounded-[22px] p-5 ${selected ? "bg-pile-ink" : "bg-pile-fog"}`}>
    <View className="flex-row items-center gap-2">
      <Text className={`text-[17px] font-semibold ${selected ? "text-pile-paper" : "text-pile-ink"}`}>{option.title}</Text>
      {option.tag ? (
        <View className={`rounded-full px-2 py-0.5 ${selected ? "bg-[#CED25F]" : "bg-pile-stone"}`}>
          <Text className={`text-[9px] font-bold tracking-wider ${selected ? "text-pile-ink" : "text-pile-paper"}`}>{option.tag}</Text>
        </View>
      ) : null}
    </View>
    <Text className={`mt-[6px] text-[13px] ${selected ? "text-pile-stone" : "text-pile-muted"}`}>{option.detail}</Text>
    {option.holdings ? (
      <Text className={`mt-[4px] text-[11px] font-medium ${selected ? "text-[#CED25F]" : "text-pile-muted"}`}>
        {option.holdings}
      </Text>
    ) : null}
    <View pointerEvents="none" className="absolute right-5 top-5 h-[76px] w-[80px]">
      {Array.from({ length: stones }, (_, index) => <View key={index} className="absolute h-[42px] w-[30px] rounded-full" style={{ right: 24 - index * 11, top: 21 - index * 7, transform: [{ rotate: index % 2 ? "8deg" : "-7deg" }], backgroundColor: selected ? (index === stones - 1 ? (option.isPartner ? "#CED25F" : "#BDBDB5") : "#D9D8D2") : "#D9D8D2" }} />)}
      {selected ? <View className="absolute right-0 top-[-5px] h-[26px] w-[26px] items-center justify-center rounded-full" style={{ backgroundColor: option.isPartner ? "#CED25F" : "#BDBDB5" }}><Check size={14} color="#111110" /></View> : null}
    </View>
  </Pressable>;
}
