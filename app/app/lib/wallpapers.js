// Curated wallpaper presets. Pure CSS (gradients/solids) rather than hot-linked
// images — loads instantly, never breaks, and looks clean at any window size.
// A user's own uploaded image is stored separately (see useSettingsStore) and
// always takes priority when selected.

export const WALLPAPER_PRESETS = [
  {
    id: "default",
    label: "Default",
    css: "radial-gradient(circle at 20% 20%, #2b2f77 0%, #14162b 45%, #0a0b14 100%)",
  },
  {
    id: "aurora",
    label: "Aurora",
    css: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
  },
  {
    id: "sunset",
    label: "Sunset",
    css: "linear-gradient(160deg, #ff9966 0%, #ff5e62 45%, #6a3093 100%)",
  },
  {
    id: "forest",
    label: "Forest",
    css: "linear-gradient(150deg, #134e5e 0%, #71b280 100%)",
  },
  {
    id: "candy",
    label: "Candy",
    css: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  },
  {
    id: "mono",
    label: "Slate",
    css: "linear-gradient(160deg, #3a3f4a 0%, #16181d 100%)",
  },
  {
    id: "ocean",
    label: "Ocean",
    css: "linear-gradient(135deg, #005c97 0%, #363795 100%)",
  },
  {
    id: "dawn",
    label: "Dawn",
    css: "linear-gradient(150deg, #f7971e 0%, #ffd200 100%)",
  },
];

export function getWallpaperCss(id) {
  return WALLPAPER_PRESETS.find((w) => w.id === id)?.css ?? WALLPAPER_PRESETS[0].css;
}

/**
 * Downscales/compresses a user-uploaded image before it goes into
 * localStorage (persisted settings) — an unscaled photo can easily be
 * several MB, which risks blowing the ~5-10MB localStorage quota. Caps the
 * longest edge at 1920px and re-encodes as JPEG at 0.82 quality.
 */
export function processWallpaperFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't read that image"));
      img.onload = () => {
        const maxEdge = 1920;
        let { width, height } = img;
        if (width > maxEdge || height > maxEdge) {
          const scale = maxEdge / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
