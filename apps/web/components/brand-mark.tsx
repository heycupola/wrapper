import Image from "next/image";

export function BrandMark({
  className = "logo-container",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={className} aria-hidden="true">
      <Image
        src="/wrapper-icon-light.svg"
        alt=""
        width={40}
        height={40}
        className="logo logo-light"
        priority={priority}
      />
      <Image
        src="/wrapper-icon-dark.svg"
        alt=""
        width={40}
        height={40}
        className="logo logo-dark"
        priority={priority}
      />
    </span>
  );
}
