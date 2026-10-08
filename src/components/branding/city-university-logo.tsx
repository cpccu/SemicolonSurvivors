import Image from "next/image";

export function CityUniversityLogo({ className = "", priority = false }: { className?: string | undefined; priority?: boolean | undefined }) {
  return <Image className={className} src="/branding/city-university-logo.png" width={210} height={111} priority={priority} alt="City University" />;
}

export function CityUniversityMark({ className = "", priority = false }: { className?: string | undefined; priority?: boolean | undefined }) {
  return <Image className={className} src="/branding/city-university-mark.png" width={89} height={60} priority={priority} alt="" />;
}
