import "../global.css";
import "react-native-get-random-values";
import "fast-text-encoding";
import "@ethersproject/shims";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/expo";
import { StripeProvider } from "@stripe/stripe-react-native";
import { setAccessTokenProvider } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";

function ApiAuthBridge({ children, client }: { children: ReactNode; client: QueryClient }) {
  const { getAccessToken, user } = usePrivy();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => { setAccessTokenProvider(getAccessToken); }, [getAccessToken]);
  useEffect(() => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== userId) {
      client.clear();
      useAppStore.getState().clearUserState();
      previousUserId.current = userId;
    }
  }, [user?.id, client]);
  return <>{children}</>;
}

function NativeProviders({ children, client }: { children: ReactNode; client: QueryClient }) {
  return (
    <PrivyProvider
      appId={process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? "configure-privy-app-id"}
      clientId={process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? "configure-privy-client-id"}
    >
      <StripeProvider
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_configure_me"}
        urlScheme="pile"
      >
        <ApiAuthBridge client={client}>{children}</ApiAuthBridge>
      </StripeProvider>
    </PrivyProvider>
  );
}

function AppProviders({ children, client }: { children: ReactNode; client: QueryClient }) {
  if (Constants.appOwnership === "expo") {
    // Expo Go is a design/demo surface. Auth and card payment stay unavailable
    // there; use `pnpm --filter @pile/mobile run start:dev-client` for them.
    return children;
  }

  return <NativeProviders client={client}>{children}</NativeProviders>;
}

export default function RootLayout() {
  const [client] = useState(() => new QueryClient());
  return <AppProviders client={client}><QueryClientProvider client={client}><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FAFAF8" }, animation: "ios_from_right" }} /></QueryClientProvider></AppProviders>;
}
