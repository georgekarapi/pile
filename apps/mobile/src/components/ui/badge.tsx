import { Text, View } from "react-native";
import { cn } from "@/lib/cn";
export function Badge({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const containerClass = { neutral: "bg-pile-fog", success: "bg-pile-ink", warning: "border border-pile-ink bg-transparent", danger: "bg-pile-ink" }[tone];
  return <View className={cn("self-start rounded-full px-2.5 py-1", containerClass)}><Text className={cn("text-xs font-semibold", tone === "success" || tone === "danger" ? "text-white" : "text-pile-ink")}>{children}</Text></View>;
}
