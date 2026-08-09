"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

/**
 * openMenu(event, items) where items is an array of either:
 *   { label, icon, onClick, danger?, disabled? }
 *   { divider: true }
 */

const ContextMenuCtx = createContext(null);

export function useContextMenu() {
  const ctx = useContext(ContextMenuCtx);
  if (!ctx) throw new Error("useContextMenu must be used inside ContextMenuProvider");
  return ctx;
}

export function ContextMenuProvider({ children }) {
  const [menu, setMenu] = useState(null); // { x, y, items } | null
  const menuRef = useRef(null);

  const openMenu = useCallback((e, items) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 190;
    const menuHeight = items.length * 30 + 12;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 46);
    setMenu({ x, y, items });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) closeMenu();
    };
    const handleEsc = (e) => e.key === "Escape" && closeMenu();
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [menu, closeMenu]);

  return (
    <ContextMenuCtx.Provider value={{ openMenu, closeMenu }}>
      {children}

      {menu && (
        <div
          ref={menuRef}
          style={{ top: menu.y, left: menu.x }}
          className="fixed z-[9999] min-w-[180px] overflow-hidden rounded-xl border border-border
                     bg-background-elevated py-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.25)]
                     backdrop-blur-2xl backdrop-saturate-150 animate-scale-in"
        >
          {menu.items.map((item, i) =>
            item.divider ? (
              <div key={i} className="my-1 h-px bg-border" />
            ) : (
              <button
                key={i}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick?.();
                  closeMenu();
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px] transition-colors
                  ${item.disabled ? "cursor-not-allowed opacity-35"
                    : item.danger ? "text-red-500 hover:bg-red-500/10"
                    : "text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"}`}
              >
                {item.icon && <item.icon size={13} className="shrink-0" />}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </ContextMenuCtx.Provider>
  );
}
