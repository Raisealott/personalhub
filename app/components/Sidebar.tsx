"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  NotebookPen,
  CheckSquare,
  Wallet,
  MessageSquare,
  Mail,
  FolderOpen,
} from "lucide-react";

const navItems = [
  {
    href: "/calendar",
    label: "Calendar",
    icon: Calendar,
    dot: true,
  },
  {
    href: "/notes",
    label: "Notes",
    icon: NotebookPen,
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: CheckSquare,
  },
  {
    href: "/folders",
    label: "Folders",
    icon: FolderOpen,
  },
  {
    href: "/wallet",
    label: "Wallet",
    icon: Wallet,
  },
  {
    href: "/messaging",
    label: "Messaging",
    icon: MessageSquare,
  },
  {
    href: "/email",
    label: "Email",
    icon: Mail,
  },
];

export default function Sidebar({ className = "", hideHeader = false }: { className?: string; hideHeader?: boolean; }) {
  const pathname = usePathname();

  return (
    <aside className={`${className} w-[220px] shrink-0 h-full flex flex-col bg-white border-r border-gray-200`}>
      {!hideHeader ? (
        <div className="px-4 py-5 border-b border-gray-200">
          <p className="text-sm font-semibold text-gray-900">Personal Hub</p>
          <p className="text-xs text-gray-500 mt-0.5">Your private workspace</p>
        </div>
      ) : null}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, dot }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-gray-100 text-gray-900 border border-gray-200 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent"
              }`}
            >
              <Icon size={16} className={isActive ? "text-gray-700" : "text-gray-400"} />
              <span className="flex-1">{label}</span>
              {dot && (
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-white">R</span>
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-gray-900 truncate">Raise</p>
            <p className="text-xs text-gray-500 truncate">raise@gmail.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
