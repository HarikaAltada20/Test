import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  Path,
  Rect,
  Line,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { CampaignCoverReportData } from "@/lib/report-export-pdf-cover-data";
import {
  registerPremiumFonts,
  PREMIUM_C,
  premiumPageStyle,
  PremiumBackground,
  PremiumFrame,
  PremiumFrameDecor,
  PremiumHeader,
  CoverPageHeader,
  TocPageContent,
  CoverPageFooter,
  PdfCampaignTitle,
  A4_WIDTH,
  A4_HEIGHT,
  type TocSection,
} from "@/lib/report-export-pdf-premium-shared";

registerPremiumFonts();

const PAGE_SIZE = { width: A4_WIDTH, height: A4_HEIGHT };

const KPI_VALUE_BASE = 20;
const HERO_VALUE_BASE = 42;

const styles = StyleSheet.create({
  identity: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  titleLine1: {
    fontSize: 20,
    fontWeight: 700,
    color: PREMIUM_C.white,
    lineHeight: 1.06,
  },
  titleLine2: {
    fontSize: 24,
    fontWeight: 700,
    color: PREMIUM_C.goldLight,
    lineHeight: 1.06,
  },
  titleLine3: {
    fontSize: 24,
    fontWeight: 700,
    color: PREMIUM_C.white,
    lineHeight: 1.06,
  },
  prepared: { marginTop: 8, fontSize: 9, color: PREMIUM_C.muted },
  brand: {
    marginTop: 3,
    fontSize: 17,
    fontWeight: 700,
    color: PREMIUM_C.goldLight,
    textAlign: "center",
    maxWidth: 460,
    lineHeight: 1.25,
  },
  brandSm: { fontSize: 14, maxWidth: 480 },
  brandXs: { fontSize: 12, maxWidth: 490 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    marginBottom: 14,
    width: 280,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: PREMIUM_C.goldBorder,
  },
  dividerGem: {
    marginHorizontal: 8,
  },
  campaignBlock: {
    width: "100%",
    marginTop: 2,
  },
  dataScopePill: {
    marginTop: 8,
    backgroundColor: PREMIUM_C.purpleDark,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: PREMIUM_C.purplePillBorder,
    maxWidth: 420,
  },
  dataScopeText: {
    fontSize: 7.5,
    color: "#ECECF4",
    textAlign: "center",
  },
  heroBlock: {
    marginTop: 8,
    marginBottom: 6,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    backgroundColor: PREMIUM_C.navyCard,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: PREMIUM_C.goldBorderSoft,
  },
  heroValue: {
    fontSize: HERO_VALUE_BASE,
    fontWeight: 700,
    color: PREMIUM_C.goldBright,
    lineHeight: 1,
    letterSpacing: -0.5,
  },
  heroValueMd: { fontSize: 34 },
  heroValueSm: { fontSize: 28 },
  heroLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: 600,
    color: PREMIUM_C.white,
    letterSpacing: 0.4,
  },
  heroSubline: {
    marginTop: 8,
    fontSize: 8,
    color: PREMIUM_C.mutedLight,
    textAlign: "center",
    maxWidth: 440,
    lineHeight: 1.45,
  },
  kpiRow: { flexDirection: "row", marginTop: 6 },
  kpiCard: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: PREMIUM_C.goldBorderSoft,
    backgroundColor: PREMIUM_C.navyCard,
    paddingVertical: 11,
    paddingHorizontal: 5,
    alignItems: "center",
    marginHorizontal: 3,
    minHeight: 72,
  },
  kpiIconSlot: { height: 16, marginBottom: 4 },
  kpiLabel: {
    fontSize: 6.5,
    color: PREMIUM_C.mutedLight,
    textAlign: "center",
    marginBottom: 3,
  },
  kpiValue: {
    fontSize: KPI_VALUE_BASE,
    fontWeight: 700,
    color: PREMIUM_C.goldBright,
    textAlign: "center",
  },
  kpiValueMd: { fontSize: 16 },
  kpiValueSm: { fontSize: 13 },
  kpiSub: {
    fontSize: 5.5,
    color: PREMIUM_C.muted,
    marginTop: 4,
    textAlign: "center",
    maxWidth: 110,
    lineHeight: 1.25,
  },
  performanceSection: {
    marginTop: 8,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  performanceRule: {
    width: "100%",
    height: 1,
    backgroundColor: PREMIUM_C.goldBorderSoft,
    opacity: 0.7,
    marginBottom: 10,
  },
  performanceTitle: {
    fontSize: 6.5,
    fontWeight: 600,
    color: PREMIUM_C.muted,
    textAlign: "center",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  performanceRow: { flexDirection: "row", justifyContent: "center" },
  perfItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 6,
  },
  perfItemBorder: {
    borderRightWidth: 1,
    borderRightColor: PREMIUM_C.goldBorderSoft,
  },
  perfLabel: { fontSize: 6.5, color: PREMIUM_C.muted, textAlign: "center" },
  perfValue: {
    fontSize: 12,
    fontWeight: 700,
    color: PREMIUM_C.goldBright,
    marginTop: 3,
    textAlign: "center",
  },
  insightSection: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  insightText: {
    fontSize: 8,
    color: PREMIUM_C.muted,
    textAlign: "center",
    maxWidth: 460,
    lineHeight: 1.45,
  },
  insightTextLong: { fontSize: 7.5 },
});

