import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowRight, Check, Info } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { WeeklyAmountSlider } from "@/components/molecules/weekly-amount-slider";
import { WeeklyForecast } from "@/components/organisms/weekly-forecast";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Body, Eyebrow, Text, Title } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useAppStore, type BundleId } from "@/stores/app-store";

function NoCardIcon({ size = 12, color = "#4A4842" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12.5 20h-2c-3.759 0-5.638 0-6.893-.99a4.4 4.4 0 0 1-.554-.523C2 17.307 2 15.537 2 12s0-5.306 1.053-6.487q.253-.284.554-.522C4.862 4 6.741 4 10.5 4h3c3.759 0 5.638 0 6.892.99q.302.24.555.523C21.896 6.577 21.99 8.118 22 11"
      />
      <Path
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        d="M2 9h20"
      />
      <Path
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        d="m22 14l-6 6m6 0l-6-6"
      />
    </Svg>
  );
}

type BundleOption = {
  id: BundleId;
  title: string;
  detail: string;
  tag?: string;
  holdings?: string;
  isPartner?: boolean;
  icons?: string[];
  collateralEligible?: boolean;
  notice?: string;
  noticeBadge?: string;
  noticeTooltip?: string;
  apy?: number;
};

const fallbackBundles: BundleOption[] = [
  {
    id: "bigfour",
    title: "The Big Four",
    tag: "TOP 4 xSTOCKS",
    detail: "World's 4 largest public companies",
    collateralEligible: true,
    apy: 15,
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
    tag: "POWERED BY PRESTOCKS",
    isPartner: true,
    detail: "Top private tech · High growth",
    collateralEligible: false,
    apy: 18,
    notice: "Pre-IPO equity cannot be used as collateral for card spending",
    noticeBadge: "NO CARD",
    noticeTooltip: "Pre-IPO equity is held directly in your self-custody Solana wallet. Kamino Lending currently has no reserves for private tech tokens, so they cannot back a card loan.",
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
    collateralEligible: true,
    apy: 13,
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
  const bundle = useAppStore((s) => s.draftBundle);
  const setDraft = useAppStore((s) => s.setDraft);
  const { height } = useWindowDimensions();
  const topInset = Math.max(44, Math.min(64, height - 780));
  const changeAmount = useCallback((draftAmount: number) => setDraft({ draftAmount }), [setDraft]);

  const optionsQuery = useQuery({ queryKey: ["plan-options"], queryFn: api.planOptions });
  const bundles: BundleOption[] = optionsQuery.data?.options?.map((opt) => ({
    id: opt.id as BundleId,
    title: opt.title,
    detail: opt.detail,
    tag: opt.tag,
    isPartner: opt.isPartner,
    icons: opt.icons ?? (opt.weights.map((w) => w.image).filter(Boolean) as string[]),
    holdings: opt.weights.map((w) => `${Math.round(w.bps / 100)}% ${w.symbol}`).join(" · "),
    collateralEligible: opt.collateralEligible ?? opt.id !== "prestocks",
    apy: opt.apy ?? (opt.id === "prestocks" ? 18 : opt.id === "bigfour" ? 15 : opt.id === "faang" ? 13 : 12),
    notice: opt.notice ?? (opt.id === "prestocks" ? "Pre-IPO equity cannot be used as collateral for card spending" : undefined),
    noticeBadge: opt.noticeBadge ?? (opt.id === "prestocks" ? "NO CARD" : undefined),
    noticeTooltip: opt.noticeTooltip ?? (opt.id === "prestocks" ? "Pre-IPO equity is held directly in your self-custody Solana wallet. Kamino Lending currently has no reserves for private tech tokens, so they cannot back a card loan." : undefined)
  })) ?? fallbackBundles;

  const selectedOption = bundles.find((m) => m.id === bundle) ?? bundles[0];

  return <Screen className="pt-0" footer={<Button onPress={() => step === 1 ? setStep(2) : mode === "edit" && planId ? router.push({ pathname: "/plan", params: { mode: "edit", planId } }) : signedIn === "1" ? router.push("/plan") : router.push("/sign-in")}><View className="w-full flex-row items-center justify-between"><Text className="font-semibold text-white">{step === 1 ? "Choose weekly amount" : "Save my pile"}</Text><ArrowRight size={21} color="#FAFAF8" /></View></Button>}>
    <View style={{ paddingTop: topInset }}>
      <Eyebrow className="text-[12px] tracking-normal">{step === 1 ? "PLAN" : "AMOUNT"}</Eyebrow>
      <Title className="mt-[20px] text-[34px] font-semibold leading-[42px]">{step === 1 ? "What goes\nin your pile?" : "Choose your\nweekly amount."}</Title>
      <Body className="mt-[6px] max-w-[320px] text-[14px] leading-[18px]">{step === 1 ? "Choose a bundle to see holdings, details, and expected avg APY." : `Slide to see how your ${selectedOption.title} pile could grow at ${selectedOption.apy}% avg APY.`}</Body>
      {step === 1 ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }} className="mt-[24px]">
          <View className="gap-[14px]">
            {bundles.map((option) => (
              <BundleChoice
                key={option.id}
                option={option}
                selected={bundle === option.id}
                onPress={() => setDraft({ draftBundle: option.id })}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <>
          <View className="mt-[28px]"><WeeklyForecast amountUsd={amount} apy={selectedOption.apy ?? 12} bundleTitle={selectedOption.title} /></View>
          <Pressable onPress={() => setStep(1)} className="mt-3.5 flex-row items-center gap-1 self-start active:opacity-70">
            <Text className="text-[13px] text-pile-muted">Bundle: <Text className="font-semibold text-pile-ink">{selectedOption.title}</Text> ({selectedOption.apy}% APY) · <Text className="underline">Change</Text></Text>
          </Pressable>
          <Eyebrow className="mt-[26px] text-[12px] tracking-normal">EACH WEEK</Eyebrow>
          <View className="mt-[5px] flex-row items-end"><Text className="text-[62px] font-semibold leading-[75px]">${amount}</Text><Text className="mb-[10px] ml-7 text-[15px] text-pile-muted">every week</Text></View>
          <View className="mt-[13px]"><WeeklyAmountSlider amountUsd={amount} onChange={changeAmount} /></View>
        </>
      )}
    </View>
  </Screen>;
}

function BundleChoice({ option, selected, onPress }: { option: BundleOption; selected: boolean; onPress: () => void }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const icons = option.icons ?? [];
  const isNoCollateral = option.collateralEligible === false;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-[132px] w-full rounded-[22px] p-5 ${selected ? "bg-pile-ink" : "bg-pile-fog"}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className={`text-[17px] font-semibold ${selected ? "text-pile-paper" : "text-pile-ink"}`}>
            {option.title}
          </Text>
          {option.apy ? (
            <View className={`rounded-full px-2 py-0.5 ${
              selected ? "bg-[#CED25F]" : "bg-pile-stone"
            }`}>
              <Text className={`text-[10px] font-bold ${
                selected ? "text-pile-ink" : "text-pile-paper"
              }`}>
                {option.apy}% APY
              </Text>
            </View>
          ) : null}
          {option.tag && !option.apy ? (
            <View className={`rounded-full px-1.5 py-0.5 ${
              option.id === "prestocks" || selected
                ? "bg-[#CED25F]"
                : "bg-pile-stone"
            }`}>
              <Text className={`text-[9px] font-bold tracking-wider ${
                option.id === "prestocks" || selected
                  ? "text-pile-ink"
                  : "text-pile-paper"
              }`}>
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

      {/* Notice badge / pill in bottom right of card */}
      {isNoCollateral ? (
        <View className="mt-2.5 flex-row justify-end items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="No card spending notice"
            onPress={(e) => {
              e.stopPropagation();
              setShowTooltip((v) => !v);
            }}
            className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${
              selected
                ? "bg-[#252420] border border-[#3E3C36]"
                : "bg-[#E3E1D9] border border-[#D3D0C6]"
            }`}
          >
            <NoCardIcon size={12} color={selected ? "#CED25F" : "#55534C"} />
            <Text className={`text-[9.5px] font-bold tracking-wider ${selected ? "text-[#E8E6DF]" : "text-[#4A4842]"}`}>
              NO CARD
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Info Tooltip Popover */}
      {showTooltip && isNoCollateral ? (
        <View
          className={`mt-2.5 rounded-[16px] p-3.5 shadow-md ${
            selected ? "bg-[#22211E] border border-[#3E3C36]" : "bg-white border border-[#E2E0D8]"
          }`}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <NoCardIcon size={14} color={selected ? "#CED25F" : "#111110"} />
              <Text className={`text-[12px] font-bold ${selected ? "text-[#FAFAF8]" : "text-pile-ink"}`}>
                No Card Collateral
              </Text>
            </View>
            <Pressable hitSlop={10} onPress={(e) => { e.stopPropagation(); setShowTooltip(false); }}>
              <Text className={`text-[12px] font-bold px-1 ${selected ? "text-stone-400" : "text-stone-500"}`}>✕</Text>
            </Pressable>
          </View>
          <Text className={`mt-1.5 text-[11.5px] leading-[16px] ${selected ? "text-stone-300" : "text-[#55534E]"}`}>
            {option.noticeTooltip ?? "Pre-IPO equity is held directly in your self-custody Solana wallet. Kamino Lending currently has no reserves for private tech tokens, so they cannot back a card loan."}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
