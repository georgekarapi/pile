import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStripe } from "@stripe/stripe-react-native";
import type { FundingCycle, FundingState, Plan } from "@pileup/shared";
import Constants from "expo-constants";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, View } from "react-native";
import { LabeledRow } from "@/components/molecules/labeled-row";
import { ProgressList, type ProgressItem } from "@/components/molecules/progress-list";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Body, Eyebrow, Text, Title } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";

const order: Partial<Record<FundingState, number>> = {
  invoice_paid: 1, crediting: 1, credited: 2, swapping: 2, swaps_submitted: 3,
  depositing: 3, deposits_submitted: 4, borrowing: 4, borrow_submitted: 4, complete: 5
};

function steps(cycle: FundingCycle): ProgressItem[] {
  const blocked = cycle.state === "needs_attention" || cycle.state === "blocked_demo_cap";
  const current = cycle.state === "blocked_demo_cap" ? 1 : order[blocked ? cycle.resumeState ?? "invoice_paid" : cycle.state] ?? 0;
  const names = ["Payment confirmed", "Funds arrived", "Buying your mix", "Adding to your pile", "Updating card room"];
  const collectionDate = new Date(cycle.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const details = [`${collectionDate} · $${cycle.expectedUsd}`, "Ready for your investment", "Purchasing your selected mix", "Depositing into your pile", "Updating available card room"];
  return names.map((label, index) => ({
    label,
    detail: blocked && index === current ? "Needs attention" : index < current || cycle.state === "complete" ? details[index] : "Waiting",
    state: blocked && index === current ? "error" : index < current || cycle.state === "complete" ? "done" : index === current ? "current" : "waiting"
  }));
}

export default function FundingScreen() {
  const preview = Constants.appOwnership === "expo";
  const { previewState } = useLocalSearchParams<{ previewState?: string }>();
  const draftAmount = useAppStore((s) => s.draftAmount);
  const planQuery = useQuery({ queryKey: ["current-plan"], queryFn: api.currentPlan, enabled: !preview, refetchInterval: 5_000 });
  const query = useQuery({ queryKey: ["latest-funding-cycle"], queryFn: api.latestFundingCycle, enabled: !preview, refetchInterval: 5_000 });
  const plan = planQuery.data?.plan;
  if (preview && previewState === "payment_failed") return <FirstPaymentIssueContent amountUsd={draftAmount} preview onUpdate={() => Alert.alert("Expo Go preview", "No payment is made in this preview.")} />;
  if (!preview && plan?.status === "pending_payment" && plan.paymentIssue) return <FirstPaymentIssue plan={plan} />;
  const mockCycle: FundingCycle = {
    id: "preview-cycle",
    userId: "preview-user",
    planId: "preview-plan",
    expectedUsd: draftAmount,
    state: "credited",
    legs: [],
    depositSignatures: [],
    attempts: 1,
    createdAt: "2026-03-02T12:00:00.000Z",
    updatedAt: new Date().toISOString(),
  };
  const cycle = preview ? (query.data?.cycle ?? mockCycle) : query.data?.cycle;
  const blocked = cycle?.state === "needs_attention" || cycle?.state === "blocked_demo_cap";
  const done = cycle?.state === "complete";
  if (!cycle) return <Screen footer={<View className="gap-2"><Button variant="secondary" onPress={() => preview ? router.replace("/home") : void query.refetch()}>{preview ? "View my pile" : "Keep waiting"}</Button>{preview ? <Pressable className="items-center py-2" onPress={() => router.replace({ pathname: "/funding", params: { previewState: "payment_failed" } })}><Text className="text-[13px] font-semibold text-pile-muted">Preview payment failure →</Text></Pressable> : null}</View>}>
    <Eyebrow>{preview ? "EXPO GO PREVIEW" : "PAYMENT"}</Eyebrow>
    <Title className="mt-5">{preview ? "Your pile starts\nwith one stone." : "Confirming your\nweekly plan."}</Title>
    <Body className="mt-4">{preview ? "No payment or investment is made in this preview." : "We’re waiting for payment confirmation before starting your investment."}</Body>
    {!preview ? <ProgressList items={[{ label: "Payment method", detail: "Waiting for provider confirmation", state: "current" }, { label: "Weekly payment", detail: "Confirmation in progress", state: "waiting" }, { label: "First contribution", detail: "Starts only after payment is confirmed", state: "waiting" }]} /> : null}
    {query.error ? <Text className="mt-5 text-sm">Contribution status is unavailable right now.</Text> : null}
  </Screen>;
  return <Screen footer={<View className="gap-2"><Button variant={done ? "primary" : "secondary"} onPress={() => done ? router.replace("/home") : void query.refetch()}>{done ? "View my pile" : blocked ? "Check status" : "View details"}</Button>{preview ? <Pressable className="items-center py-2" onPress={() => router.replace({ pathname: "/funding", params: { previewState: "payment_failed" } })}><Text className="text-[13px] font-semibold text-pile-muted">Preview payment failure →</Text></Pressable> : null}</View>}>
    <Eyebrow>{blocked ? "CONTRIBUTION NEEDS ATTENTION" : "THIS WEEK’S CONTRIBUTION"}</Eyebrow>
    <Title className="mt-5">{blocked ? "We paused\nthis week’s pile." : done ? "Your first stone\nis in place." : "Building this\nweek’s pile."}</Title>
    <Body className="mb-9 mt-4">{blocked ? "Your payment is confirmed, but the investment steps did not finish." : done ? `Your $${cycle.expectedUsd} contribution is in your pile.` : `Your $${cycle.expectedUsd} payment is confirmed. Each step completes once.`}</Body>
    <ProgressList items={steps(cycle)} />
    {blocked ? <Body className="mt-3 rounded-[20px] bg-pile-fog p-4 text-[13px]">We keep completed steps. Your pile resumes from the unfinished step.</Body> : null}
  </Screen>;
}

function FirstPaymentIssue({ plan }: { plan: Plan }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const queryClient = useQueryClient();
  const retry = useMutation({ mutationFn: async () => {
    const checkout = await api.retryCheckout();
    if (checkout.mode !== "live" || !checkout.clientSecret || !checkout.ephemeralKey) throw new Error("Payment setup is unavailable. Please try again later.");
    const initialized = await initPaymentSheet({ merchantDisplayName: "Pileup", paymentIntentClientSecret: checkout.clientSecret, customerId: checkout.customerId, customerEphemeralKeySecret: checkout.ephemeralKey, returnURL: "pileup://stripe-redirect" });
    if (initialized.error) throw new Error(initialized.error.message);
    const presented = await presentPaymentSheet();
    if (presented.error) throw new Error(presented.error.message);
  }, onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["current-plan"] }); void queryClient.invalidateQueries({ queryKey: ["latest-funding-cycle"] }); } });
  return <FirstPaymentIssueContent amountUsd={plan.amountUsd} onUpdate={() => retry.mutate()} pending={retry.isPending} error={retry.error?.message} success={retry.isSuccess} />;
}

