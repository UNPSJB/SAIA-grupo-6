import { vi } from "vitest";
Object.defineProperty(window, "matchMedia", { value: vi.fn().mockImplementation(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })) });
