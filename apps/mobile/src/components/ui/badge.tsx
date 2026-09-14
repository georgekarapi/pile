import { Text, View } from "react-native";
import { cn } from "@/lib/cn";
export function Badge({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const toneClass = { neutral: "bg-white/10 text-white", success: "bg-emerald-400/15 text-emerald-300", warning: "bg-amber-400/15 text-amber-300", danger: "bg-red-400/15 text-red-300" }[tone];
  return <View className="self-start rounded-full px-2.5 py-1"><Text className={cn("text-xs font-semibold", toneClass)}>{children}</Text></View>;
}
