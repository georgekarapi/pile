import { useLoginWithEmail, useLoginWithOAuth } from "@privy-io/expo";
import { router } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";

export default function SignIn() {
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { login } = useLoginWithOAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async () => {
    try {
      setError(undefined);
      if (!sent) { await sendCode({ email }); setSent(true); }
      else { await loginWithCode({ email, code }); router.replace("/onboarding"); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to sign in"); }
  };
  const oauth = async (provider: "google" | "apple") => {
    try { setError(undefined); await login({ provider }); router.replace("/onboarding"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to sign in"); }
  };
  return <SafeAreaView className="flex-1 bg-zinc-950 px-6"><View className="flex-1 justify-center"><Text className="text-4xl font-bold text-white">Welcome in.</Text><Text className="mt-3 text-zinc-400">Use email, Google, or Apple to create your Pileup wallet.</Text><TextInput className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white" placeholder="you@example.com" placeholderTextColor="#71717A" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!sent} />{sent ? <TextInput className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white" placeholder="One-time code" placeholderTextColor="#71717A" keyboardType="number-pad" value={code} onChangeText={setCode} /> : null}<Button className="mt-5" onPress={submit}>{sent ? "Verify email" : "Send code"}</Button><View className="mt-3 flex-row gap-3"><Button className="flex-1" variant="secondary" onPress={() => oauth("google")}>Google</Button><Button className="flex-1" variant="secondary" onPress={() => oauth("apple")}>Apple</Button></View>{error ? <Text className="mt-3 text-red-300">{error}</Text> : null}</View></SafeAreaView>;
}