function FirstPaymentIssueContent({ amountUsd, onUpdate, pending = false, error, success = false, preview = false }: { amountUsd: number; onUpdate: () => void; pending?: boolean; error?: string; success?: boolean; preview?: boolean }) {
  return <Screen className="pt-0" footerClassName="pb-4" footer={<View className="gap-2"><Button disabled={pending} onPress={onUpdate}>{pending ? "Opening payment…" : "Update payment method"}</Button><Pressable className="items-center py-2" onPress={() => router.replace("/home")}><Text className="text-[13px] font-semibold text-pile-muted">Try again later</Text></Pressable>{preview ? <Pressable className="items-center py-1" onPress={() => router.replace("/funding")}><Text className="text-[13px] font-semibold text-pile-muted">Preview normal funding →</Text></Pressable> : null}</View>}>
    <View className="pt-[60px]">
      <Eyebrow className="tracking-normal">PAYMENT NEEDS ATTENTION</Eyebrow>
      <Title className="mt-4 text-[36px] font-semibold leading-[39px]">We couldn’t start{"\n"}your plan.</Title>
      <Body className="mt-4">{preview ? "Expo Go preview. No payment will be made." : "The payment could not be confirmed."}</Body>
      <View className="mt-4 gap-[6px] rounded-[16px] bg-pile-fog p-[18px]"><Text className="text-[15px] font-semibold">Your pile is unchanged</Text><Body className="text-[13px] leading-[18px]">No investment step has started. Your amount and mix are still saved.</Body></View>
      <View className="mt-4"><LabeledRow label="Weekly amount" value={`$${amountUsd}`} /><LabeledRow label="Payment method" value={preview ? "Preview" : "On file"} /></View>
      {error ? <Text className="mt-4 text-sm">{error}</Text> : null}
      {success ? <Body className="mt-4 text-sm">Checking your payment. Your plan starts only when Stripe confirms it.</Body> : null}
    </View>
  </Screen>;
}
