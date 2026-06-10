import React from "react";
import { GOC_TAGLINE } from "@/lib/report-export-branding";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Font,
} from "@react-pdf/renderer";

/** A4 portrait in points — explicit size avoids viewer scaling issues */
export const A4_WIDTH = 595.28;
export const A4_HEIGHT = 841.89;
export const SAFE_INSET = 36;
export const FOOTER_ZONE_HEIGHT = 56;

export const PREMIUM_C = {
  navy: "#06021D",
  navyMid: "#170337",
  navyCard: "#12082A",
  navyCardTop: "#231045",
  navyPanel: "#0C0618",
  gold: "#C9A227",
  goldLight: "#D4AF37",
  goldBright: "#F5B942",
  white: "#FFFFFF",
  muted: "#9494B0",
  mutedLight: "#C8C8DC",
  purpleDark: "#37206E",
  purplePill: "#5837A8",
  purplePillBorder: "#6D28D9",
  /** Use hex borders in React-PDF — rgba can render incorrectly in some viewers */
  goldBorder: "#C9A227",
  goldBorderSoft: "#8B7232",
  dividerDark: "#2A1F45",
};

let fontsRegistered = false;

export function registerPremiumFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;
  Font.register({
    family: "Inter",
    fonts: [
      {
        src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-400-normal.woff",
        fontWeight: 400,
      },
      {
        src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-600-normal.woff",
        fontWeight: 600,
      },
      {
        src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-700-normal.woff",
        fontWeight: 700,
      },
    ],
  });
}

export const premiumPageStyle = StyleSheet.create({
  page: {
    width: A4_WIDTH,
    height: A4_HEIGHT,
    backgroundColor: PREMIUM_C.navy,
    color: PREMIUM_C.white,
    fontFamily: "Inter",
    flexDirection: "column",
  },
  bgSvg: {
    position: "absolute",
    top: 0,
    left: 0,
    width: A4_WIDTH,
    height: A4_HEIGHT,
  },
  frame: {
    position: "absolute",
    top: SAFE_INSET - 10,
    left: SAFE_INSET - 10,
    right: SAFE_INSET - 10,
    bottom: SAFE_INSET - 10,
    borderWidth: 1,
    borderColor: PREMIUM_C.goldBorder,
  },
  body: {
    flex: 1,
    paddingTop: SAFE_INSET,
    paddingHorizontal: SAFE_INSET + 10,
    paddingBottom: 8,
  },
  footerZone: {
    paddingHorizontal: SAFE_INSET + 10,
    paddingBottom: SAFE_INSET,
    minHeight: FOOTER_ZONE_HEIGHT,
  },
});

export function PremiumBackground({ idSuffix = "a" }: { idSuffix?: string }) {
  const bgId = `bgGrad-${idSuffix}`;
  const waveId = `waveGrad-${idSuffix}`;

  return (
    <Svg style={premiumPageStyle.bgSvg} viewBox={`0 0 ${A4_WIDTH} ${A4_HEIGHT}`}>
      <Defs>
        <LinearGradient id={bgId} x1="0" y1="0" x2="0.45" y2="1">
          <Stop offset="0%" stopColor="#1E1045" />
          <Stop offset="42%" stopColor="#0A0520" />
          <Stop offset="100%" stopColor="#06021D" />
        </LinearGradient>
        <LinearGradient id={waveId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#6366F1" stopOpacity={0} />
          <Stop offset="45%" stopColor="#818CF8" stopOpacity={0.35} />
          <Stop offset="100%" stopColor="#A855F7" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width={A4_WIDTH} height={A4_HEIGHT} fill={`url(#${bgId})`} />
      <Circle cx={520} cy={300} r={130} fill="#6366F1" opacity={0.07} />
      <Circle cx={490} cy={480} r={150} fill="#7C3AED" opacity={0.05} />
      <Path
        d="M380 60 C480 100, 560 180, 545 300 S460 460, 510 600 S590 740, 470 810"
        stroke={`url(#${waveId})`}
        strokeWidth={2}
        fill="none"
        opacity={0.55}
      />
      <Path
        d="M450 30 C540 80, 610 160, 580 280 S490 420, 530 560 S610 700, 490 780"
        stroke={`url(#${waveId})`}
        strokeWidth={1.5}
        fill="none"
        opacity={0.4}
      />
      <Path
        d="M320 180 C400 220, 470 300, 440 400 S360 540, 400 660"
        stroke={`url(#${waveId})`}
        strokeWidth={1.2}
        fill="none"
        opacity={0.25}
      />
    </Svg>
  );
}

export function PremiumFrameDecor() {
  const g = PREMIUM_C.goldBorder;
  return (
    <Svg style={premiumPageStyle.bgSvg} viewBox={`0 0 ${A4_WIDTH} ${A4_HEIGHT}`}>
      <Path d="M30 58 L30 30 L58 30" stroke={g} strokeWidth={1.5} fill="none" />
      <Circle cx={44} cy={36} r={2} fill={g} />
      <Path d="M565 58 L565 30 L537 30" stroke={g} strokeWidth={1.5} fill="none" />
      <Circle cx={551} cy={36} r={2} fill={g} />
      <Path d="M30 784 L30 812 L58 812" stroke={g} strokeWidth={1.5} fill="none" />
      <Circle cx={44} cy={806} r={2} fill={g} />
      <Path d="M565 784 L565 812 L537 812" stroke={g} strokeWidth={1.5} fill="none" />
      <Circle cx={551} cy={806} r={2} fill={g} />
    </Svg>
  );
}

export function PremiumFrame() {
  return <View style={premiumPageStyle.frame} fixed />;
}

export function sanitizePdfDisplayText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u00AC]/g, "")
    .replace(/^[\u2039\u203A\u00AB\u00BB<>\u0080-\u009F]+/u, "")
    .trimStart();
}