function IconUsers() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke={PREMIUM_C.goldLight} strokeWidth={1.6} fill="none" />
      <Path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke={PREMIUM_C.goldLight} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}
function IconEye() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      <Path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" stroke={PREMIUM_C.goldLight} strokeWidth={1.6} fill="none" />
      <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke={PREMIUM_C.goldLight} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}
function IconTrophy() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" stroke={PREMIUM_C.goldLight} strokeWidth={1.6} fill="none" />
      <Path d="M4 22h16" stroke={PREMIUM_C.goldLight} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}
function IconCalendar() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      <Rect x={3} y={4} width={18} height={18} rx={2} stroke={PREMIUM_C.goldLight} strokeWidth={1.6} fill="none" />
      <Line x1={3} y1={10} x2={21} y2={10} stroke={PREMIUM_C.goldLight} strokeWidth={1.6} />
    </Svg>
  );
}

const KPI_ICONS = [IconUsers, IconEye, IconTrophy, IconCalendar];

function pickValueStyle(
  value: string,
  lg: Style,
  md: Style,
  sm: Style,
): Style {
  if (value.length > 11) return sm;
  if (value.length > 8) return md;
  return lg;
}

function pickBrandStyle(name: string): Style | undefined {
  if (name.length > 44) return styles.brandXs;
  if (name.length > 32) return styles.brandSm;
  return undefined;
}

function pickCampaignFontSize(name: string): number {
  if (name.length > 56) return 11;
  if (name.length > 40) return 12;
  return 13;
}

function KpiCard({
  label,
  value,
  subtext,
  iconIndex,
}: {
  label: string;
  value: string;
  subtext: string;
  iconIndex: number;
}) {
  const Icon = KPI_ICONS[iconIndex] ?? IconUsers;
  const valueStyle = pickValueStyle(
    value,
    styles.kpiValue,
    styles.kpiValueMd,
    styles.kpiValueSm,
  );
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiIconSlot}>
        <Icon />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
      {subtext ? <Text style={styles.kpiSub}>{subtext}</Text> : null}
    </View>
  );
}

