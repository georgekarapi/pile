import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, View } from "react-native";
import { LabeledRow } from "@/components/molecules/labeled-row";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Body, Eyebrow, Text, Title } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";

export default function PaymentIssueScreen() {
  const preview = Constants.appOwnership === "expo";
  const { previewState } = useLocalSearchParams<{ previewState?: string }>();
  const draftAmount = useAppStore((s) => s.draftAmount);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["current-plan"], queryFn: api.currentPlan, enabled: !preview, refetchInterval: 15_000 });
  const plan = query.data?.plan;
  const issue = plan?.paymentIssue;
  const updateMethod = useMutation({ mutationFn: async () => {
    const { url } = await api.paymentMethodSession();
    await WebBrowser.openBrowserAsync(url);
    return api.syncPaymentMethod();
  }, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["current-plan"] }); } });
  if (preview && previewState === "payment_failed") return <PaymentIssueContent amountUsd={draftAmount} preview onUpdate={() => Alert.alert("Expo Go preview", "No payment is made in this preview.")} />;
  if (preview) return <Unavailable message="Payment recovery requires the app build." onRetry={() => router.replace("/home")} action="Return to my pile" />;
  if (!query.isSuccess) return <Unavailable message={query.error ? "Payment status is unavailable right now." : "Checking your weekly payment."} onRetry={() => void query.refetch()} action="Try again" />;
  if (!plan || (plan.status !== "live" && plan.status !== "paused") || !issue) return <Unavailable message="There is no weekly payment to update." onRetry={() => router.replace("/home")} action="Return to my pile" />;
  return <PaymentIssueContent amountUsd={plan.amountUsd} onUpdate={() => updateMethod.mutate()} pending={updateMethod.isPending} error={updateMethod.error?.message} success={updateMethod.isSuccess} />;
}

function PaymentIssueContent({ amountUsd, onUpdate, pending = false, error, success = false, preview = false }: { amountUsd: number; onUpdate: () => void; pending?: boolean; error?: string; success?: boolean; preview?: boolean }) {
  return <Screen className="pt-0" footerClassName="pb-4" footer={<View className="gap-2"><Button disabled={pending} onPress={onUpdate}>{pending ? "Opening payment…" : "Update payment method"}</Button><Pressable className="items-center py-2" onPress={() => router.replace("/home")}><Text className="text-[13px] font-semibold text-pile-muted">Return to my pile</Text></Pressable></View>}>
    <View className="pt-[60px]">
      <Eyebrow className="tracking-normal">PAYMENT NEEDS ATTENTION</Eyebrow>
      <Title className="mt-4 text-[36px] font-semibold leading-[39px]">This week’s payment{"\n"}needs attention.</Title>
      <Body className="mt-4">{preview ? "Expo Go preview. No payment will be made." : "The weekly payment could not be confirmed."}</Body>
      <View className="mt-4 gap-[6px] rounded-[16px] bg-pile-fog p-[18px]"><Text className="text-[15px] font-semibold">Your pile is still here</Text><Body className="text-[13px] leading-[18px]">Existing investments remain in your pile. This week’s buy has not started.</Body></View>
      <View className="mt-4"><LabeledRow label="Weekly amount" value={`$${amountUsd}`} /><LabeledRow label="Payment method" value={preview ? "Preview" : "On file"} /></View>
      {error ? <Text className="mt-4 text-sm">{error}</Text> : null}
      {success ? <Body className="mt-4 text-sm">We’ll keep checking this payment. Your weekly buy starts only after it is confirmed.</Body> : null}
    </View>
  </Screen>;
}

function Unavailable({ message, onRetry, action }: { message: string; onRetry: () => void; action: string }) {
  return <Screen footer={<Button onPress={onRetry}>{action}</Button>}><Eyebrow>PAYMENT</Eyebrow><Title className="mt-5">Checking your{"\n"}weekly payment.</Title><Body className="mt-4">{message}</Body></Screen>;
}
