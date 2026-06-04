import ProLanding from "@/components/professional/ProLanding";

// Dev re-fetches every request so Notion edits show on refresh; prod uses
// 1hr ISR. Matches the personal-side cadence (see reference_notion_cms).
export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

export default function ProfessionalLanding() {
  return <ProLanding />;
}
