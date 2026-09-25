import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Platform,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState
} from "react-native";
import { cn } from "@/lib/cn";

export interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  trackClassName?: string;
  rangeClassName?: string;
  thumbClassName?: string;
}

const THUMB_SIZE = 28;

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
  trackClassName,
  rangeClassName,
  thumbClassName
}: SliderProps) {
  const containerRef = useRef<View>(null);
  const [containerWidth, setContainerWidth] = useState(300);
  const [isDragging, setIsDragging] = useState(false);
  const containerPageXRef = useRef(0);
  const lastEmittedValue = useRef(value);
  const [dragRatio, setDragRatio] = useState<number | null>(null);

  useEffect(() => {
    lastEmittedValue.current = value;
  }, [value]);

  const usableWidth = Math.max(1, containerWidth - THUMB_SIZE);

  const measureContainer = useCallback(() => {
    containerRef.current?.measure((_x, _y, width, _height, pageX) => {
      if (width > 0) setContainerWidth(width);
      if (typeof pageX === "number") containerPageXRef.current = pageX;
    });
  }, []);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width } = e.nativeEvent.layout;
      if (width > 0) {
        setContainerWidth(width);
      }
      measureContainer();
    },
    [measureContainer]
  );

  const getValueFromPageX = useCallback(
    (pageX: number) => {
      const touchX = pageX - containerPageXRef.current - THUMB_SIZE / 2;
      const ratio = Math.max(0, Math.min(1, touchX / usableWidth));
      const rawValue = min + ratio * (max - min);
      const stepped = Math.min(max, Math.max(min, Math.round(rawValue / step) * step));
      return { stepped, ratio };
    },
    [min, max, step, usableWidth]
  );

  const handleTouch = useCallback(
    (pageX: number, isFinal = false) => {
      const { stepped, ratio } = getValueFromPageX(pageX);
      setDragRatio(isFinal ? null : ratio);
      if (stepped !== lastEmittedValue.current) {
        lastEmittedValue.current = stepped;
        onValueChange(stepped);
      }
    },
    [getValueFromPageX, onValueChange]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          if (disabled) return;
          setIsDragging(true);
          // Measure container again to ensure exact pageX in case screen scrolled
          containerRef.current?.measure((_x, _y, width, _height, pageX) => {
            if (width > 0) setContainerWidth(width);
            if (typeof pageX === "number") containerPageXRef.current = pageX;
            handleTouch(evt.nativeEvent.pageX);
          });
        },
        onPanResponderMove: (evt: GestureResponderEvent, _gestureState: PanResponderGestureState) => {
          if (disabled) return;
          handleTouch(evt.nativeEvent.pageX);
        },
        onPanResponderRelease: (evt: GestureResponderEvent) => {
          setIsDragging(false);
          handleTouch(evt.nativeEvent.pageX, true);
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
          setDragRatio(null);
        },
        onPanResponderTerminationRequest: () => false
      }),
    [disabled, handleTouch]
  );

  // Position thumb
  const activeRatio = dragRatio !== null ? dragRatio : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const thumbLeft = activeRatio * usableWidth;

  return (
    <View
      ref={containerRef}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (disabled) return;
        const delta = event.nativeEvent.actionName === "increment" ? step : -step;
        const next = Math.min(max, Math.max(min, value + delta));
        onValueChange(next);
      }}
      className={cn(
        "relative h-12 w-full justify-center py-2 select-none",
        disabled && "opacity-50",
        className
      )}
    >
      {/* Track */}
      <View
        pointerEvents="none"
        className={cn(
          "h-2 w-full overflow-hidden rounded-full bg-[#E5E5E0]",
          trackClassName
        )}
      >
        {/* Range Fill */}
        <View
          pointerEvents="none"
          className={cn("h-full rounded-full bg-pile-ink", rangeClassName)}
          style={{ width: thumbLeft + THUMB_SIZE / 2 }}
        />
      </View>

      {/* Thumb */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: thumbLeft,
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          transform: [{ scale: isDragging ? 1.12 : 1 }]
        }}
        className={cn(
          "items-center justify-center rounded-full border-2 border-white bg-pile-ink",
          Platform.select({
            ios: "shadow-md shadow-black/25",
            android: "elevation-4",
            default: "shadow"
          }),
          thumbClassName
        )}
      >
        <View className="h-2 w-2 rounded-full bg-white opacity-80" />
      </View>
    </View>
  );
}
