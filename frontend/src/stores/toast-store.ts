"use client";
import { create } from "zustand";
type Toast = { id: number; message: string; tone: "success" | "error" };
type ToastState = { items: Toast[]; show: (message: string, tone?: Toast["tone"]) => void; dismiss: (id: number) => void };
let nextId = 0;
export const useToastStore = create<ToastState>((set, get) => ({ items: [], show: (message, tone = "success") => { const id = ++nextId; set((state) => ({ items: [...state.items, { id, message, tone }].slice(-3) })); setTimeout(() => get().dismiss(id), 7000); }, dismiss: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })) }));
