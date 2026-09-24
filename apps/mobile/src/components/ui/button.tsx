import type { PropsWithChildren } from "react";
import { Pressable, Text, View, type PressableProps } from "react-native";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ children, variant = "primary", className, disabled, ...props }: PropsWithChildren<PressableProps & { variant?: Variant; className?: string }>) {
  const styles: Record<Variant, string> = {
    primary: "bg-pile-ink", secondary: "bg-pile-fog", ghost: "bg-transparent", danger: "bg-pile-ink"
  };
  const textColor = variant === "primary" || variant === "danger" ? "text-white" : "text-pile-ink";
  return <Pressable disabled={disabled} className={cn("h-[58px] w-full max-w-[342px] self-center items-center justify-center rounded-full px-5 active:opacity-70", styles[variant], disabled && "opacity-40", className)} {...props}>
    {typeof children === "string" ? <Text className={cn("font-semibold", textColor)}>{children}</Text> : <View className="w-full flex-row items-center justify-center gap-2">{children}</View>}
  </Pressable>;
}
