import type { PointerEvent } from "react";

export type ArrowDir = "up" | "down" | "left" | "right";

/**
 * A four-way pad for phones.
 *
 * Keyboard control is invisible on a phone: the snake games were playable with
 * arrows and WASD only, so on a touchscreen the board simply sat there. The pad
 * is hidden from `sm` up so it never appears next to a real keyboard, and it
 * fires on `pointerdown` rather than `click` so the turn lands on the press
 * instead of the release.
 */
export default function OnScreenArrows({
  onDir,
}: {
  onDir: (dir: ArrowDir) => void;
}) {
  const button =
    "w-14 h-14 rounded-xl border border-white/15 bg-white/10 active:bg-white/25 text-white text-xl font-bold flex items-center justify-center select-none touch-none";

  const press = (dir: ArrowDir) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onDir(dir);
  };

  return (
    <div className="sm:hidden mt-3 flex flex-col items-center gap-2 select-none">
      <button type="button" className={button} onPointerDown={press("up")} aria-label="Up">
        ▲
      </button>
      <div className="flex gap-2">
        <button type="button" className={button} onPointerDown={press("left")} aria-label="Left">
          ◀
        </button>
        <button type="button" className={button} onPointerDown={press("down")} aria-label="Down">
          ▼
        </button>
        <button type="button" className={button} onPointerDown={press("right")} aria-label="Right">
          ▶
        </button>
      </div>
    </div>
  );
}
