import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getVirtualTablePadding,
  getWindowScrollMargin,
  measureVirtualTableRow,
  readCssZoom,
  scaleLayoutToViewport,
  scaleViewportToLayout,
} from "./contest-submissions-virtual-table";

describe("getVirtualTablePadding", () => {
  it("returns zero spacers when no virtual items are mounted", () => {
    assert.deepEqual(getVirtualTablePadding([], 10400, 200), {
      paddingTop: 0,
      paddingBottom: 0,
    });
  });

  it("places spacers above and below the visible window", () => {
    const items = [
      { start: 720, end: 772 },
      { start: 772, end: 824 },
      { start: 824, end: 876 },
    ];
    assert.deepEqual(getVirtualTablePadding(items, 10400, 200), {
      paddingTop: 520,
      paddingBottom: 9724,
    });
  });

  it("does not emit negative padding at the top of the list", () => {
    const items = [{ start: 80, end: 132 }];
    assert.deepEqual(getVirtualTablePadding(items, 200, 80), {
      paddingTop: 0,
      paddingBottom: 148,
    });
  });

  it("keeps spacer + visible range equal to totalSize", () => {
    const scrollMargin = 200;
    const totalSize = 10400;
    const items = [
      { start: 720, end: 772 },
      { start: 772, end: 824 },
      { start: 824, end: 876 },
    ];
    const { paddingTop, paddingBottom } = getVirtualTablePadding(
      items,
      totalSize,
      scrollMargin,
    );
    const visible = items[items.length - 1].end - items[0].start;
    assert.equal(paddingTop + visible + paddingBottom, totalSize);
  });
});

describe("measureVirtualTableRow", () => {
  it("prefers offsetHeight so CSS zoom does not shrink the measurement", () => {
    const element = {
      offsetHeight: 52,
      getBoundingClientRect: () => ({ height: 44.2 }),
    } as unknown as Element;
    assert.equal(measureVirtualTableRow(element, 0.85), 52);
  });

  it("divides zoomed bounding height when offsetHeight is 0", () => {
    const element = {
      offsetHeight: 0,
      getBoundingClientRect: () => ({ height: 44.2 }),
    } as unknown as Element;
    assert.equal(measureVirtualTableRow(element, 0.85), 44.2 / 0.85);
  });
});

describe("getWindowScrollMargin", () => {
  it("converts a zoomed bounding rect into un-zoomed document offset", () => {
    const node = {
      getBoundingClientRect: () => ({ top: 170 }),
    } as unknown as HTMLElement;
    assert.equal(getWindowScrollMargin(node, 80, 0.85), (170 + 80) / 0.85);
  });
});

describe("readCssZoom", () => {
  it("returns 1 when there is no element", () => {
    assert.equal(readCssZoom(null), 1);
  });
});

describe("zoom scale helpers", () => {
  it("round-trips layout and viewport pixels at compact-mode zoom", () => {
    assert.equal(scaleViewportToLayout(85, 0.85), 100);
    assert.equal(scaleLayoutToViewport(100, 0.85), 85);
  });

  it("treats missing zoom as 1", () => {
    assert.equal(scaleViewportToLayout(52, 0), 52);
    assert.equal(scaleLayoutToViewport(52, 0), 52);
  });
});
