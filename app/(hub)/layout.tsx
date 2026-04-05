"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "@/app/components/Sidebar";

export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar className="hidden md:flex" />

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="md:hidden border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Personal Hub</p>
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
        </div>

        {isMenuOpen ? (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="w-[260px] shrink-0 border-r border-gray-200 bg-white shadow-xl">
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-900">Navigation</p>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  aria-label="Close navigation"
                >
                  <X size={20} />
                </button>
              </div>
              <Sidebar hideHeader />
            </div>
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="flex-1 bg-black/20"
              aria-label="Close overlay"
            />
          </div>
        ) : null}

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
