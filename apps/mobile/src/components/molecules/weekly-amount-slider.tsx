import { useMemo, useState } from "react";
import { PanResponder, View } from "react-native";
import { Text } from "@/components/ui/text";

const MIN = 10;
const MAX = 150;
const STEP = 5;
const HANDLE = 32;
const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

export function WeeklyAmountSlider({ amountUsd, onChange }: { amountUsd: number; onChange: (value: number) => void }) {
  const [width, setWidth] = useState(342);
  const setFromX = (x: number) => onChange(clamp(Math.round((MIN + (x - HANDLE / 2) / (width - HANDLE) * (MAX - MIN)) / STEP) * STEP));
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => setFromX(event.nativeEvent.locationX),
    onPanResponderMove: (event) => setFromX(event.nativeEvent.locationX),
  }), [width, onChange]);
  const left = (amountUsd - MIN) / (MAX - MIN) * (width - HANDLE);

  return <View
    {...pan.panHandlers}
    onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    accessible
    accessibilityRole="adjustable"
    accessibilityLabel="Weekly amount"
    accessibilityValue={{ min: MIN, max: MAX, now: amountUsd }}
    accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
    onAccessibilityAction={(event) => onChange(clamp(amountUsd + (event.nativeEvent.actionName === "increment" ? STEP : -STEP)))}
    className="h-[70px] w-full"
  >
    <View pointerEvents="none" className="absolute top-[31px] h-[6px] w-full rounded-full bg-pile-stone" />
    <View pointerEvents="none" className="absolute top-[31px] h-[6px] rounded-full bg-pile-ink" style={{ width: left + HANDLE / 2 }} />
    <View pointerEvents="none" className="absolute top-[18px] h-8 w-8 rounded-full bg-pile-ink" style={{ left }} />
    <Text pointerEvents="none" className="absolute left-0 top-[51px] text-xs text-pile-muted">$10</Text>
    <Text pointerEvents="none" className="absolute right-0 top-[51px] text-xs text-pile-muted">$150</Text>
  </View>;
}
