import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { ExternalLink } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, TextInput, View } from "react-native";
import { AppTabs } from "@/components/organisms/app-tabs";
import { ProgressList } from "@/components/molecules/progress-list";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Body, Eyebrow, Text, Title } from "@/components/ui/text";
import { api } from "@/lib/api";

type SetupStep = "intro" | "consent" | "terms" | "handoff" | "review" | "needs_information" | "permission" | "provisioning" | "unavailable";
export default function CardScreen() {
  const preview = Constants.appOwnership === "expo";
  const { previewStep } = useLocalSearchParams<{ previewStep?: string }>();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<SetupStep>("intro");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (preview && previewStep && ["intro", "consent", "terms", "handoff", "review", "needs_information", "permission", "provisioning", "unavailable"].includes(previewStep)) setStep(previewStep as SetupStep);
  }, [preview, previewStep]);
  const pile = useQuery({ queryKey: ["pile"], queryFn: api.pile, enabled: !preview }); const persisted = useQuery({ queryKey: ["current-card"], queryFn: api.currentCard, enabled: !preview });
  const identity = useQuery({ queryKey: ["identity-status"], queryFn: api.identityStatus, enabled: !preview && persisted.isSuccess && !persisted.data.card, refetchInterval: 15_000 });
  useEffect(() => {
    if (identity.data?.status === "approved") setStep((current) => current === "provisioning" ? current : "permission");
    else if (identity.data?.status === "terms_pending") setStep("terms");
    else if (identity.data?.status === "needs_information") setStep("needs_information");
    else if (identity.data?.status === "unavailable") setStep("unavailable");
    else if (identity.data?.status === "pending") setStep("review");
    else if (identity.data?.status === "started") setStep("handoff");
  }, [identity.data?.status]);
  const cardRecord = persisted.data?.card;
  const cardId = cardRecord?.bridgeCardAccountId; const available = pile.data?.health.cardAvailableUsd ?? 0;
  const pausedPreview = preview && previewStep === "paused";
  const setupReadError = persisted.error || identity.error || (step === "intro" ? pile.error : null);
  const setupReadPending = !persisted.isSuccess || !identity.isSuccess || (step === "intro" && !pile.isSuccess);
  const retrySetupRead = () => {
    if (!persisted.isSuccess) void persisted.refetch();
    if (persisted.isSuccess && !identity.isSuccess) void identity.refetch();
    if (step === "intro" && !pile.isSuccess) void pile.refetch();
  };
  const kyc = useMutation({ mutationFn: async () => {
    const session = await api.kyc(step === "consent" ? fullName.trim() : undefined, step === "consent" ? email.trim() : undefined);
    if (session.status === "terms_pending" || session.status === "started" || session.status === "needs_information") {
      await WebBrowser.openBrowserAsync(session.status === "terms_pending" ? session.tosUrl : session.kycUrl);
    }
    return session.status;
  }, onSuccess: (status) => { void queryClient.invalidateQueries({ queryKey: ["identity-status"] }); setStep(status === "terms_pending" ? "terms" : status === "pending" ? "review" : status === "approved" ? "permission" : status === "unavailable" ? "unavailable" : "handoff"); } });
  const provision = useMutation({ mutationFn: api.card, onMutate: () => setStep("provisioning"), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["current-card"] }); }, onError: () => setStep("permission") });
  const freeze = useMutation({ mutationFn: (frozen: boolean) => cardId ? api.freezeCard(cardId, frozen) : Promise.reject(new Error("No card")), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["current-card"] }); } });
  if (pausedPreview || (cardId && pile.data && (pile.data.health.status === "warning" || pile.data.health.status === "critical"))) {
    const investmentValue = pausedPreview ? 950 : pile.data!.health.collateralUsd;
    const borrowed = pausedPreview ? 480 : pile.data!.health.debtUsd;
    return <Screen footer={<AppTabs />} footerKind="tabs" className="pt-0"><View className="pt-[50px]">
      <Eyebrow className="text-[12px] tracking-normal">CARD · {pausedPreview || pile.data?.source === "demo" ? "DEMO" : "PILEUP"}</Eyebrow>
      <Title className="mt-8 text-[36px] font-semibold leading-[47px]">A little room{"\n"}for your pile.</Title>
      <View className="mt-4 rounded-[20px] bg-pile-fog p-[22px]"><Text className="text-[22px] font-semibold">Card spending is paused</Text><Body className="mt-3 text-[15px]">Your borrowing is above the safe range. Your available spending is now $0.</Body></View>
      <View className="mt-4 flex-row justify-between py-[10px]"><Text className="text-[15px] text-pile-muted">Investment value</Text><Text className="text-[15px] font-semibold">${investmentValue.toFixed(2)}</Text></View>
      <View className="mt-3 flex-row justify-between py-[10px]"><Text className="text-[15px] text-pile-muted">Borrowed</Text><Text className="text-[15px] font-semibold">${borrowed.toFixed(2)}</Text></View>
      <Body className="mt-4 text-[15px]">Check your balance and repayment options to bring your borrowing back within range.</Body>
      <Body className="mt-4 text-[13px]">If values fall too far, investments may be sold to repay the loan.</Body>
      <Button className="mt-[126px]" onPress={() => preview ? Alert.alert("Preview only", "Repayment requires the app build.") : router.push("/health")}>View repayment options</Button>
    </View></Screen>;
  }
  if (cardId) return <Screen footer={<AppTabs />} footerKind="tabs" className="pt-0">
    <View className="pt-[50px]">
      <View className="flex-row items-center justify-between"><Text className="text-[30px] font-semibold">Your card</Text><Text className="rounded-full bg-pile-ink px-5 py-3 text-[13px] font-semibold text-white" onPress={() => router.push("/health")}>Pay back</Text></View>
      <View className="mt-4 h-[212px] justify-between rounded-[30px] bg-pile-ink p-[22px]"><Text className="text-[20px] font-semibold text-white">pile-up</Text><Text className="text-[26px] font-semibold text-white">{cardRecord?.status === "frozen" ? "Card frozen" : pile.data ? `$${available.toFixed(2)} available` : "Available amount updating"}</Text><Text className="text-[12px] text-white">{cardRecord?.last4 ? `•••• ${cardRecord.last4}` : "Card details unavailable"}   ·   VIRTUAL</Text></View>
      <View className="mt-6 flex-row justify-between"><Text className="text-[18px] font-semibold">Transactions</Text><Text className="text-[13px] text-pile-muted">This week</Text></View>
      <View className="mt-3 h-[66px] justify-center rounded-[18px] bg-pile-fog px-5"><Text className="text-[14px] text-pile-muted">No card transactions available yet</Text></View>
      <View className="mt-8 gap-3"><Button variant="secondary" disabled={freeze.isPending || cardRecord?.status === "frozen"} onPress={() => freeze.mutate(true)}>Freeze card</Button><Button variant="ghost" disabled={freeze.isPending || cardRecord?.status !== "frozen"} onPress={() => freeze.mutate(false)}>Unfreeze card</Button></View>
      {freeze.error ? <Text className="mt-3 text-sm">{freeze.error.message}</Text> : null}
    </View>
  </Screen>;
  const content = {
    intro: { eye: "CARD SETUP", title: "Spend a little.\nKeep building.", body: "Your card uses a loan backed by your investments. Interest applies.", action: "Check card eligibility", next: () => setStep("consent") },
    consent: { eye: "IDENTITY CHECK", title: "First, confirm\nwho you are.", body: "Identity verification is required before a card can be issued.", action: kyc.isPending ? "Opening…" : "Continue to identity check", next: () => kyc.mutate() },
    terms: { eye: "BRIDGE TERMS", title: "Review Bridge’s\nterms first.", body: "Bridge needs your agreement before identity verification can begin.", action: kyc.isPending ? "Opening…" : "Review Bridge terms", next: () => kyc.mutate() },
    handoff: { eye: "SECURE VERIFICATION", title: "Continue with our\nverification partner.", body: "You’ll leave Pileup briefly and return when the identity check is submitted.", action: kyc.isPending ? "Opening…" : "Open secure verification", next: () => kyc.mutate() },
    review: { eye: "IDENTITY CHECK", title: "We’re checking\nyour details.", body: "Your verification was submitted. You can leave this screen.", action: "Return to my pile", next: () => router.replace("/home") },
    needs_information: { eye: "IDENTITY CHECK", title: "One more thing\nis needed.", body: "The verification partner needs updated information before continuing.", action: kyc.isPending ? "Opening…" : "Continue verification", next: () => kyc.mutate() },
    permission: { eye: "CARD PERMISSION", title: "Let your card use\nits allowance.", body: "Approve one limited permission before the card is created. It cannot sell investments or borrow during a tap.", action: "Approve card access", next: () => provision.mutate() },
    provisioning: { eye: "CARD SETUP", title: "Creating your\ncard.", body: "Keep Pileup open while the final setup completes.", action: "Keep waiting", next: () => undefined },
    unavailable: { eye: "CARD SETUP", title: "We can’t finish\ncard setup.", body: "The card provider could not complete this request.", action: "Check status", next: () => void identity.refetch() }
  }[step];
  return <Screen footer={<Button disabled={preview || (setupReadPending && !setupReadError) || (Boolean(setupReadError) && (persisted.isFetching || identity.isFetching || pile.isFetching)) || kyc.isPending || provision.isPending || (!setupReadError && step === "consent" && (fullName.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())))} onPress={setupReadError ? retrySetupRead : content.next}>{preview ? "Card setup requires the app build" : setupReadError ? "Try again" : content.action}</Button>}><Eyebrow>{content.eye}</Eyebrow><Title className="mt-5">{content.title}</Title><Body className="mt-4">{content.body}</Body>{step === "intro" ? <><View className="mt-5 rounded-[20px] bg-pile-ink p-5"><Text className="text-xs font-semibold text-pile-stone">CURRENTLY AVAILABLE</Text><Text className="mt-2 text-5xl font-bold text-white">{preview || pile.isSuccess ? `$${available.toFixed(2)}` : "Updating…"}</Text><Text className="mt-2 text-sm text-pile-stone">Can change as your pile changes</Text></View><View className="mt-3 rounded-[20px] bg-pile-fog p-5"><Text className="font-semibold">Before you get a card</Text><Body className="mt-1 text-sm">We’ll check eligibility, verify your identity, show the terms, and ask for one card permission.</Body></View></> : null}
    {step === "consent" ? <><View className="mt-4 gap-2"><Text className="text-[13px] font-semibold">Full legal name</Text><TextInput className="h-[58px] rounded-[14px] bg-pile-fog px-4 text-[16px] text-pile-ink" placeholder="Name as shown on your ID" placeholderTextColor="#62625E" autoCapitalize="words" value={fullName} onChangeText={setFullName} autoComplete="name" /><Text className="text-[13px] font-semibold">Email address</Text><TextInput className="h-[58px] rounded-[14px] bg-pile-fog px-4 text-[16px] text-pile-ink" placeholder="you@example.com" placeholderTextColor="#62625E" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} autoComplete="email" /></View><View className="mt-4 rounded-[16px] bg-pile-fog p-[18px]"><Text className="text-[15px] font-semibold">Your choice</Text><Body className="mt-2 text-[13px]">You can keep building your pile without getting a card.</Body></View><Text className="mt-4 text-[13px] text-pile-muted" onPress={() => { const url = process.env.EXPO_PUBLIC_IDENTITY_PRIVACY_URL; if (url) void WebBrowser.openBrowserAsync(url); else Alert.alert("Privacy information unavailable", "Please try again later."); }}>How identity information is used →</Text></> : null}
    {step === "terms" || step === "handoff" ? <><View className="mt-4 rounded-[18px] border border-pile-ink p-[22px]"><ExternalLink size={28} color="#111110" /><Text className="mt-4 text-[20px] font-semibold">{step === "terms" ? "Bridge terms of service" : "Identity verification"}</Text><Body className="mt-3 text-[14px]">{step === "terms" ? "Review and accept the terms on Bridge’s secure page." : "The verification partner’s secure page will collect the required details."}</Body></View><View className="mt-4 rounded-[16px] bg-pile-fog p-[18px]"><Text className="text-[15px] font-semibold">{step === "terms" ? "Then verify your identity" : "Come back to this app"}</Text><Body className="mt-2 text-[13px]">{step === "terms" ? "Return to Pileup to open the identity check. You can leave card setup at any time." : "Pileup reads the result after you return. It does not store your identity document in the app."}</Body></View></> : null}
    {step === "review" ? <><View className="mt-4"><ProgressList items={[{ label: "Details submitted", detail: "Received securely", state: "done" }, { label: "Verification review", detail: "In progress", state: "current" }, { label: "Card setup", detail: "Starts after approval", state: "waiting" }]} /></View><View className="mt-4 rounded-[16px] bg-pile-fog p-[18px]"><Text className="text-[15px] font-semibold">We’ll let you know</Text><Body className="mt-2 text-[13px]">There’s nothing else to do unless more information is requested.</Body></View></> : null}
    {step === "needs_information" ? <Body className="mt-5 text-sm">Only submit identity information through the secure verification flow.</Body> : null}{step === "provisioning" ? <View className="mt-10"><ProgressList items={[{ label: "Identity approved", detail: "Verification complete", state: "done" }, { label: "Card permission approved", detail: "Limited to the card allowance", state: "done" }, { label: "Creating your virtual card", detail: "Waiting for the card provider", state: "current" }, { label: "Card ready", detail: "Not active yet", state: "waiting" }]} /></View> : null}{(persisted.error || identity.error || pile.error || kyc.error || provision.error || freeze.error) ? <Text className="mt-5 text-sm">{(persisted.error || identity.error || pile.error || kyc.error || provision.error || freeze.error)?.message}</Text> : null}</Screen>;
}
