import type { ComponentProps } from "react";
import { Text as RNText } from "react-native";
import { cn } from "@/lib/cn";

type Props = ComponentProps<typeof RNText> & { className?: string };

export function Text({ className, ...props }: Props) {
  return <RNText className={cn("text-base text-pile-ink", className)} {...props} />;
}

export function Eyebrow({ className, ...props }: Props) {
  return <Text className={cn("text-xs font-semibold uppercase tracking-widest text-pile-muted", className)} {...props} />;
}

export function Title({ className, ...props }: Props) {
  return <Text className={cn("text-[40px] font-bold leading-[44px] tracking-tight", className)} {...props} />;
}

export function Body({ className, ...props }: Props) {
  return <Text className={cn("text-base leading-6 text-pile-muted", className)} {...props} />;
}
