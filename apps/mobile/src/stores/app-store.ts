import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { BundleId, MixId, Plan } from "@pile/shared";

export type { BundleId, MixId };

type AppState = {
  plan?: Plan;
  cardId?: string;
  draftAmount: number;
  draftBundle: BundleId;
  draftMix: BundleId;
  setPlan: (plan: Plan) => void;
  setCardId: (id: string) => void;
  clearUserState: () => void;
  setDraft: (draft: Partial<{ draftAmount: number; draftBundle: BundleId; draftMix: BundleId }>) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      draftAmount: 50,
      draftBundle: "bigfour",
      draftMix: "bigfour",
      setPlan: (plan) => set({ plan }),
      setCardId: (cardId) => set({ cardId }),
      clearUserState: () => set({ plan: undefined, cardId: undefined }),
      setDraft: (draft) => {
        const bundle = draft.draftBundle ?? draft.draftMix;
        set({
          ...(draft.draftAmount !== undefined ? { draftAmount: draft.draftAmount } : {}),
          ...(bundle !== undefined ? { draftBundle: bundle, draftMix: bundle } : {})
        });
      }
    }),
    {
      name: "pile-draft-v1",
      storage: createJSONStorage(() => ({
        getItem: (key) => SecureStore.getItemAsync(key),
        setItem: (key, value) => SecureStore.setItemAsync(key, value),
        removeItem: (key) => SecureStore.deleteItemAsync(key)
      })),
      merge: (persistedState: any, currentState) => {
        const bundle = persistedState?.draftBundle ?? persistedState?.draftMix ?? currentState.draftBundle;
        return {
          ...currentState,
          ...persistedState,
          draftBundle: bundle,
          draftMix: bundle
        };
      },
      partialize: (state) => ({
        draftAmount: state.draftAmount,
        draftBundle: state.draftBundle,
        draftMix: state.draftBundle
      })
    }
  )
);
