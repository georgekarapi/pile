import { router } from "expo-router";
import Constants from "expo-constants";
import { useEffect } from "react";
import { usePrivy } from "@privy-io/expo";
import { ArrowRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Pebble } from "@/components/organisms/pebble";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Body, Text, Title } from "@/components/ui/text";

export default function Welcome() {
  return Constants.appOwnership === "expo" ? <ExpoWelcome /> : <NativeWelcome />;
}

function ExpoWelcome() {
  return <WelcomeContent isReturningUser={false} />;
}

function NativeWelcome() {
  const { user, isReady } = usePrivy();

  useEffect(() => {
    if (isReady && user) {
      router.replace({ pathname: "/sign-in", params: { returning: "1" } });
    }
  }, [isReady, user]);

  return <WelcomeContent isReturningUser={Boolean(user)} />;
}

function WelcomeContent({ isReturningUser = false }: { isReturningUser?: boolean }) {
  return (
    <Screen
      scroll={false}
      footerClassName="pb-[52px]"
      footer={
        <>
          <Button
            onPress={() =>
              isReturningUser
                ? router.push({ pathname: "/sign-in", params: { returning: "1" } })
                : router.push("/onboarding")
            }
          >
            <View className="w-full flex-row items-center justify-between">
              <Text className="font-semibold text-white">
                {isReturningUser ? "Go to my pile" : "Start my pile"}
              </Text>
              <ArrowRight size={21} color="#FAFAF8" />
            </View>
          </Button>
          <Pressable
            className="py-4"
            onPress={() => router.push({ pathname: "/sign-in", params: { returning: "1" } })}
          >
            <Text className="text-center text-xs text-pile-muted">
              {isReturningUser ? "Signed in · Tap to open" : "Already have a pile? Sign in"}
            </Text>
          </Pressable>
        </>
      }
    >
      <View className="flex-1">
        <Text className="mt-[34px] text-sm text-pile-muted">A small way to own more</Text>
        <Title className="mt-[9px] text-[36px] font-semibold leading-[42px]">
          A little each week.{"\n"}A pile over time.
        </Title>
        <Body className="mt-[18px] max-w-[342px]">
          Build your investments on repeat. Later, borrow a little against them with your card.
        </Body>
        <Pebble animate className="mt-[36px] self-center" />
        <Text className="mt-[30px] ml-3 text-[15px] leading-5 text-pile-muted">
          Start with what feels comfortable.{"\n"}Make room for the life you want.
        </Text>
      </View>
    </Screen>
  );
}
