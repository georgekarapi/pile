import { useLoginWithEmail, useLoginWithOAuth, usePrivy } from "@privy-io/expo";
import Constants from "expo-constants";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Body, Eyebrow, Text, Title } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { api, setAccessTokenProvider } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";

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
    isReturning={returning === "1"}
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
  const { getAccessToken, user, isReady, logout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { login } = useLoginWithOAuth();
  const [step, setStep] = useState<SignInStep>("method");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const isRoutingRef = useRef(false);

  const run = async (action: () => Promise<void>) => {
    setError(undefined);
    setBusy(true);
    try { await action(); } catch (reason) {
      console.error("[NativeSignIn error]", reason);
      const msg = reason instanceof Error ? reason.message : String(reason);
      if (msg.includes("Login with Google not allowed")) {
        setError("Google login is disabled in your Privy app settings. Enable it in the Privy Dashboard under Configuration > Login Methods.");
      } else if (msg.includes("Login with Apple not allowed")) {
        setError("Apple login is disabled in your Privy app settings. Enable it in the Privy Dashboard under Configuration > Login Methods.");
      } else {
        setError(msg || "Unable to sign in");
      }
    }
    finally { setBusy(false); }
  };

  const routeAfterLogin = async () => {
    if (isRoutingRef.current) return;
    isRoutingRef.current = true;
    try {
      setAccessTokenProvider(getAccessToken);
      const token = await getAccessToken();
      if (!token) throw new Error("Sign-in did not provide an access token");
      try {
        const { plan } = await api.currentPlan();
        if (plan?.status === "draft") {
          const weights = new Map(plan.weights.map(({ symbol, bps }) => [symbol, bps]));
          const draftBundle = weights.size === 1 && weights.get("SPYx") === 10_000 ? "market"
            : weights.size === 2 && weights.get("NVDAx") === 5_000 && weights.get("AAPLx") === 5_000 ? "tech"
            : "balanced";
          useAppStore.getState().setDraft({ draftAmount: plan.amountUsd, draftBundle });
          router.replace("/plan");
          return;
        }
        if (plan) {
          router.replace(plan.status === "pending_payment" ? "/funding" : "/home");
          return;
        }
      } catch (planError) {
        console.warn("[NativeSignIn currentPlan warning]", planError);
      }
      router.replace(returning === "1" ? { pathname: "/onboarding", params: { signedIn: "1" } } : "/plan");
    } finally {
      isRoutingRef.current = false;
    }
  };

  useEffect(() => {
    if (isReady && user) {
      void run(async () => {
        await routeAfterLogin();
      });
    }
  }, [isReady, user?.id]);

  const oauth = (provider: "apple" | "google") => run(async () => {
    if (user) {
      await routeAfterLogin();
      return;
    }
    try {
      await login({ provider });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Already logged in")) {
        await routeAfterLogin();
        return;
      }
      throw err;
    }
    await routeAfterLogin();
  });

  const send = () => run(async () => {
    if (user) {
      await routeAfterLogin();
      return;
    }
    try {
      await sendCode({ email: email.trim() });
      setStep("code");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Already logged in")) {
        await routeAfterLogin();
        return;
      }
      throw err;
    }
  });

  const verify = (codeToVerify?: string) => run(async () => {
    const c = (codeToVerify ?? code).trim();
    if (c.length !== 6) return;
    try {
      await loginWithCode({ email: email.trim(), code: c });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Already logged in")) {
        await routeAfterLogin();
        return;
      }
      throw err;
    }
    await routeAfterLogin();
  });

  const handleSignOut = () => run(async () => {
    await logout();
    setError(undefined);
    setStep("method");
  });

  const getAccountIdentifier = () => {
    if (!user) return undefined;
    for (const acc of user.linked_accounts) {
      if ("email" in acc && typeof acc.email === "string") return acc.email;
      if ("address" in acc && typeof acc.address === "string" && acc.type === "email") return acc.address;
    }
    return `Account (${user.id.slice(0, 8)}…)`;
  };

  const userIdentifier = getAccountIdentifier();

  return <SignInContent
    step={step}
    email={email}
    code={code}
    error={error}
    busy={busy}
    isReturning={returning === "1"}
    currentUser={userIdentifier}
    onSignOut={handleSignOut}
    onContinue={() => void run(routeAfterLogin)}
    setEmail={setEmail}
    setCode={setCode}
    setStep={setStep}
    onApple={() => oauth("apple")}
    onGoogle={() => oauth("google")}
    onEmailSubmit={send}
    onVerify={verify}
    onResend={send}
  />;
}

function AppleLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 170 170">
      <Path
        fill="#FFFFFF"
        d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.05-7.66-7.85-11.91-14.39-7.39-11.41-12.79-24.32-16.19-38.74-3.39-14.42-5.09-27.18-5.09-38.27 0-14.42 3.65-26.4 10.96-35.95 7.31-9.55 16.5-14.43 27.56-14.64 4.58 0 9.83 1.25 15.75 3.76 5.92 2.5 9.87 3.82 11.83 3.96 1.8.14 5.86-1.25 12.18-4.17 6.32-2.92 11.75-4.22 16.29-3.9 12.06.82 21.75 5.35 29.07 13.59-10.54 6.42-15.68 15.23-15.42 26.44.27 8.82 3.73 16.25 10.38 22.3 6.66 6.05 14.54 9.61 23.64 10.68-2.23 6.74-4.99 13.7-8.28 20.89zM119.22 31.84c0-7.14 2.61-13.79 7.82-19.95 5.22-6.16 11.71-10.38 19.49-12.66-.27 1.09-.48 2.05-.62 2.88-.68 4.24-2.24 8.78-4.69 13.62-2.45 4.84-5.69 8.75-9.72 11.74-4.03 2.99-8.47 4.96-13.31 5.91-.41-.54-.68-1.05-.81-1.54h-.16z"
      />
    </Svg>
  );
}

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24Z"
      />
      <Path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
      />
    </Svg>
  );
}

function AppleSignInButton({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={cn(
        "h-[56px] w-full flex-row items-center justify-center rounded-[18px] bg-black active:opacity-85",
        disabled && "opacity-50"
      )}
    >
      <AppleLogo size={18} />
      <Text className="ml-2.5 text-[16px] font-medium text-white">Continue with Apple</Text>
    </Pressable>
  );
}

function GoogleSignInButton({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={cn(
        "h-[56px] w-full flex-row items-center justify-center rounded-[18px] border border-[#E5E5E0] bg-white active:opacity-85",
        disabled && "opacity-50"
      )}
    >
      <GoogleLogo size={20} />
      <Text className="ml-2.5 text-[16px] font-medium text-[#1F1F1F]">Continue with Google</Text>
    </Pressable>
  );
}

function OtpDigitBoxes({
  value,
  onChange,
  onComplete,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, 6);
    onChange(digits);
    if (digits.length === 6) {
      onComplete?.(digits);
    }
  };

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      className="mt-6 w-full relative"
    >
      <View className="flex-row justify-between w-full pointer-events-none">
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const digit = value[index] ?? "";
          const isCurrent = isFocused && index === value.length;
          return (
            <View
              key={index}
              className={cn(
                "h-[60px] flex-1 max-w-[48px] items-center justify-center rounded-[16px] bg-pile-fog border-2",
                isCurrent
                  ? "border-pile-ink"
                  : digit
                  ? "border-pile-fog"
                  : "border-transparent"
              )}
            >
              <Text className="text-[24px] font-semibold text-pile-ink">
                {digit}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        maxLength={6}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoFocus
        editable={!disabled}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        caretHidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.01,
          backgroundColor: "transparent",
          color: "transparent",
        }}
      />
    </Pressable>
  );
}