/** Prevent orphan "Name:" lines and strip soft-hyphen artifacts from PDF line breaking */
export function normalizePdfTitleText(text: string): string {
  return sanitizePdfDisplayText(text).replace(/:\s+/g, ":\u00A0");
}

/** Insert explicit line breaks so React-PDF does not orphan short prefixes like "Ranveer:" */
export function wrapPdfTitleLines(text: string): string {
  const normalized = normalizePdfTitleText(text);
  if (normalized.length <= 44) return normalized;

  const parenMatch = normalized.match(/^(.{10,}?)\s(\(.+\))$/);
  if (parenMatch && parenMatch[1].length <= 48) {
    return `${parenMatch[1]}\n${parenMatch[2]}`;
  }

  const commaIdx = normalized.indexOf(", ");
  if (commaIdx > 10 && commaIdx < 42) {
    return `${normalized.slice(0, commaIdx + 1)}\n${normalized.slice(commaIdx + 2)}`;
  }

  return normalized;
}

const pdfTitleStyles = StyleSheet.create({
  block: {
    width: "100%",
    paddingHorizontal: 52,
    alignSelf: "stretch",
  },
  text: {
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.45,
    textAlign: "center",
    width: "100%",
  },
});

export function PdfCampaignTitle({
  text,
  color,
  fontSize = 11,
  compact = false,
}: {
  text: string;
  color: string;
  fontSize?: number;
  compact?: boolean;
}) {
  const wrapped = wrapPdfTitleLines(text);

  return (
    <View style={pdfTitleStyles.block}>
      <Text
        style={[
          pdfTitleStyles.text,
          {
            color,
            fontSize: compact ? Math.max(9.5, fontSize - 1.5) : fontSize,
          },
        ]}
      >
        {wrapped}
      </Text>
    </View>
  );
}

export function PremiumHeader({
  shieldLogoSrc,
}: {
  shieldLogoSrc?: string | null;
}) {
  return (
    <View style={headerStyles.row}>
      <Text style={headerStyles.tagline}>{GOC_TAGLINE}</Text>
      {shieldLogoSrc ? (
        <Image src={shieldLogoSrc} style={headerStyles.shieldLogo} />
      ) : (
        <Text style={headerStyles.shieldFallback}>GAME OF{"\n"}CREATORS</Text>
      )}
    </View>
  );
}

export function CoverPageHeader({
  shieldLogoSrc,
  reportId,
  generatedTimestamp,
  dataScopeLabel,
}: {
  shieldLogoSrc?: string | null;
  reportId: string;
  generatedTimestamp: string;
  dataScopeLabel: string;
}) {
  return (
    <View style={coverHeaderStyles.wrap}>
      <View style={coverHeaderStyles.row}>
        <View style={coverHeaderStyles.left}>
          <Text style={coverHeaderStyles.meta}>Report ID: {reportId}</Text>
          <Text style={coverHeaderStyles.meta}>Generated: {generatedTimestamp}</Text>
          <Text style={coverHeaderStyles.verified}>{dataScopeLabel}</Text>
        </View>
        {shieldLogoSrc ? (
          <Image src={shieldLogoSrc} style={coverHeaderStyles.shieldLogo} />
        ) : (
          <Text style={coverHeaderStyles.shieldFallback}>GAME OF{"\n"}CREATORS</Text>
        )}
      </View>
      <View style={coverHeaderStyles.rule} />
    </View>
  );
}

