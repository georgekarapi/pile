import { create } from "zustand";
import type { Plan } from "@pileup/shared";

type AppState = { plan?: Plan; cardId?: string; setPlan: (plan: Plan) => void; setCardId: (id: string) => void };
export const useAppStore = create<AppState>((set) => ({ setPlan: (plan) => set({ plan }), setCardId: (cardId) => set({ cardId }) }));
