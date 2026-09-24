import { useLoginWithEmail, useLoginWithOAuth, usePrivy } from "@privy-io/expo";
import Constants from "expo-constants";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Body, Eyebrow, Text, Title } from "@/components/ui/text";
import { useAppStore } from "@/stores/app-store";
import { api, setAccessTokenProvider } from "@/lib/api";

type SignInStep = "method" | "email" | "code";

export default function SignIn() {
  return Constants.appOwnership === "expo" ? <ExpoGoSignIn /> : <NativeSignIn />;
}

function ExpoGoSignIn() {
  const { returning, step: initialStep, email: initialEmail } = useLocalSearchParams<{ returning?: string; step?: SignInStep; email?: string }>();
  const [step, setStep] = useState<SignInStep>(initialStep ?? "method");
  const [email, setEmail] = useState(initialEmail ?? (initialStep === "code" ? "ari@example.com" : ""));
  const [code, setCode] = useState("");
  useEffect(() => {
    if (initialStep) setStep(initialStep);
    if (initialEmail) setEmail(initialEmail);
    else if (initialStep === "code" && !email) setEmail("ari@example.com");
  }, [initialStep, initialEmail]);
  const unavailable = () => Alert.alert("App build required", "Sign-in uses native modules unavailable in Expo Go.");
  return <SignInContent
    step={step}
    email={email}
    code={code}
    setEmail={setEmail}
    setCode={setCode}
    setStep={setStep}
    onApple={unavailable}
    onGoogle={unavailable}
    onEmailSubmit={() => setStep("code")}
    onVerify={() => router.push(returning === "1" ? "/home" : "/plan")}
    onResend={() => Alert.alert("Code resent", "A new code has been sent in preview mode.")}
    preview
  />;
}

function NativeSignIn() {
  const { returning } = useLocalSearchParams<{ returning?: string }>();
  const { getAccessToken } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { login } = useLoginWithOAuth();
  const [step, setStep] = useState<SignInStep>("method");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setError(undefined);
    setBusy(true);
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to sign in"); }
    finally { setBusy(false); }
  };
  const routeAfterLogin = async () => {
    setAccessTokenProvider(getAccessToken);
    if (!await getAccessToken()) throw new Error("Sign-in did not provide an access token");
    const { plan } = await api.currentPlan();
    if (plan?.status === "draft") {
      const weights = new Map(plan.weights.map(({ symbol, bps }) => [symbol, bps]));
      const draftMix = weights.size === 1 && weights.get("SPYx") === 10_000 ? "market"
        : weights.size === 2 && weights.get("NVDAx") === 5_000 && weights.get("AAPLx") === 5_000 ? "tech"
        : "balanced";
      useAppStore.getState().setDraft({ draftAmount: plan.amountUsd, draftMix });
      router.replace("/plan");
      return;
    }
    if (plan) {
      router.replace(plan.status === "pending_payment" ? "/funding" : "/home");
      return;
    }
    router.replace(returning === "1" ? { pathname: "/onboarding", params: { signedIn: "1" } } : "/plan");
  };
  const oauth = (provider: "apple" | "google") => run(async () => { await login({ provider }); await routeAfterLogin(); });
  const send = () => run(async () => { await sendCode({ email: email.trim() }); setStep("code"); });
  const verify = () => run(async () => { await loginWithCode({ email: email.trim(), code }); await routeAfterLogin(); });
  return <SignInContent step={step} email={email} code={code} error={error} busy={busy} setEmail={setEmail} setCode={setCode} setStep={setStep} onApple={() => oauth("apple")} onGoogle={() => oauth("google")} onEmailSubmit={send} onVerify={verify} onResend={send} />;
}

