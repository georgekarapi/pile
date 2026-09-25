import { Pressable, View } from "react-native";
import { Slider } from "@/components/ui/slider";
import { Text } from "@/components/ui/text";

const MIN = 10;
const MAX = 150;
const STEP = 5;

export function WeeklyAmountSlider({
  amountUsd,
  onChange
}: {
  amountUsd: number;
  onChange: (value: number) => void;
}) {
  return (
    <View className="w-full">
      <Slider
        value={amountUsd}
        onValueChange={onChange}
        min={MIN}
        max={MAX}
        step={STEP}
      />
      <View className="mt-1 flex-row items-center justify-between px-0.5">
        <Pressable onPress={() => onChange(MIN)} hitSlop={12}>
          <Text className="text-[13px] font-medium text-pile-muted">${MIN}</Text>
        </Pressable>
        <Pressable onPress={() => onChange(MAX)} hitSlop={12}>
          <Text className="text-[13px] font-medium text-pile-muted">${MAX}</Text>
        </Pressable>
      </View>
    </View>
  );
}
