import { getIosAppTarget, type IosAppTarget } from "../lib/ios-app";
import { Button, type ButtonSize } from "./ui/button";

type IosViewerCtaVariant = "badge" | "text";

type IosViewerCtaProps = {
  /** `badge` is the black App Store style pill; `text` an underlined word. */
  variant?: IosViewerCtaVariant;
  size?: ButtonSize;
  className?: string;
  note?: boolean;
  /** Client components pass the target in, since the public env is only
      inlined for literal `process.env.NEXT_PUBLIC_*` reads on the client. */
  target?: IosAppTarget;
};

function AppleMark() {
  return (
    <svg viewBox="1.8 -1.2 20.4 26.4" overflow="visible" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

export function IosViewerCta({
  variant = "badge",
  size,
  className,
  note = false,
  target = getIosAppTarget(),
}: IosViewerCtaProps) {
  return (
    <span className={["iosViewerCtaWrap", className].filter(Boolean).join(" ")}>
      {variant === "badge" ? (
        <Button
          variant="ink"
          size={size}
          data-provider="apple"
          className="iosViewerCta iosViewerCtaStore"
          href={target.href}
          external={target.external}
        >
          <AppleMark />
          <span>{target.label}</span>
          {target.beta ? <span className="iosViewerCtaBetaMark">Beta</span> : null}
        </Button>
      ) : (
        <Button
          variant="link"
          className="iosViewerCta iosViewerCtaText"
          href={target.href}
          external={target.external}
        >
          {target.label}
        </Button>
      )}
      {note ? <small className="iosViewerCtaNote">{target.note}</small> : null}
    </span>
  );
}
