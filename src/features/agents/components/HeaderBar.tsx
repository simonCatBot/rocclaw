// MIT License - Copyright (c) 2026 SimonCatBot
// See LICENSE file for details.

"use client";

import Image from "next/image";

export const HeaderBar = () => {
  return (
    <header className="ui-topbar border-none relative z-[180]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-xs focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>
      <div className="grid h-[7.5rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3 sm:px-4 md:px-5">
        {/* Left — spacer */}
        <div className="flex items-center gap-2" />

        {/* Center — logo */}
        <div className="flex items-center justify-center">
          <div className="relative flex h-[7.5rem] w-auto items-center justify-center overflow-hidden">
            <Image
              src="/logo.png"
              alt="rocCLAW control"
              width={400}
              height={112}
              className="h-[7.5rem] w-auto object-contain"
              priority
            />
          </div>
        </div>

        {/* Right — spacer for balance */}
        <div className="flex items-center justify-end gap-2" />
      </div>
    </header>
  );
};
