import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react-native";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HealthMeter } from "@/components/health-meter";

export default function HealthScreen() {
  const query = useQuery({ queryKey: ["health"], queryFn: api.health });
  const repay = useMutation({
    mutationFn: (amountUsd: number) => api.repay(amountUsd),
    onSuccess: () => query.refetch()
  });
  const health = query.data;
  const repayAmount = health ? Math.min(health.debtUsd, health.walletUsdcUsd) : 0;
  return <SafeAreaView className="flex-1 bg-zinc-950 px-6"><View className="py-8"><Badge tone={health?.status === "healthy" ? "success" : "warning"}>{health?.status?.toUpperCase() ?? "LOADING"}</Badge><Text className="mt-4 text-3xl font-bold text-white">Pile health</Text>{health ? <View className="mt-8 gap-4"><Card><HealthMeter ltvBps={health.currentLtvBps} ceilingBps={health.safeCeilingLtvBps} /></Card><Card><Text className="text-sm text-zinc-400">Collateral / debt</Text><Text className="mt-2 text-xl font-bold text-white">${health.collateralUsd.toFixed(2)} <Text className="text-zinc-500">/</Text> ${health.debtUsd.toFixed(2)}</Text><Text className="mt-4 text-sm text-zinc-400">Additional safe borrow: ${health.additionalBorrowUsd.toFixed(2)}</Text></Card>{health.status !== "healthy" ? <Card className="border-amber-400/30"><View className="flex-row gap-3"><AlertTriangle color="#FBBF24" /><Text className="flex-1 text-sm leading-5 text-amber-100">Card availability is frozen when risk crosses the safe ceiling. Add USDC and repay debt; Pileup does not automatically sell xStocks.</Text></View></Card> : null}</View> : null}{repayAmount > 0 ? <Button className="mt-5" disabled={repay.isPending} onPress={() => repay.mutate(repayAmount)}><Text className="font-semibold text-white">Repay ${repayAmount.toFixed(2)} USDC</Text></Button> : null}<Button className="mt-3" variant="secondary" onPress={() => query.refetch()}><RefreshCw size={16} color="white" /><Text className="font-semibold text-white">Refresh health</Text></Button>{(query.error || repay.error) ? <Text className="mt-3 text-red-300">{(query.error || repay.error)?.message}</Text> : null}</View></SafeAreaView>;
}
