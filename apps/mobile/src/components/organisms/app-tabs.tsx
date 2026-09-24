import { router, usePathname } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

export function AppTabs() {
  const path = usePathname();
  return <View className="px-6 pb-8 pt-2">
    <View className="h-[60px] w-full max-w-[342px] self-center flex-row rounded-full bg-pile-fog p-[6px]">
      {([["/home", "Pile"], ["/card", "Card"]] as const).map(([href, label]) => {
        const active = path === href || (href === "/card" && path === "/health");
        return <Pressable key={href} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => router.replace(href)} className={`h-[48px] flex-1 items-center justify-center rounded-full ${active ? "bg-pile-ink" : "bg-pile-fog"}`}>
          <Text className={`text-[15px] font-semibold ${active ? "text-white" : "text-pile-ink"}`}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