const coverHeaderStyles = StyleSheet.create({
  wrap: {
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  left: {
    flex: 1,
    paddingRight: 12,
    maxWidth: 380,
  },
  tagline: {
    fontSize: 6.5,
    color: PREMIUM_C.muted,
    lineHeight: 1.4,
    marginBottom: 5,
  },
  meta: {
    fontSize: 6,
    color: PREMIUM_C.muted,
    lineHeight: 1.45,
  },
  verified: {
    marginTop: 2,
    fontSize: 6,
    fontWeight: 600,
    color: PREMIUM_C.goldBorderSoft,
    lineHeight: 1.45,
  },
  rule: {
    marginTop: 6,
    height: 1,
    backgroundColor: PREMIUM_C.goldBorderSoft,
  },
  shieldLogo: {
    width: 42,
    height: 48,
    objectFit: "contain",
    flexShrink: 0,
  },
  shieldFallback: {
    fontSize: 8,
    color: PREMIUM_C.gold,
    textAlign: "right",
  },
});

const headerStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 16,
  },
  tagline: {
    flex: 1,
    fontSize: 6.5,
    color: PREMIUM_C.muted,
    lineHeight: 1.4,
    maxWidth: 340,
  },
  shieldLogo: {
    width: 44,
    height: 50,
    objectFit: "contain",
    flexShrink: 0,
  },
  shieldFallback: {
    fontSize: 8,
    color: PREMIUM_C.gold,
    textAlign: "right",
  },
});

/** Compact TOC header — no tagline to avoid long text bleeding into the hero block */
export function TocPageHeader({
  shieldLogoSrc,
}: {
  shieldLogoSrc?: string | null;
}) {
  return (
    <View style={tocHeaderStyles.row}>
      {shieldLogoSrc ? (
        <Image src={shieldLogoSrc} style={tocHeaderStyles.shieldLogo} />
      ) : (
        <Text style={tocHeaderStyles.shieldFallback}>GAME OF CREATORS</Text>
      )}
    </View>
  );
}

const tocHeaderStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 14,
  },
  shieldLogo: {
    width: 40,
    height: 46,
    objectFit: "contain",
  },
  shieldFallback: {
    fontSize: 8,
    color: PREMIUM_C.gold,
    textAlign: "right",
  },
});

export type TocSection = {
  title: string;
  pageNumber: number;
};

/** Link overlay positions (pt from page top) — keep in sync with TocPageContent layout */
export const TOC_LINK_RECTS = {
  firstRowTop: 210,
  rowHeight: 29,
};

export function TocPageContent({
  campaignName,
  sections,
}: {
  campaignName: string;
  sections: TocSection[];
  longName?: boolean;
}) {
  const longName = campaignName.length > 48;

  return (
    <View style={tocStyles.wrap}>
      <View style={tocStyles.hero}>
        <Text style={tocStyles.heading}>Table of Contents</Text>
        <PdfCampaignTitle
          text={campaignName}
          color={PREMIUM_C.goldLight}
          compact={longName}
        />
        <View style={tocStyles.rule} />
      </View>
      <View style={tocStyles.list}>
        {sections.map((section, i) => (
          <View key={`${section.title}-${i}`} style={tocStyles.row}>
            <Text style={tocStyles.rowTitle}>
              {i + 1}. {section.title}
            </Text>
            <View style={tocStyles.dots} />
            <Text style={tocStyles.rowPage}>{section.pageNumber}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const tocStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 0,
    paddingBottom: 40,
    width: "100%",
  },
  hero: {
    alignItems: "center",
    marginBottom: 20,
    width: "100%",
  },
  heading: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: PREMIUM_C.white,
    marginBottom: 10,
    textAlign: "center",
    width: "100%",
  },
  rule: {
    marginTop: 16,
    width: 400,
    height: 1,
    backgroundColor: PREMIUM_C.goldBorder,
  },
  list: {
    paddingTop: 4,
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 18,
    width: "100%",
  },
  rowTitle: {
    fontSize: 10.5,
    color: PREMIUM_C.white,
    flexShrink: 1,
    flexGrow: 1,
    maxWidth: 340,
    lineHeight: 1.35,
  },
  dots: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 28,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(160,160,184,0.55)",
    borderStyle: "dotted",
    marginHorizontal: 6,
    marginBottom: 3,
  },
  rowPage: {
    fontSize: 10.5,
    fontWeight: 700,
    color: PREMIUM_C.goldLight,
    minWidth: 22,
    textAlign: "right",
  },
});

export function CoverTrustBar({
  reportId,
  generatedTimestamp,
  dataScopeLabel,
}: {
  reportId: string;
  generatedTimestamp: string;
  dataScopeLabel: string;
}) {
  return (
    <View style={trustStyles.wrap}>
      <Text style={trustStyles.line}>
        Report ID: {reportId}  ·  {dataScopeLabel}
      </Text>
      <Text style={trustStyles.timestamp}>Generated {generatedTimestamp}</Text>
    </View>
  );
}

