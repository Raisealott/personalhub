import TabPageLayout from "@/app/components/TabPageLayout";
import { MessageSquare } from "lucide-react";

export default function MessagingPage() {
  return (
    <TabPageLayout
      title="Messaging"
      subtitle="Your conversations"
      description="Coming soon"
      icon={MessageSquare}
    />
  );
}
