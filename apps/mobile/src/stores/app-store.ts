import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { MixId, Plan } from "@pile/shared";

export type { MixId };
type AppState = { plan?: Plan; cardId?: string; draftAmount: number; draftMix: MixId; setPlan: (plan: Plan) => void; setCardId: (id: string) => void; clearUserState: () => void; setDraft: (draft: Partial<Pick<AppState, "draftAmount" | "draftMix">>) => void };
export const useAppStore = create<AppState>()(persist(
  (set) => ({ draftAmount: 50, draftMix: "balanced", setPlan: (plan) => set({ plan }), setCardId: (cardId) => set({ cardId }), clearUserState: () => set({ plan: undefined, cardId: undefined }), setDraft: (draft) => set(draft) }),
  {
    name: "pile-draft-v1",
    storage: createJSONStorage(() => ({
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) => SecureStore.setItemAsync(key, value),
      removeItem: (key) => SecureStore.deleteItemAsync(key)
    })),
    partialize: (state) => ({ draftAmount: state.draftAmount, draftMix: state.draftMix })
  }
));
