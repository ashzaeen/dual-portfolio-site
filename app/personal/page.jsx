import PersonalLanding from "@/components/personal/PersonalLanding";

export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

export default function PersonalLandingPage() {
  return <PersonalLanding />;
}
