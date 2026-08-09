import React from "react";

// The desktop background itself now comes from <WallpaperLayer /> (mounted
// in Providers, reading the persisted wallpaper setting) — this section is
// just the interactive surface windows/icons sit on top of.
const Page = () => {
  return <section className="relative h-screen w-screen overflow-hidden" />;
};

export default Page;
