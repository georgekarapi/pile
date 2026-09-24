import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/cn";

export function Screen({ children, footer, footerKind = "action", scroll = true, className, footerClassName }: PropsWithChildren<{ footer?: ReactNode; footerKind?: "action" | "tabs"; scroll?: boolean; className?: string; footerClassName?: string }>) {
  const content = <View className={cn("flex-1 px-6 pb-6 pt-5", className)}>{children}</View>;
  return <SafeAreaView className="flex-1 bg-pile-paper">
    {scroll ? <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">{content}</ScrollView> : content}
    {footer ? footerKind === "tabs"
      ? <View className="bg-pile-paper">{footer}</View>
      : <View className={cn("items-center bg-pile-paper px-6 pb-8 pt-2", footerClassName)}><View className="w-full max-w-[342px]">{footer}</View></View>
      : null}
  </SafeAreaView>;
}