const trustStyles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: PREMIUM_C.dividerDark,
  },
  line: {
    fontSize: 6.5,
    color: PREMIUM_C.muted,
    letterSpacing: 0.2,
  },
  timestamp: {
    marginTop: 3,
    fontSize: 6.5,
    color: PREMIUM_C.muted,
  },
});

export function CoverPageFooter({
  exportDate,
  filters,
  engineLabel,
}: {
  exportDate: string;
  filters: string;
  engineLabel: string;
}) {
  return (
    <View style={coverFooterStyles.wrap}>
      <Text style={coverFooterStyles.engine}>{engineLabel}</Text>
      <View style={coverFooterStyles.rule} />
      <View style={coverFooterStyles.row}>
        <CoverFooterCol
          icon={<IconCalendarSmall />}
          label="Report Export Date"
          value={exportDate}
          bordered
        />
        <CoverFooterCol
          icon={<IconFunnelSmall />}
          label="Filters Applied"
          value={filters}
          bordered
        />
        <CoverFooterCol
          icon={<IconLockSmall />}
          label="Confidential"
          value="For Internal Use Only"
        />
      </View>
    </View>
  );
}

function CoverFooterCol({
  icon,
  label,
  value,
  bordered,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <View style={[coverFooterStyles.col, bordered ? coverFooterStyles.colBorder : null]}>
      <View style={coverFooterStyles.iconSlot}>{icon}</View>
      <Text style={coverFooterStyles.label}>{label}</Text>
      <Text style={coverFooterStyles.value}>{value}</Text>
    </View>
  );
}

const coverFooterStyles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  engine: {
    fontSize: 6.5,
    color: PREMIUM_C.muted,
    textAlign: "center",
    marginBottom: 6,
  },
  rule: {
    height: 1,
    backgroundColor: PREMIUM_C.goldBorder,
    opacity: 0.65,
    marginBottom: 7,
  },
  row: {
    flexDirection: "row",
  },
  col: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  colBorder: {
    borderRightWidth: 1,
    borderRightColor: PREMIUM_C.goldBorderSoft,
  },
  iconSlot: {
    height: 13,
    marginBottom: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 6.5,
    color: PREMIUM_C.muted,
    textAlign: "center",
  },
  value: {
    fontSize: 7.5,
    fontWeight: 600,
    color: PREMIUM_C.white,
    marginTop: 2,
    textAlign: "center",
    maxWidth: 150,
  },
});

export function PremiumFooter({
  exportDate,
  filters,
}: {
  exportDate: string;
  filters: string;
}) {
  return (
    <View style={footerStyles.wrap}>
      <View style={footerStyles.rule} />
      <View style={footerStyles.row}>
        <FooterCol
          icon={<IconCalendarSmall />}
          label="Report Export Date"
          value={exportDate}
          bordered
        />
        <FooterCol
          icon={<IconFunnelSmall />}
          label="Filters Applied"
          value={filters}
          bordered
        />
        <FooterCol
          icon={<IconLockSmall />}
          label="Confidential"
          value="For Internal Use Only"
        />
      </View>
    </View>
  );
}

function FooterCol({
  icon,
  label,
  value,
  bordered,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <View style={[footerStyles.col, bordered ? footerStyles.colBorder : null]}>
      <View style={footerStyles.iconSlot}>{icon}</View>
      <Text style={footerStyles.label}>{label}</Text>
      <Text style={footerStyles.value}>{value}</Text>
    </View>
  );
}

function IconCalendarSmall() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24">
      <Rect x={3} y={4} width={18} height={18} rx={2} stroke={PREMIUM_C.gold} strokeWidth={2} fill="none" />
      <Path d="M3 10h18" stroke={PREMIUM_C.gold} strokeWidth={2} fill="none" />
    </Svg>
  );
}
function IconFunnelSmall() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24">
      <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke={PREMIUM_C.gold} strokeWidth={2} fill="none" />
    </Svg>
  );
}
function IconLockSmall() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24">
      <Rect x={3} y={11} width={18} height={11} rx={2} stroke={PREMIUM_C.gold} strokeWidth={2} fill="none" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={PREMIUM_C.gold} strokeWidth={2} fill="none" />
    </Svg>
  );
}

const footerStyles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  rule: {
    height: 1,
    backgroundColor: PREMIUM_C.gold,
    opacity: 0.7,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
  },
  col: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  colBorder: {
    borderRightWidth: 1,
    borderRightColor: PREMIUM_C.goldBorderSoft,
  },
  iconSlot: {
    height: 14,
    marginBottom: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 7,
    color: PREMIUM_C.muted,
    textAlign: "center",
  },
  value: {
    fontSize: 8,
    fontWeight: 600,
    color: PREMIUM_C.white,
    marginTop: 2,
    textAlign: "center",
    maxWidth: 150,
  },
});
