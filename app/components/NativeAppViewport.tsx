'use client';

import { useEffect, useState } from 'react';

type CapacitorWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
};

export default function NativeAppViewport() {
  const [nativeApp, setNativeApp] = useState(false);
  const [mode, setMode] = useState<'desktop' | 'mobile'>('mobile');

  useEffect(() => {
    const capacitor = (window as CapacitorWindow).Capacitor;
    const launchMarker = new URLSearchParams(window.location.search).get('nativeApp') === '1';
    const isNative = launchMarker || capacitor?.isNativePlatform?.() || window.localStorage.getItem('music-delight-native-app') === '1';
    if (!isNative) return;

    window.localStorage.setItem('music-delight-native-app', '1');
    setNativeApp(true);
    setMode(window.localStorage.getItem('music-delight-app-view') === 'desktop' ? 'desktop' : 'mobile');
  }, []);

  useEffect(() => {
    if (!nativeApp) return;

    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', mode === 'desktop'
      ? 'width=1100, initial-scale=0.38, maximum-scale=3, user-scalable=yes, viewport-fit=cover'
      : 'width=device-width, initial-scale=1, maximum-scale=3, user-scalable=yes, viewport-fit=cover');
    window.localStorage.setItem('music-delight-app-view', mode);
  }, [mode, nativeApp]);

  if (!nativeApp) return null;

  return <div className="nativeViewSwitch" role="group" aria-label="App layout mode">
    <button className={mode === 'mobile' ? 'active' : ''} onClick={() => setMode('mobile')}>Mobile</button>
    <button className={mode === 'desktop' ? 'active' : ''} onClick={() => setMode('desktop')}>Desktop</button>
    <style jsx>{`
      .nativeViewSwitch{position:fixed;right:12px;bottom:12px;z-index:9999;display:flex;gap:3px;padding:4px;border:1px solid rgba(148,163,184,.28);border-radius:12px;background:rgba(8,13,27,.94);box-shadow:0 10px 28px rgba(0,0,0,.32)}
      button{border:0;border-radius:8px;background:transparent;color:#aeb9cb;padding:7px 9px;font-size:11px;font-weight:800}
      button.active{background:#6854dc;color:#fff}
    `}</style>
  </div>;
}