function SignInContent({ step, email, code = "", error, busy = false, preview = false, setEmail, setCode, setStep, onApple, onGoogle, onEmailSubmit, onVerify, onResend }: {
  step: SignInStep; email: string; code?: string; error?: string; busy?: boolean; preview?: boolean;
  setEmail: (value: string) => void; setCode?: (value: string) => void; setStep: (step: SignInStep) => void;
  onApple: () => void; onGoogle: () => void; onEmailSubmit: () => void; onVerify?: () => void; onResend?: () => void;
}) {
  const amount = useAppStore((s) => s.draftAmount);
  const mix = useAppStore((s) => s.draftMix);
  const mixLabel = mix === "balanced" ? "A bit of both" : mix === "market" ? "The whole market" : "Big tech";

  if (step === "method") return <Screen scroll={false} className="pt-0"><View className="pt-[60px]">
    <Eyebrow className="tracking-normal">3 OF 4 · SAVE</Eyebrow>
    <Title className="mt-5 text-[36px] font-semibold leading-[47px]">Make this{"\n"}pile yours.</Title>
    <Body className="mt-5 text-[16px] leading-[21px]">Keep your choices safe. Sign in to continue.</Body>
    <View className="mt-5 h-[97px] rounded-[18px] bg-pile-fog px-5 py-5"><Text className="text-[16px] font-semibold">${amount} every week</Text><Text className="mt-[7px] text-[14px] text-pile-muted">{mixLabel}</Text></View>
    <View className="mt-9 gap-3"><Button className="h-[56px]" disabled={busy} onPress={onApple}>Continue with Apple</Button><Button className="h-[56px]" variant="secondary" disabled={busy} onPress={onGoogle}>Continue with Google</Button><Button className="h-[56px]" variant="secondary" onPress={() => setStep("email")}>Use my email</Button></View>
    <Text className="mt-12 text-center text-[14px] text-pile-muted">Your amount and mix will be here when you return.</Text>
    {error ? <Text className="mt-4 text-center text-sm">{error}</Text> : null}
  </View></Screen>;

  if (step === "email") return <Screen className="pt-0" footer={<><Button disabled={busy || !email.includes("@")} onPress={onEmailSubmit}>{preview ? "Preview plan" : busy ? "Sending…" : "Email me a code"}</Button><Pressable className="pt-3" onPress={() => setStep("method")}><Text className="text-center text-xs text-pile-muted">Use Apple or Google instead</Text></Pressable></>}><View className="pt-[60px]">
    <Eyebrow className="tracking-normal">SECURE SIGN IN</Eyebrow>
    <Title className="mt-4 text-[36px] font-semibold leading-[39px]">Your email,{"\n"}then one code.</Title>
    <Body className="mt-4 text-[16px] leading-[22px]">We’ll email a one-time code. No password or seed phrase.</Body>
    <TextInput className="mt-4 h-[58px] rounded-[18px] bg-pile-fog px-4 text-pile-ink" placeholder="ari@example.com" placeholderTextColor="#8A8984" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
    <View className="mt-4 rounded-[18px] bg-pile-fog p-4"><Text className="text-[14px] font-semibold">Your choices are saved</Text><Text className="mt-1 text-[13px] text-pile-muted">${amount} each week · {mixLabel}</Text></View>
    <Text className="mt-4 text-[13px] text-pile-muted">A secure wallet is created for your Pile account.</Text>
    {preview ? <Text className="mt-4 text-xs text-pile-muted">Expo Go previews the flow without sending a code.</Text> : null}
    {error ? <Text className="mt-4 text-sm">{error}</Text> : null}
  </View></Screen>;

  return <Screen className="pt-0" footer={<><Button disabled={busy || code.length === 0} onPress={onVerify}>{busy ? "Verifying…" : "Verify and continue"}</Button><View className="flex-row justify-center gap-4 pt-3"><Text className="text-xs text-pile-muted" onPress={onResend}>Resend code</Text><Text className="text-xs text-pile-muted">·</Text><Text className="text-xs text-pile-muted" onPress={() => setStep("email")}>Change email</Text></View></>}><View className="pt-[60px]">
    <Eyebrow className="tracking-normal">CHECK YOUR EMAIL</Eyebrow>
    <Title className="mt-4 text-[36px] font-semibold leading-[39px]">Enter the code{"\n"}we sent.</Title>
    <Body className="mt-4 text-[16px]">Sent to {email}. It expires shortly.</Body>
    <TextInput className="mt-4 h-[58px] rounded-[18px] bg-pile-fog px-4 text-pile-ink" placeholder="••••••" placeholderTextColor="#8A8984" keyboardType="number-pad" value={code} onChangeText={setCode} />
    <View className="mt-4 rounded-[18px] bg-pile-fog p-4"><Text className="text-[14px] font-semibold">One-time use</Text><Text className="mt-1 text-[13px] text-pile-muted">We’ll never ask for this code outside this sign-in screen.</Text></View>
    {error ? <Text className="mt-4 text-sm">{error}</Text> : null}
  </View></Screen>;
}
