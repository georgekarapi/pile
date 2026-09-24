import { useEffect, useRef } from "react";
import { Animated, Image, View } from "react-native";
import { cn } from "@/lib/cn";

const stones = [
  { source: require("../../../assets/pen-stones/jQKu4.png"), x: 61.94, y: 190.24, width: 210.8, height: 24.48 },
  { source: require("../../../assets/pen-stones/t3pOb.png"), x: 0, y: 80.02, width: 145.14, height: 152.59 },
  { source: require("../../../assets/pen-stones/b6Rta.png"), x: 107.24, y: 96.19, width: 206.72, height: 113.56 },
  { source: require("../../../assets/pen-stones/kJZfD.png"), x: 145.25, y: 17.28, width: 129.88, height: 76.84 },
] as const;

export function Pebble({ compact = false, animate = false, className }: { compact?: boolean; animate?: boolean; className?: string }) {
  const scale = compact ? 0.36 : 1;
  const falls = useRef(stones.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!animate) return;
    falls.forEach((value) => value.setValue(0));
    const animation = Animated.stagger(180, falls.map((value) => Animated.spring(value, {
      toValue: 1,
      damping: 13,
      stiffness: 110,
      mass: 0.8,
      useNativeDriver: true,
    })));
    animation.start();
    return () => animation.stop();
  }, [animate, falls]);

  return <View accessibilityLabel="Pileup balanced stone logo" className={cn("self-center", className)} style={{ width: 314 * scale, height: 232 * scale }}>
    {stones.map((stone, index) => {
      const style = {
        position: "absolute" as const,
        left: stone.x * scale,
        top: stone.y * scale,
        width: stone.width * scale,
        height: stone.height * scale,
      };
      if (!animate) return <Image key={index} source={stone.source} resizeMode="stretch" style={style} />;
      return <Animated.Image key={index} source={stone.source} resizeMode="stretch" style={{
        ...style,
        opacity: falls[index],
        transform: [{ translateY: falls[index].interpolate({ inputRange: [0, 1], outputRange: [-90 * scale, 0] }) }],
      }} />;
    })}
  </View>;
}
