import type { ConfidenceCompletionProjection } from "@solo-superman/contracts";

const RADAR_CENTER = 50;
const RADAR_MAX_RADIUS = 31;
const RADAR_LABEL_RADIUS = 44;

export const RADAR_RING_SCORES = [20, 40, 60, 80, 100] as const;

export const RADAR_AXIS_IDS = ["problem", "customer", "value", "validation", "implementation"] as const;

export type RadarAxisId = (typeof RADAR_AXIS_IDS)[number];

export type RadarAxisLabels = Readonly<Record<RadarAxisId, string>>;

type RadarTextAnchor = "start" | "middle" | "end";

export interface RadarAxisViewModel {
  readonly axisId: RadarAxisId;
  readonly label: string;
  readonly score: number;
  readonly point: string;
  readonly pointX: number;
  readonly pointY: number;
  readonly guideX: number;
  readonly guideY: number;
  readonly labelX: number;
  readonly labelY: number;
  readonly textAnchor: RadarTextAnchor;
}

function clampRadarScore(score: number) {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function radarPoint(index: number, radius: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / RADAR_AXIS_IDS.length;

  return {
    x: RADAR_CENTER + Math.cos(angle) * radius,
    y: RADAR_CENTER + Math.sin(angle) * radius
  };
}

function radarPointString(index: number, radius: number) {
  const point = radarPoint(index, radius);

  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

export function radarRingPoints(score: number) {
  return RADAR_AXIS_IDS.map((_, index) => radarPointString(index, RADAR_MAX_RADIUS * (score / 100))).join(" ");
}

function radarTextAnchor(x: number): RadarTextAnchor {
  if (x < RADAR_CENTER - 4) {
    return "end";
  }

  if (x > RADAR_CENTER + 4) {
    return "start";
  }

  return "middle";
}

export function planningRadarAxes(
  confidence: ConfidenceCompletionProjection | null,
  axisLabels?: RadarAxisLabels
): readonly RadarAxisViewModel[] {
  const scoreByAxis = new Map(
    confidence?.axes.map((axis) => [axis.axisId, clampRadarScore(axis.score)]) ?? []
  );

  return RADAR_AXIS_IDS.map((axisId, index) => {
    const score = scoreByAxis.get(axisId) ?? 0;
    const point = radarPoint(index, RADAR_MAX_RADIUS * (score / 100));
    const guide = radarPoint(index, RADAR_MAX_RADIUS);
    const label = radarPoint(index, RADAR_LABEL_RADIUS);

    return {
      axisId,
      label: axisLabels?.[axisId] ?? axisId,
      score,
      point: `${point.x.toFixed(2)},${point.y.toFixed(2)}`,
      pointX: point.x,
      pointY: point.y,
      guideX: guide.x,
      guideY: guide.y,
      labelX: label.x,
      labelY: label.y,
      textAnchor: radarTextAnchor(label.x)
    };
  });
}
