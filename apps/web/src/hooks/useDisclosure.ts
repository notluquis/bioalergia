import { useState } from "react";

export type UseDisclosureControls = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  set: (value: boolean) => void;
};

export function useDisclosure(initialState = false): UseDisclosureControls {
  const [isOpen, setIsOpen] = useState<boolean>(initialState);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((value) => !value);
  const set = (value: boolean) => setIsOpen(value);

  return { isOpen, open, close, toggle, set };
}
