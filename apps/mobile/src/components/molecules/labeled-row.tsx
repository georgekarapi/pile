import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export function LabeledRow({ label, value, onPress, last = false }: { label: string; value: string; onPress?: () => void; last?: boolean }) {
  const content = <View className={cn("flex-row items-center justify-between py-4", !last && "border-b border-pile-stone")}>
    <Text className="text-pile-muted">{label}</Text><Text className="font-semibold">{value}</Text>
  </View>;
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}
