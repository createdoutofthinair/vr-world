import { useId } from "react";
import { Theme, THEMES } from "../core/project";
const point = (x: number, y: number, z: number) =>
  `${420 + (x - z) * 23},${92 + (x + z) * 11 - y * 25}`;
const poly = (v: number[][]) => v.map(([x, y, z]) => point(x, y, z)).join(" ");
function Block({
  x,
  y = 0,
  z,
  w,
  d,
  h,
  top = "#f0e8d6",
  left = "#cec6b5",
  right = "#e2dbcd",
}: {
  x: number;
  y?: number;
  z: number;
  w: number;
  d: number;
  h: number;
  top?: string;
  left?: string;
  right?: string;
}) {
  return (
    <g>
      <polygon
        points={poly([
          [x, y, z + d],
          [x + w, y, z + d],
          [x + w, y + h, z + d],
          [x, y + h, z + d],
        ])}
        fill={left}
      />
      <polygon
        points={poly([
          [x + w, y, z],
          [x + w, y, z + d],
          [x + w, y + h, z + d],
          [x + w, y + h, z],
        ])}
        fill={right}
      />
      <polygon
        points={poly([
          [x, y + h, z],
          [x + w, y + h, z],
          [x + w, y + h, z + d],
          [x, y + h, z + d],
        ])}
        fill={top}
      />
    </g>
  );
}
function Building({
  x,
  z,
  w = 2,
  d = 2,
  h = 2,
  roof = "#476959",
  wall = "#e6dfcf",
  shop = false,
}: {
  x: number;
  z: number;
  w?: number;
  d?: number;
  h?: number;
  roof?: string;
  wall?: string;
  shop?: boolean;
}) {
  const windows = [];
  for (let floor = 0.4; floor < h - 0.35; floor += 0.75)
    for (let xx = x + 0.25; xx < x + w - 0.2; xx += 0.7)
      windows.push(
        <polygon
          key={`${floor}-${xx}`}
          points={poly([
            [xx, floor, z + d + 0.01],
            [xx + 0.34, floor, z + d + 0.01],
            [xx + 0.34, floor + 0.42, z + d + 0.01],
            [xx, floor + 0.42, z + d + 0.01],
          ])}
          fill="#476b71"
        />,
      );
  return (
    <g>
      <Block
        x={x}
        z={z}
        w={w}
        d={d}
        h={h}
        top={wall}
        left={wall}
        right="#bfc4b7"
      />
      {windows}
      <Block
        x={x - 0.12}
        y={h}
        z={z - 0.12}
        w={w + 0.24}
        d={d + 0.24}
        h={0.15}
        top={roof}
        left={roof}
        right="#344a40"
      />
      {shop && (
        <>
          <polygon
            points={poly([
              [x - 0.06, 0.8, z + d + 0.06],
              [x + w + 0.06, 0.8, z + d + 0.06],
              [x + w + 0.06, 1, z + d + 0.45],
              [x - 0.06, 1, z + d + 0.45],
            ])}
            fill="#bed28e"
          />
          <polygon
            points={poly([
              [x + 0.3, 0, z + d + 0.01],
              [x + 0.65, 0, z + d + 0.01],
              [x + 0.65, 0.75, z + d + 0.01],
              [x + 0.3, 0.75, z + d + 0.01],
            ])}
            fill="#314d45"
          />
        </>
      )}
    </g>
  );
}
function Tree({
  x,
  z,
  scale = 1,
  color = "#86ab6c",
}: {
  x: number;
  z: number;
  scale?: number;
  color?: string;
}) {
  return (
    <g>
      <Block
        x={x - 0.07}
        z={z - 0.07}
        w={0.14}
        d={0.14}
        h={1.1 * scale}
        top="#705b45"
        left="#705b45"
        right="#705b45"
      />
      <polygon
        points={poly([
          [x - 0.7 * scale, 0.7 * scale, z],
          [x, 1.7 * scale, z - 0.55 * scale],
          [x + 0.7 * scale, 0.7 * scale, z],
          [x, 0.5 * scale, z + 0.6 * scale],
        ])}
        fill={color}
      />
      <polygon
        points={poly([
          [x - 0.7 * scale, 0.7 * scale, z],
          [x, 1.7 * scale, z - 0.55 * scale],
          [x, 2.2 * scale, z],
          [x, 1.1 * scale, z + 0.6 * scale],
        ])}
        fill="#aec98d"
      />
      <polygon
        points={poly([
          [x, 2.2 * scale, z],
          [x + 0.7 * scale, 0.7 * scale, z],
          [x, 0.5 * scale, z + 0.6 * scale],
          [x, 1.1 * scale, z + 0.6 * scale],
        ])}
        fill="#658b54"
      />
    </g>
  );
}
export function WorldIllustration({
  theme = "temperate",
  compact = false,
}: {
  theme?: Theme;
  compact?: boolean;
}) {
  const id = useId().replaceAll(":", ""),
    palette = THEMES[theme].palette;
  const buildings = [
    { x: 1.1, z: 1.2, w: 2.3, d: 2.4, h: 2.2 },
    { x: 4.2, z: 1.2, w: 2.2, d: 2.3, h: 3.3 },
    { x: 1.1, z: 4.7, w: 2.5, d: 2.2, h: 2.7, shop: true },
    { x: 4.4, z: 4.6, w: 2, d: 2.3, h: 1.8, shop: true },
    { x: 9.2, z: 1.5, w: 2.6, d: 2.8, h: 1.6 },
    { x: 9.3, z: 5.7, w: 2.8, d: 2.3, h: 2.3 },
    { x: 2.1, z: 10.2, w: 2.8, d: 2.2, h: 1.5 },
    { x: 5.4, z: 10.2, w: 2.1, d: 2.2, h: 2.2 },
  ];
  const trees = [
    { x: 0.8, z: 9, scale: 0.8 },
    { x: 4.7, z: 9, scale: 0.6 },
    { x: 11.4, z: 10, scale: 1.2 },
    { x: 10, z: 11.5, scale: 0.9 },
    { x: 12.7, z: 12.2, scale: 0.8 },
    { x: 9.4, z: 9.7, scale: 0.7 },
    { x: 12.2, z: 4.7, scale: 0.65 },
  ];
  return (
    <svg
      className={`world-illustration ${compact ? "compact" : ""}`}
      viewBox="30 -30 780 540"
      role="img"
      aria-label={`${THEMES[theme].label} modular city concept illustration`}
    >
      <defs>
        <filter
          id={`${id}-shadow`}
          x="-30%"
          y="-30%"
          width="160%"
          height="170%"
        >
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <linearGradient id={`${id}-water`} x1="0" x2="1">
          <stop stopColor="#81b5b7" />
          <stop offset="1" stopColor="#b4d9cb" />
        </linearGradient>
      </defs>
      <ellipse
        cx="419"
        cy="386"
        rx="280"
        ry="90"
        fill="#06131b"
        opacity="0.3"
        filter={`url(#${id}-shadow)`}
      />
      <Block
        x={0}
        y={-0.5}
        z={0}
        w={14}
        d={14}
        h={0.5}
        top={
          theme === "desert"
            ? "#d8c29c"
            : theme === "scifi"
              ? "#929e9d"
              : "#a3b387"
        }
        left="#637b63"
        right="#728b71"
      />
      <polygon
        points={poly([
          [6.9, 0.03, 0],
          [8.6, 0.03, 0],
          [8.6, 0.03, 14],
          [6.9, 0.03, 14],
        ])}
        fill="#7e8984"
      />
      <polygon
        points={poly([
          [0, 0.035, 7.7],
          [14, 0.035, 7.7],
          [14, 0.035, 9],
          [0, 0.035, 9],
        ])}
        fill="#7e8984"
      />
      {[1, 3, 5, 10, 12].map((z) => (
        <polygon
          key={z}
          points={poly([
            [7.7, 0.04, z],
            [7.8, 0.04, z],
            [7.8, 0.04, z + 0.7],
            [7.7, 0.04, z + 0.7],
          ])}
          fill="#e0dfc7"
        />
      ))}
      {[6.65, 8.6].map((x) => (
        <polygon
          key={x}
          points={poly([
            [x, 0.06, 0],
            [x + 0.25, 0.06, 0],
            [x + 0.25, 0.06, 14],
            [x, 0.06, 14],
          ])}
          fill="#d3d6c6"
        />
      ))}
      <polygon
        points={poly([
          [11.8, 0.04, 0],
          [13.5, 0.04, 0],
          [13.1, 0.04, 5],
          [12.3, 0.04, 8],
          [13.5, 0.04, 14],
          [11.8, 0.04, 14],
          [10.9, 0.04, 9],
          [11.8, 0.04, 5],
        ])}
        fill={`url(#${id}-water)`}
      />
      <Block
        x={10.7}
        y={0.2}
        z={7.5}
        w={2.8}
        d={1.2}
        h={0.15}
        top="#d4cbb2"
        left="#b8ae93"
        right="#b9b79c"
      />
      {buildings
        .sort((a, b) => a.x + a.z - (b.x + b.z))
        .map((b, i) => (
          <Building key={i} {...b} roof={palette.roof} wall={palette.wall} />
        ))}
      {trees.map((t, i) => (
        <Tree
          key={i}
          {...t}
          color={
            theme === "desert"
              ? "#899365"
              : theme === "scifi"
                ? "#76a0a1"
                : undefined
          }
        />
      ))}
      <Block
        x={7.1}
        y={0.08}
        z={11}
        w={0.46}
        d={0.9}
        h={0.3}
        top="#f0c97b"
        left="#ddae5f"
        right="#c49d56"
      />
      <Block
        x={7.1}
        y={0.08}
        z={3.2}
        w={0.46}
        d={0.9}
        h={0.3}
        top="#e8e5da"
        left="#bbbcb2"
        right="#aaaaa0"
      />
      {!compact && (
        <g
          className="illustration-guides"
          fill="none"
          stroke="#b8d5ab"
          strokeWidth="1"
          opacity="0.55"
        >
          <path d="M138 170h-42v-46" />
          <path d="M650 243h54v42" />
          <circle cx="138" cy="170" r="3" fill="#b8d5ab" />
          <circle cx="650" cy="243" r="3" fill="#b8d5ab" />
        </g>
      )}
    </svg>
  );
}
