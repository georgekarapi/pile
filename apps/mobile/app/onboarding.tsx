import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight, Check } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { WeeklyAmountSlider } from "@/components/molecules/weekly-amount-slider";
import { WeeklyForecast } from "@/components/organisms/weekly-forecast";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Body, Eyebrow, Text, Title } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useAppStore, type MixId } from "@/stores/app-store";

type MixOption = {
  id: MixId;
  title: string;
  detail: string;
  tag?: string;
  holdings?: string;
  isPartner?: boolean;
  icons?: string[];
};

const fallbackMixes: MixOption[] = [
  {
    id: "bigfour",
    title: "The Big Four",
    tag: "TOP 4 xSTOCKS",
    detail: "World's 4 largest public companies",
    holdings: "25% NVDAx · 25% AAPLx\n25% GOOGLx · 25% MSFTx",
    icons: [
      "https://assets.parqet.com/logos/symbol/NVDA?format=png",
      "https://assets.parqet.com/logos/symbol/AAPL?format=png",
      "https://assets.parqet.com/logos/symbol/GOOGL?format=png",
      "https://assets.parqet.com/logos/symbol/MSFT?format=png"
    ]
  },
  {
    id: "prestocks",
    title: "Pre-IPO Giants",
    tag: "PRESTOCKS",
    isPartner: true,
    detail: "Top private unicorns before IPO",
    holdings: "35% OpenAI · 25% SpaceX\n25% Anthropic · 15% Anduril",
    icons: [
      "https://prestocks.com/logos/openai.png",
      "https://prestocks.com/logos/spacex.png",
      "https://prestocks.com/logos/anthropic.png",
      "https://prestocks.com/logos/anduril.png"
    ]
  },
  {
    id: "faang",
    title: "FAANG Basket",
    tag: "BLUE CHIP TECH",
    detail: "The 5 defining blue-chip tech titans",
    holdings: "20% METAx · 20% AAPLx\n20% AMZNx · NFLXx · GOOGLx",
    icons: [
      "https://assets.parqet.com/logos/symbol/META?format=png",
      "https://assets.parqet.com/logos/symbol/AAPL?format=png",
      "https://assets.parqet.com/logos/symbol/AMZN?format=png",
      "https://assets.parqet.com/logos/symbol/NFLX?format=png",
      "https://assets.parqet.com/logos/symbol/GOOGL?format=png"
    ]
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

  const optionsQuery = useQuery({ queryKey: ["plan-options"], queryFn: api.planOptions });
  const mixes: MixOption[] = optionsQuery.data?.options?.map((opt) => ({
    id: opt.id as MixId,
    title: opt.title,
    detail: opt.detail,
    tag: opt.tag,
    isPartner: opt.isPartner,
    icons: opt.icons ?? (opt.weights.map((w) => w.image).filter(Boolean) as string[]),
    holdings: opt.weights.map((w) => `${Math.round(w.bps / 100)}% ${w.symbol}`).join(" · ")
  })) ?? fallbackMixes;

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
          {mixes.map((option) => (
            <MixChoice
              key={option.id}
              option={option}
              selected={mix === option.id}
              onPress={() => setDraft({ draftMix: option.id })}
            />
          ))}
        </View>
      </ScrollView>}
    </View>
  </Screen>;
}

function MixChoice({ option, selected, onPress }: { option: MixOption; selected: boolean; onPress: () => void }) {
  const icons = option.icons ?? [];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-[128px] w-full rounded-[22px] p-5 ${selected ? "bg-pile-ink" : "bg-pile-fog"}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className={`text-[17px] font-semibold ${selected ? "text-pile-paper" : "text-pile-ink"}`}>
            {option.title}
          </Text>
          {option.tag ? (
            <View className={`rounded-full px-2 py-0.5 ${selected ? "bg-[#CED25F]" : "bg-pile-stone"}`}>
              <Text className={`text-[9px] font-bold tracking-wider ${selected ? "text-pile-ink" : "text-pile-paper"}`}>
                {option.tag}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Radio or active check badge */}
        {selected ? (
          <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-[#CED25F]">
            <Check size={13} color="#111110" strokeWidth={3} />
          </View>
        ) : (
          <View className="h-[22px] w-[22px] rounded-full border-[1.5px] border-pile-stone bg-white" />
        )}
      </View>

      <Text className={`mt-[6px] text-[13px] ${selected ? "text-pile-stone" : "text-pile-muted"}`}>
        {option.detail}
      </Text>

      <View className="mt-3 flex-row items-end justify-between">
        {option.holdings ? (
          <Text className={`max-w-[195px] text-[11px] font-medium leading-[15px] ${selected ? "text-[#CED25F]" : "text-pile-ink"}`}>
            {option.holdings}
          </Text>
        ) : <View />}

        {/* Stacked icon avatars */}
        {icons.length > 0 ? (
          <View className="flex-row items-center pl-2">
            {icons.map((url, idx) => (
              <View
                key={`${option.id}-icon-${idx}`}
                className={`h-[28px] w-[28px] overflow-hidden rounded-full border-2 bg-white ${
                  selected ? "border-pile-ink" : "border-[#EDECE6]"
                }`}
                style={{
                  marginLeft: idx === 0 ? 0 : -8,
                  zIndex: idx + 1,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 2
                }}
              >
                <Image
                  source={{ uri: url }}
                  className="h-full w-full rounded-full"
                  resizeMode="cover"
                />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
