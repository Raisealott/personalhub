import TabPageLayout from "@/app/components/TabPageLayout";
import { Wallet } from "lucide-react";

export default function WalletPage() {
  return (
    <TabPageLayout
      title="Wallet"
      subtitle="Track your personal finances"
      description="Manual entry to start"
      icon={Wallet}
    />
  );
}
