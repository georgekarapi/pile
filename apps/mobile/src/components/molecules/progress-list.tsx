import { View } from "react-native";
import { Check, Circle, LoaderCircle, TriangleAlert } from "lucide-react-native";
import { Text } from "@/components/ui/text";

export type ProgressItem = { label: string; detail: string; state: "done" | "current" | "waiting" | "error" };
export function ProgressList({ items }: { items: ProgressItem[] }) {
  return <View>{items.map((item) => <View key={item.label} className="flex-row gap-3 pb-5">
    <View className="h-5 w-5 items-center justify-center">{item.state === "done" ? <Check size={15} color="#111110" /> : item.state === "current" ? <LoaderCircle size={15} color="#111110" /> : item.state === "error" ? <TriangleAlert size={15} color="#111110" /> : <Circle size={9} color="#62625E" />}</View>
    <View><Text className="text-[14px] font-semibold">{item.label}</Text><Text className="mt-0.5 text-[12px] text-pile-muted">{item.detail}</Text></View>
  </View>)}</View>;
}
