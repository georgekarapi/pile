import { useCallback, useRef } from "react";
import { Animated, View } from "react-native";
import Svg, { Ellipse, G, Path } from "react-native-svg";
import { useFocusEffect } from "expo-router";
import { cn } from "@/lib/cn";

// 1-on-1 vector specs from Pen design (designs/pileup-rock-balance-final.pen, node H3bix)
// Container coordinate system: 314 x 232
const BASE_STONE_PATH =
  "M160.92554 0.64194c15.67004-1.90652 44.96002 0.8515 60.61505 2.83447 50.13995 6.35303 105.75995 16.32001 146.255 48.83252 18.53498 14.88001 33.70996 37.38501 35.72998 61.54498 6.52997 83.23999-102.95001 99.16504-163.065 104.70502-0.78998 0.09998-1.58502 0.185-2.38 0.25-57.52002 4.98498-172.008 8.59998-217.241-30.14502-12.36652-10.59497-19.36249-24.77496-20.61051-40.96997-2.4675-32.01502 15.36899-65.17499 35.76401-88.73499 33.86398-39.11804 74.42249-54.74002 124.93247-58.31701z";

const TOP_STONE_PATH =
  "M80.0957 0.34833c5.65002-0.6745 17.09998-0.2435 22.875 0.23349 38.78998 3.20749 81.69501 15.59299 114.27503 37.182 14.84497 10.07999 32.88495 27.22199 35.81 45.9545 6.82995 43.74399-50.94001 58.18299-82.76001 63.55399-6.22004 0.89352-12.46503 1.643-18.72004 2.24902-41.26995 3.59149-95.54998-0.10251-128.48846-28.00552-13.33051-11.18601-21.591-27.27149-22.91553-44.62299-1.27649-17.79501 4.60352-35.36301 16.33402-48.80401 16.05499-18.4455 39.83499-26.18549 63.58999-27.74048z";

const SIDE_STONE_PATH =
  "M156.13231 0.33304c29.4155-3.06799 39.927 15.38751 36.94699 41.905-7.03049 62.55502-83.22949 179.30502-154.29648 167.29501-22.94951-4.32501-35.55452-22.76001-38.29552-44.95001-3.5715-28.90997 13.07201-59.77002 30.83751-81.685 28.314-34.92502 78.93201-77.0885 124.8075-82.565z";

// Scale factors matching raw path geometry bounds to Pen design layer dimensions
const BASE_SX = 206.72 / 403.80504582822323;
const BASE_SY = 113.56 / 221.83090245723724;

const TOP_SX = 129.88 / 253.61150754988194;
const TOP_SY = 76.84 / 150.66658601164818;

const SIDE_SX = 116.28 / 193.5659266114235;
const SIDE_SY = 126.82 / 210.39275202155113;

export function Pebble({ compact = false, animate = false, className }: { compact?: boolean; animate?: boolean; className?: string }) {
  const scale = compact ? 0.36 : 1;

  // Staggered fall animation (Shadow, Base, Side, Top)
  const shadowOpacity = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const baseFall = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const sideFall = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const topFall = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useFocusEffect(
    useCallback(() => {
      if (!animate) return;
      shadowOpacity.setValue(0);
      baseFall.setValue(0);
      sideFall.setValue(0);
      topFall.setValue(0);

      const animation = Animated.parallel([
        Animated.timing(shadowOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.stagger(140, [
          Animated.spring(baseFall, {
            toValue: 1,
            damping: 14,
            stiffness: 120,
            mass: 0.8,
            useNativeDriver: true,
          }),
          Animated.spring(sideFall, {
            toValue: 1,
            damping: 14,
            stiffness: 120,
            mass: 0.8,
            useNativeDriver: true,
          }),
          Animated.spring(topFall, {
            toValue: 1,
            damping: 14,
            stiffness: 120,
            mass: 0.8,
            useNativeDriver: true,
          }),
        ]),
      ]);

      animation.start();
      return () => animation.stop();
    }, [animate, shadowOpacity, baseFall, sideFall, topFall])
  );

  const baseTranslateY = baseFall.interpolate({ inputRange: [0, 1], outputRange: [-80 * scale, 0] });
  const sideTranslateY = sideFall.interpolate({ inputRange: [0, 1], outputRange: [-80 * scale, 0] });
  const topTranslateY = topFall.interpolate({ inputRange: [0, 1], outputRange: [-80 * scale, 0] });

  return (
    <View
      accessibilityLabel="Pile balanced stone logo"
      className={cn("self-center", className)}
      style={{ width: 314 * scale, height: 232 * scale, position: "relative" }}
    >
      {/* 0. Ground shadow: cx: 167.34, cy: 202.476, rx: 105.4, ry: 12.24 */}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 314 * scale,
          height: 232 * scale,
          opacity: shadowOpacity,
          zIndex: 0,
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 314 232">
          <Ellipse
            cx={61.94 + 210.8 / 2}
            cy={190.236 + 24.48 / 2}
            rx={210.8 / 2}
            ry={24.48 / 2}
            fill="#111110"
            fillOpacity={0.094}
          />
        </Svg>
      </Animated.View>

      {/* 1. Base stone: x: 107.235, y: 96.194, fill: #111110 */}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 314 * scale,
          height: 232 * scale,
          opacity: baseFall,
          transform: [{ translateY: baseTranslateY }],
          zIndex: 1,
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 314 232">
          <G transform={`translate(107.235, 96.194) scale(${BASE_SX}, ${BASE_SY})`}>
            <Path d={BASE_STONE_PATH} fill="#111110" />
          </G>
        </Svg>
      </Animated.View>

      {/* 2. Top stone: x: 145.253, y: 17.284, fill: #171716 */}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 314 * scale,
          height: 232 * scale,
          opacity: topFall,
          transform: [{ translateY: topTranslateY }],
          zIndex: 2,
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 314 232">
          <G transform={`translate(145.253, 17.284) scale(${TOP_SX}, ${TOP_SY})`}>
            <Path d={TOP_STONE_PATH} fill="#171716" />
          </G>
        </Svg>
      </Animated.View>

      {/* 3. Side stone: x: 0, y: 80.02, rotate -15deg around (0,0), fill: #242420 */}
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 314 * scale,
          height: 232 * scale,
          opacity: sideFall,
          transform: [{ translateY: sideTranslateY }],
          zIndex: 3,
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 314 232">
          <G transform={`translate(0, 80.02) rotate(-15) scale(${SIDE_SX}, ${SIDE_SY})`}>
            <Path d={SIDE_STONE_PATH} fill="#242420" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
