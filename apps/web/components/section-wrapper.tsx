import type { ReactNode } from "react";

type SectionWrapperProps = {
  title: string;
  eyebrow?: string;
  id?: string;
  children: ReactNode;
};

export function SectionWrapper({ title, eyebrow, id, children }: SectionWrapperProps) {
  return (
    <section id={id} className="hSection">
      <div className="hSectionHeader">
        {eyebrow ? <span className="hSectionEyebrow">{eyebrow}</span> : null}
        <h2 className="hSectionTitle">{title}</h2>
      </div>
      <div className="hSectionBody">{children}</div>
    </section>
  );
}
