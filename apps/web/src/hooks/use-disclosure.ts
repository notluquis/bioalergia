import { useState } from "react";

export interface UseDisclosureControls {
  close: () => void;
  isOpen: boolean;
  open: () => void;
  set: (value: boolean) => void;
  toggle: () => void;
}

export function useDisclosure(initialState = false): UseDisclosureControls {
  const [isOpen, setIsOpen] = useState<boolean>(initialState);

  const open = () => {
    setIsOpen(true);
  };
  const close = () => {
    setIsOpen(false);
  };
  const toggle = () => {
    setIsOpen((value) => !value);
  };
  const set = (value: boolean) => {
    setIsOpen(value);
  };

  return { close, isOpen, open, set, toggle };
}
