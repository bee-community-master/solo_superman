import { RADAR_RING_SCORES, radarRingPoints } from "./planning-radar-model";
import type { DecisionQueueShellController } from "./useDecisionQueueShellController";

interface PlanningCompletenessRadarProps {
  readonly controller: DecisionQueueShellController;
}

export function PlanningCompletenessRadar({ controller }: PlanningCompletenessRadarProps) {
  const { planningCompletenessScore, planningRadarAxesView, planningRadarPolygonPoints, planningReadinessLabel } = controller;

  return (
    <>
      <svg
        aria-label={`기획 완성도 레이더 그래프, 종합 ${planningCompletenessScore}%, ${planningReadinessLabel}`}
        className="planning-radar"
        role="img"
        viewBox="0 0 100 100"
      >
        {RADAR_RING_SCORES.map((score) => (
          <polygon className="radar-ring" key={score} points={radarRingPoints(score)} />
        ))}
        {planningRadarAxesView.map((axis) => (
          <line className="radar-spoke" key={axis.axisId} x1="50" x2={axis.guideX} y1="50" y2={axis.guideY} />
        ))}
        <polygon className="radar-area" points={planningRadarPolygonPoints} />
        {planningRadarAxesView.map((axis) => (
          <circle className="radar-point" cx={axis.pointX} cy={axis.pointY} key={axis.axisId} r="1.7">
            <title>{`${axis.label}: ${axis.score}%`}</title>
          </circle>
        ))}
        {planningRadarAxesView.map((axis) => (
          <text className="radar-label" key={`${axis.axisId}-label`} textAnchor={axis.textAnchor} x={axis.labelX} y={axis.labelY}>
            {axis.label}
          </text>
        ))}
      </svg>
      <dl className="radar-axis-list">
        {planningRadarAxesView.map((axis) => (
          <div key={axis.axisId}>
            <dt>{axis.label}</dt>
            <dd>{axis.score}%</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