function SignInContent({
  step,
  email,
  code = "",
  error,
  busy = false,
  preview = false,
  isReturning = false,
  currentUser,
  onSignOut,
  onContinue,
  setEmail,
  setCode,
  setStep,
  onApple,
  onGoogle,
  onEmailSubmit,
  onVerify,
  onResend
}: {
  step: SignInStep;
  email: string;
  code?: string;
  error?: string;
  busy?: boolean;
  preview?: boolean;
  isReturning?: boolean;
  currentUser?: string;
  onSignOut?: () => void;
  onContinue?: () => void;
  setEmail: (value: string) => void;
  setCode?: (value: string) => void;
  setStep: (step: SignInStep) => void;
  onApple: () => void;
  onGoogle: () => void;
  onEmailSubmit: () => void;
  onVerify?: (code?: string) => void;
  onResend?: () => void;
}) {
  const amount = useAppStore((s) => s.draftAmount);
  const bundle = useAppStore((s) => s.draftBundle);
  const bundleLabel = bundle === "bigfour" ? "The Big Four" : bundle === "prestocks" ? "Pre-IPO Giants" : bundle === "faang" ? "FAANG Basket" : bundle === "balanced" ? "A bit of both" : bundle === "market" ? "The whole market" : "Big tech";

  if (step === "method") return <Screen scroll={false} className="pt-0">
    <View className="flex-1 justify-between pt-[60px] pb-6">
      <View>
        <Eyebrow className="tracking-normal">{isReturning ? "WELCOME BACK" : "SAVE"}</Eyebrow>
        <Title className="mt-5 text-[36px] font-semibold leading-[47px]">{isReturning ? "Sign in to\nyour pile." : "Make this\npile yours."}</Title>
        <Body className="mt-4 text-[16px] leading-[22px]">{isReturning ? "Access your investments, weekly contributions, and card." : "Keep your choices safe. Sign in to continue."}</Body>
        {!isReturning ? (
          <View className="mt-5 h-[97px] rounded-[18px] bg-pile-fog px-5 py-5">
            <Text className="text-[16px] font-semibold">${amount} every week</Text>
            <Text className="mt-[7px] text-[14px] text-pile-muted">{bundleLabel}</Text>
          </View>
        ) : null}
      </View>
      <View className="mt-auto gap-3 pb-2">
        {currentUser ? (
          <View className="mb-2 rounded-[18px] bg-pile-fog p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-2">
                <Text className="text-[14px] font-semibold text-pile-ink">Already signed in</Text>
                <Text className="mt-0.5 text-[13px] text-pile-muted" numberOfLines={1}>{currentUser}</Text>
              </View>
              {onSignOut ? (
                <Pressable disabled={busy} onPress={onSignOut} className="py-1 px-3 rounded-full bg-[#E5E5E0] active:opacity-60">
                  <Text className="text-[12px] font-medium text-pile-ink">Sign out</Text>
                </Pressable>
              ) : null}
            </View>
            <Button disabled={busy} onPress={onContinue ?? onApple} className="mt-3">
              <Text className="font-semibold text-white">{busy ? "Opening pile…" : "Continue to my pile"}</Text>
            </Button>
          </View>
        ) : (
          <>
            <AppleSignInButton disabled={busy} onPress={onApple} />
            <GoogleSignInButton disabled={busy} onPress={onGoogle} />
            <Pressable disabled={busy} onPress={() => setStep("email")} className="mt-1 py-2 active:opacity-60">
              <Text className="text-center text-[15px] font-medium text-pile-muted">Continue with email</Text>
            </Pressable>
          </>
        )}
        {!isReturning ? (
          <Text className="mt-2 text-center text-[13px] text-pile-muted">Your amount and bundle will be here when you return.</Text>
        ) : null}
        {error ? <Text className="mt-2 text-center text-sm text-red-600">{error}</Text> : null}
      </View>
    </View>
  </Screen>;

  if (step === "email") return <Screen className="pt-0" footer={<><Button disabled={busy || !email.includes("@")} onPress={onEmailSubmit}>{preview ? "Preview plan" : busy ? "Sending…" : "Email me a code"}</Button><Pressable className="pt-3" onPress={() => setStep("method")}><Text className="text-center text-xs text-pile-muted">Use Apple or Google instead</Text></Pressable></>}><View className="pt-[60px]">
    <Eyebrow className="tracking-normal">SECURE SIGN IN</Eyebrow>
    <Title className="mt-4 text-[36px] font-semibold leading-[39px]">Your email,{"\n"}then one code.</Title>
    <Body className="mt-4 text-[16px] leading-[22px]">We’ll email a one-time code. No password or seed phrase.</Body>
    <TextInput className="mt-4 h-[58px] rounded-[18px] bg-pile-fog px-4 text-pile-ink" placeholder="ari@example.com" placeholderTextColor="#8A8984" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
    {!isReturning ? (
      <View className="mt-4 rounded-[18px] bg-pile-fog p-4">
        <Text className="text-[14px] font-semibold">Your choices are saved</Text>
        <Text className="mt-1 text-[13px] text-pile-muted">${amount} each week · {bundleLabel}</Text>
      </View>
    ) : null}
    <Text className="mt-4 text-[13px] text-pile-muted">A secure wallet is created for your Pile account.</Text>
    {preview ? <Text className="mt-4 text-xs text-pile-muted">Expo Go previews the flow without sending a code.</Text> : null}
    {error ? <Text className="mt-4 text-sm text-red-600">{error}</Text> : null}
  </View></Screen>;

  return <Screen className="pt-0" footer={<><Button disabled={busy || code.length !== 6} onPress={() => onVerify?.(code)}>{busy ? "Verifying…" : "Verify and continue"}</Button><View className="flex-row justify-center gap-4 pt-3"><Text className="text-xs text-pile-muted" onPress={onResend}>Resend code</Text><Text className="text-xs text-pile-muted">·</Text><Text className="text-xs text-pile-muted" onPress={() => setStep("email")}>Change email</Text></View></>}><View className="pt-[60px]">
    <Eyebrow className="tracking-normal">CHECK YOUR EMAIL</Eyebrow>
    <Title className="mt-4 text-[36px] font-semibold leading-[39px]">Enter the code{"\n"}we sent.</Title>
    <Body className="mt-4 text-[16px]">Sent to {email}. It expires shortly.</Body>
    <OtpDigitBoxes
      value={code}
      onChange={setCode ?? (() => {})}
      onComplete={(c) => {
        if (onVerify) onVerify(c);
      }}
      disabled={busy}
    />
    <View className="mt-6 rounded-[18px] bg-pile-fog p-4"><Text className="text-[14px] font-semibold">One-time use</Text><Text className="mt-1 text-[13px] text-pile-muted">We’ll never ask for this code outside this sign-in screen.</Text></View>
    {error ? <Text className="mt-4 text-sm text-red-600">{error}</Text> : null}
  </View></Screen>;
}

