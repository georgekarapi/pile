import type { PropsWithChildren } from "react";
import { Pressable, Text, View, type PressableProps } from "react-native";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ children, variant = "primary", className, disabled, ...props }: PropsWithChildren<PressableProps & { variant?: Variant; className?: string }>) {
  const styles: Record<Variant, string> = {
    primary: "bg-pile-500", secondary: "bg-white/10 border border-white/10", ghost: "bg-transparent", danger: "bg-red-500/90"
  };
  return <Pressable disabled={disabled} className={cn("min-h-12 items-center justify-center rounded-2xl px-4 active:opacity-80", styles[variant], disabled && "opacity-40", className)} {...props}>
    {typeof children === "string" ? <Text className="font-semibold text-white">{children}</Text> : <View className="flex-row items-center justify-center gap-2">{children}</View>}
  </Pressable>;
}
