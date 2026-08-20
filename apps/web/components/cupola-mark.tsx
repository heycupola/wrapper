import Image from "next/image";

export function CupolaMark() {
  return (
    <>
      <Image
        src="/cupola-dark.svg"
        alt=""
        width={92}
        height={22}
        className="cupolaMark cupolaMark-light"
      />
      <Image
        src="/cupola-light.svg"
        alt=""
        width={92}
        height={22}
        className="cupolaMark cupolaMark-dark"
      />
    </>
  );
}
