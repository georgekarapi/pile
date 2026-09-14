import type { PropsWithChildren } from "react";
import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/cn";

// React Native Reusables-compatible local primitive. Keep product components
// composed from ui/* primitives so an upstream RNR update stays isolated here.
export function Card({ children, className, ...props }: PropsWithChildren<ViewProps & { className?: string }>) {
  return <View className={cn("rounded-3xl border border-white/10 bg-white/[0.06] p-5", className)} {...props}>{children}</View>;
}