function PerformanceSection({
  marketing,
}: {
  marketing: NonNullable<CampaignCoverReportData["marketing"]>;
}) {
  const items = [
    marketing.targetCpm
      ? { label: "Target CPM", value: marketing.targetCpm }
      : null,
    marketing.effectiveCpm
      ? { label: "Effective CPM", value: marketing.effectiveCpm }
      : null,
    marketing.cpmEfficiency
      ? { label: "CPM Efficiency", value: marketing.cpmEfficiency }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  if (items.length === 0) return null;

  return (
    <View style={styles.performanceSection}>
      <View style={styles.performanceRule} />
      <View style={styles.performanceRow}>
        {items.map((item, index) => (
          <View
            key={item.label}
            style={[
              styles.perfItem,
              ...(index < items.length - 1 ? [styles.perfItemBorder] : []),
            ]}
          >
            <Text style={styles.perfLabel}>{item.label}</Text>
            <Text style={styles.perfValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DividerOrnament() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Svg width={7} height={7} viewBox="0 0 7 7" style={styles.dividerGem}>
        <Path d="M3.5 0 L7 3.5 L3.5 7 L0 3.5 Z" fill={PREMIUM_C.goldBorder} />
      </Svg>
      <View style={styles.dividerLine} />
    </View>
  );
}

function CoverPage({
  data,
  shieldLogoSrc,
}: {
  data: CampaignCoverReportData;
  shieldLogoSrc?: string | null;
}) {
  const longInsight = data.insightSentence.length > 130;
  const heroValueStyle = pickValueStyle(
    data.heroMetric.value,
    styles.heroValue,
    styles.heroValueMd,
    styles.heroValueSm,
  );
  const heroSublineLines = data.heroMetric.subline.split("\n");
  const brandStyle = pickBrandStyle(data.brandName);

  return (
    <Page size={PAGE_SIZE} style={premiumPageStyle.page} wrap={false}>
      <PremiumBackground idSuffix="cover" />
      <PremiumFrame />
      <PremiumFrameDecor />

      <View style={premiumPageStyle.body}>
        <CoverPageHeader
          shieldLogoSrc={shieldLogoSrc}
          reportId={data.trust.reportId}
          generatedTimestamp={data.trust.generatedTimestamp}
          dataScopeLabel={data.trust.dataScopeLabel}
        />

        <View style={styles.identity}>
          <Text style={styles.titleLine1}>Campaign</Text>
          <Text style={styles.titleLine2}>Performance</Text>
          <Text style={styles.titleLine3}>Report</Text>
          <Text style={styles.prepared}>Prepared for</Text>
          <Text style={brandStyle ? [styles.brand, brandStyle] : styles.brand}>
            {data.brandName}
          </Text>
          <DividerOrnament />
          <View style={styles.campaignBlock}>
            <PdfCampaignTitle
              text={data.campaignName}
              color={PREMIUM_C.white}
              fontSize={pickCampaignFontSize(data.campaignName)}
            />
          </View>
          <View style={styles.dataScopePill}>
            <Text style={styles.dataScopeText}>{data.dataScopeLabel}</Text>
          </View>
        </View>

        <View style={styles.heroBlock}>
          <Text style={heroValueStyle}>{data.heroMetric.value}</Text>
          <Text style={styles.heroLabel}>{data.heroMetric.label}</Text>
          {heroSublineLines.map((line) => (
            <Text key={line} style={styles.heroSubline}>
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.kpiRow}>
          {data.kpis.map((kpi, i) => (
            <KpiCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              subtext={kpi.subtext}
              iconIndex={i}
            />
          ))}
        </View>

        {data.marketing ? <PerformanceSection marketing={data.marketing} /> : null}

        <View style={styles.insightSection}>
          <Text
            style={
              longInsight
                ? [styles.insightText, styles.insightTextLong]
                : styles.insightText
            }
          >
            {data.insightSentence}
          </Text>
        </View>
      </View>

      <View style={premiumPageStyle.footerZone}>
        <CoverPageFooter
          exportDate={data.exportDate}
          filters={data.filters}
          engineLabel={data.trust.engineLabel}
        />
      </View>
    </Page>
  );
}

function TocPage({
  campaignName,
  sections,
  shieldLogoSrc,
}: {
  campaignName: string;
  sections: TocSection[];
  shieldLogoSrc?: string | null;
}) {
  const longName = campaignName.length > 48;
  return (
    <Page size={PAGE_SIZE} style={premiumPageStyle.page} wrap={false}>
      <PremiumBackground idSuffix="toc" />
      <PremiumFrame />
      <PremiumFrameDecor />

      <View style={[premiumPageStyle.body, tocPageStyles.body]}>
        <PremiumHeader shieldLogoSrc={shieldLogoSrc} />
        <TocPageContent campaignName={campaignName} sections={sections} longName={longName} />
      </View>
    </Page>
  );
}

const tocPageStyles = StyleSheet.create({
  body: {
    justifyContent: "flex-start",
    paddingBottom: 48,
  },
});

export type CampaignReportPrefixDocumentProps = {
  data: CampaignCoverReportData;
  shieldLogoSrc?: string | null;
  tocSections?: TocSection[];
};

export function CampaignReportPrefixDocument({
  data,
  shieldLogoSrc,
  tocSections,
}: CampaignReportPrefixDocumentProps) {
  return (
    <Document title="Campaign Performance Report">
      <CoverPage data={data} shieldLogoSrc={shieldLogoSrc} />
      {tocSections && tocSections.length > 0 ? (
        <TocPage
          campaignName={data.campaignName}
          sections={tocSections}
          shieldLogoSrc={shieldLogoSrc}
        />
      ) : null}
    </Document>
  );
}

/** @deprecated Use CampaignReportPrefixDocument */
export function CampaignCoverDocument(props: CampaignReportPrefixDocumentProps) {
  return <CampaignReportPrefixDocument {...props} />;
}

export default CampaignReportPrefixDocument;
