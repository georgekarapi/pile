import "../global.css";
import "react-native-get-random-values";
import "fast-text-encoding";
import "@ethersproject/shims";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState, type ReactNode } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/expo";
import { StripeProvider } from "@stripe/stripe-react-native";
import { setAccessTokenProvider } from "@/lib/api";

function ApiAuthBridge({ children }: { children: ReactNode }) {
  const { getAccessToken } = usePrivy();
  useEffect(() => { setAccessTokenProvider(getAccessToken); }, [getAccessToken]);
  return children;
}

export default function RootLayout() {
  const [client] = useState(() => new QueryClient());
  return <PrivyProvider appId={process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? "configure-privy-app-id"} clientId={process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? "configure-privy-client-id"}>
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_configure_me"} urlScheme="pileup">
      <ApiAuthBridge><QueryClientProvider client={client}><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#09090B" } }} /></QueryClientProvider></ApiAuthBridge>
    </StripeProvider>
  </PrivyProvider>;
}
