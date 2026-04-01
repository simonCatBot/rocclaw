import Image from "next/image";

export const HeaderBar = () => {
  return (
    <div className="ui-topbar border-none relative z-[180]">
      <div className="grid h-24 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-3 sm:px-4 md:px-5">
        <div aria-hidden="true" />
        <div className="flex items-center justify-center">
          <div className="relative flex h-28 w-auto items-center justify-center overflow-hidden">
            <Image
              src="/logo.png"
              alt="rocCLAW control"
              width={400}
              height={112}
              className="h-28 w-auto object-contain"
              priority
            />
          </div>
        </div>
        <div aria-hidden="true" />
      </div>
    </div>
  );
};
