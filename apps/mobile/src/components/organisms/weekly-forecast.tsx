import { useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { Text } from "@/components/ui/text";

const YEARS = 5;
const WEEKS = YEARS * 52;
const NUM_INTERVALS = 10;
const dollars = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;

export function WeeklyForecast({
  amountUsd,
  apy = 12,
  bundleTitle,
  mixTitle,
}: {
  amountUsd: number;
  apy?: number;
  bundleTitle?: string;
  mixTitle?: string;
}) {
  const title = bundleTitle ?? mixTitle;
  const [containerWidth, setContainerWidth] = useState(342);

  const rateDecimal = Math.max(0.01, apy / 100);
  const weeklyRate = Math.pow(1 + rateDecimal, 1 / 52) - 1;

  const totalInvested = amountUsd * WEEKS;
  const totalProjected = amountUsd * (Math.pow(1 + weeklyRate, WEEKS) - 1) / weeklyRate;
  const totalGrowth = Math.max(0, totalProjected - totalInvested);

  const intervals = useMemo(() => {
    return Array.from({ length: NUM_INTERVALS }, (_, index) => {
      const fraction = (index + 1) / NUM_INTERVALS;
      const weeksPassed = fraction * WEEKS;
      const invested = amountUsd * weeksPassed;
      const projected = amountUsd * (Math.pow(1 + weeklyRate, weeksPassed) - 1) / weeklyRate;
      const growth = Math.max(0, projected - invested);
      return {
        fraction,
        invested,
        projected,
        growth,
      };
    });
  }, [amountUsd, weeklyRate]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setContainerWidth(w);
  };

  const chartWidth = Math.max(140, Math.min(185, containerWidth * 0.48));
  const chartHeight = 136;
  const baselineY = 114;
  const maxBarHeight = 94;

  const slotWidth = chartWidth / NUM_INTERVALS;
  const barWidth = Math.max(6, Math.min(11, slotWidth * 0.58));

  const trendPoints = intervals.map((item, index) => {
    const totalHeight = Math.max(4, (item.projected / totalProjected) * maxBarHeight);
    const x = index * slotWidth + slotWidth / 2;
    const y = baselineY - totalHeight;
    return { x, y };
  });

  const trendPath = trendPoints.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, "");

  return (
    <View
      onLayout={onLayout}
      className="w-full rounded-[24px] bg-pile-fog p-5"
    >
      <View className="flex-row items-stretch justify-between">
        {/* Left Column: Metrics & Legend */}
        <View className="flex-1 justify-between pr-3">
          <View>
            <Text className="text-[10px] font-bold tracking-wider text-pile-muted">
              ESTIMATED 5-YEAR FORECAST
            </Text>
            <Text className="mt-1 text-[30px] font-semibold tracking-tight text-pile-ink">
              {dollars(totalProjected)}
            </Text>
            <Text className="mt-0.5 text-[12.5px] text-pile-muted">
              {apy}% avg APY {title ? `· ${title}` : "· 5 years"}
            </Text>
          </View>

          <View className="mt-3">
            <Text className="text-[12px] font-medium leading-[16px] text-pile-muted">
              <Text className="font-semibold text-pile-ink">{dollars(totalInvested)}</Text> deposited
            </Text>
            <Text className="text-[12px] font-medium leading-[16px] text-pile-muted">
              +<Text className="font-semibold text-[#10A37F]">{dollars(totalGrowth)}</Text> est. growth
            </Text>
          </View>

          {/* Legend */}
          <View className="mt-3.5 flex-row items-center gap-3">
            <View className="flex-row items-center gap-1.5">
              <View className="h-[7px] w-[7px] rounded-full bg-[#C4C3BA]" />
              <Text className="text-[10.5px] font-medium text-pile-muted">Deposited</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="h-[7px] w-[7px] rounded-full bg-pile-ink" />
              <Text className="text-[10.5px] font-medium text-pile-muted">Growth</Text>
            </View>
          </View>
        </View>

        {/* Right Column: Mathematical SVG Forecast Chart */}
        <View style={{ width: chartWidth, height: chartHeight }} className="items-end justify-center">
          <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
            {/* Horizontal baseline */}
            <Line
              x1={0}
              y1={baselineY}
              x2={chartWidth}
              y2={baselineY}
              stroke="#D6D5CD"
              strokeWidth={1.25}
              strokeLinecap="round"
            />

            {/* Subtle trend curve connecting compound growth peaks */}
            {trendPath ? (
              <Path
                d={trendPath}
                fill="none"
                stroke="#111110"
                strokeWidth={1.25}
                strokeDasharray="2.5,2.5"
                opacity={0.35}
              />
            ) : null}

            {/* Compound bars */}
            {intervals.map((item, index) => {
              const totalHeight = Math.max(4, (item.projected / totalProjected) * maxBarHeight);
              const investedHeight = Math.max(2, (item.invested / totalProjected) * maxBarHeight);
              const growthHeight = Math.max(0, totalHeight - investedHeight);

              const x = index * slotWidth + (slotWidth - barWidth) / 2;
              const investedY = baselineY - investedHeight;
              const growthY = baselineY - totalHeight;

              return (
                <G key={`interval-${index}`}>
                  {/* Bottom: Deposited Cash */}
                  <Rect
                    x={x}
                    y={investedY}
                    width={barWidth}
                    height={investedHeight}
                    fill="#C4C3BA"
                    rx={2}
                  />

                  {/* Top: Compounded Interest */}
                  {growthHeight > 0.5 ? (
                    <Rect
                      x={x}
                      y={growthY}
                      width={barWidth}
                      height={growthHeight}
                      fill="#111110"
                      rx={2}
                    />
                  ) : null}
                </G>
              );
            })}

            {/* Time labels below baseline */}
            <SvgText
              x={slotWidth * 0.5}
              y={baselineY + 14}
              fontSize={10}
              fontWeight="600"
              fill="#8A8984"
              textAnchor="middle"
            >
              now
            </SvgText>
            <SvgText
              x={chartWidth * 0.5}
              y={baselineY + 14}
              fontSize={10}
              fontWeight="600"
              fill="#8A8984"
              textAnchor="middle"
            >
              2.5y
            </SvgText>
            <SvgText
              x={chartWidth - slotWidth * 0.5}
              y={baselineY + 14}
              fontSize={10}
              fontWeight="600"
              fill="#8A8984"
              textAnchor="middle"
            >
              5y
            </SvgText>
          </Svg>
        </View>
      </View>
    </View>
  );
}
