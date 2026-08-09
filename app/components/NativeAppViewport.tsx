'use client';

import { useEffect } from 'react';

type CapacitorWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
};

export default function NativeAppViewport() {
  useEffect(() => {
    const capacitor = (window as CapacitorWindow).Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;

    const viewport = document.querySelector('meta[name="viewport"]');
    viewport?.setAttribute('content', 'width=1100, initial-scale=0.38, maximum-scale=3, user-scalable=yes, viewport-fit=cover');
  }, []);

  return null;
}
