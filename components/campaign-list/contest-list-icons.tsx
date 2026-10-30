import type { CSSProperties } from "react";

/** Icons exported from the Contest Details Redesign Figma file. */
const BASE = "/images/contest-list";

export type ContestListIconName =
  | "plus"
  | "search"
  | "layout"
  | "file"
  | "video"
  | "grid"
  | "list"
  | "sort"
  | "chevron-down"
  | "chevron-down-sm"
  | "globe"
  | "layers"
  | "play"
  | "dot-live"
  | "dot-draft"
  | "dot-review"
  | "dot-payments"
  | "youtube"
  | "instagram"
  | "tiktok"
  | "x"
  | "eye"
  | "copy"
  | "arrow-left"
  | "chevron-right"
  | "image"
  | "alert"
  | "dollar"
  | "clock"
  | "edit"
  | "trash"
  | "shield";

export function ContestListIcon({
  name,
  alt = "",
  style,
}: {
  name: ContestListIconName;
  alt?: string;
  style?: CSSProperties;
}) {
  return <img src={`${BASE}/${name}.svg`} alt={alt} style={style} />;
}

/** Segment icons ship in one color. Flip only the opposite state so both pills stay readable. */
const SEGMENT_NATIVE_WHITE = new Set<ContestListIconName>(["layout", "grid"]);

export function ContestListSegmentIcon({
  name,
  active,
}: {
  name: Extract<
    ContestListIconName,
    "layout" | "file" | "video" | "grid" | "list"
  >;
  active: boolean;
}) {
  const nativeWhite = SEGMENT_NATIVE_WHITE.has(name);
  const filter = nativeWhite
    ? active
      ? undefined
      : "brightness(0) invert(45%)"
    : active
      ? "brightness(0) invert(1)"
      : undefined;
  return (
    <ContestListIcon name={name} style={filter ? { filter } : undefined} />
  );
}
