import TabPageLayout from "@/app/components/TabPageLayout";
import { Mail } from "lucide-react";

export default function EmailPage() {
  return (
    <TabPageLayout
      title="Email"
      subtitle="Your inbox"
      description="Gmail API — reading inbox first"
      icon={Mail}
    />
  );
}
