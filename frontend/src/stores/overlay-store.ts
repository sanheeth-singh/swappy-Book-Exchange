"use client";
import { create } from "zustand";
type Confirmation = { title: string; description: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void | Promise<void> };
type OverlayState = { confirmation: Confirmation | null; openConfirmation: (value: Confirmation) => void; close: () => void };
export const useOverlayStore = create<OverlayState>((set) => ({ confirmation: null, openConfirmation: (confirmation) => set({ confirmation }), close: () => set({ confirmation: null }) }));
