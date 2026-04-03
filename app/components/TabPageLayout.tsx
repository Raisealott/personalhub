import { LucideIcon } from "lucide-react";

interface TabPageLayoutProps {
  title: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
}

export default function TabPageLayout({
  title,
  subtitle,
  description,
  icon: Icon,
}: TabPageLayoutProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="px-8 py-5 border-b border-gray-200 bg-white">
        <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>

      {/* Empty state */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Icon size={20} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700">{title} coming soon</p>
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}
