import { useCallback, useState } from "react";

export type UseDisclosureControls = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  set: (value: boolean) => void;
};

export function useDisclosure(initialState = false): UseDisclosureControls {
  const [isOpen, setIsOpen] = useState<boolean>(initialState);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((value) => !value), []);
  const set = useCallback((value: boolean) => setIsOpen(value), []);

  return { isOpen, open, close, toggle, set };
}
