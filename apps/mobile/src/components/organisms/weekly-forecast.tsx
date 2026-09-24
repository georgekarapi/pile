import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

const YEARS = 5;
const WEEKS = YEARS * 52;
const WEEKLY_RATE = Math.pow(1.09, 1 / 52) - 1;
const growthBars = [0, 1, 3, 5, 8, 12, 17, 23, 30, 38, 47, 58];
const dollars = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;

export function WeeklyForecast({ amountUsd }: { amountUsd: number }) {
  const [width, setWidth] = useState(342);
  const invested = amountUsd * WEEKS;
  const projected = amountUsd * (Math.pow(1 + WEEKLY_RATE, WEEKS) - 1) / WEEKLY_RATE;
  const chartScale = width / 342;

  return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} className="h-[194px] w-full rounded-[24px] bg-pile-fog">
    <Text className="absolute left-5 top-[18px] text-[10px] font-bold text-pile-muted">ESTIMATED FORECAST</Text>
    <Text className="absolute left-5 top-[39px] text-[32px] font-semibold text-pile-ink">{dollars(projected)}</Text>
    <Text className="absolute left-5 top-[82px] text-[13px] text-pile-muted">9% assumed return · 5 years</Text>
    <Text className="absolute left-5 top-[113px] text-[12px] leading-[16px] text-pile-muted">{dollars(invested)} invested{"\n"}+{dollars(projected - invested)} growth</Text>
    <View className="absolute left-5 top-[158px] h-[7px] w-[7px] rounded-full" style={{ backgroundColor: "#B7B9AA" }} />
    <Text className="absolute left-8 top-[154px] text-[10px] font-semibold text-pile-muted">Invested</Text>
    <View className="absolute left-[82px] top-[158px] h-[7px] w-[7px] rounded-full bg-pile-ink" />
    <Text className="absolute left-[94px] top-[154px] text-[10px] font-semibold text-pile-muted">Est. growth</Text>
    <View className="absolute top-[151px] h-[2px] rounded-full bg-pile-stone" style={{ left: 148 * chartScale, width: 166 * chartScale }} />
    {growthBars.map((growth, index) => {
      const investedHeight = 8 + index * 6;
      const x = (154 + index * 13) * chartScale;
      return <View key={index}>
        <View style={{ position: "absolute", left: x, top: 150 - investedHeight, width: 8 * chartScale, height: investedHeight, borderRadius: 4, backgroundColor: "#B7B9AA" }} />
        {growth > 0 ? <View style={{ position: "absolute", left: x, top: 150 - investedHeight - growth, width: 8 * chartScale, height: growth, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: "#111110" }} /> : null}
      </View>;
    })}
    <Text className="absolute top-[164px] text-[10px] font-semibold text-pile-muted" style={{ left: 148 * chartScale }}>now</Text>
    <Text className="absolute top-[164px] text-[10px] font-semibold text-pile-muted" style={{ left: 288 * chartScale }}>5y</Text>
  </View>;
}
