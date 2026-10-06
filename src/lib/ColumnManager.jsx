// Column manager panel: reorder (drag or ↑/↓), show/hide, pin.
// Loaded lazily by VirtualGrid, so grids without it never load drag and drop.
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
import { List } from "react-window";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { attachClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge/attach-closest-edge";
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge/extract-closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import {
  columnLabel,
  defaultColumnState,
  moveColumn,
  showAllColumns,
  toggleHidden,
  togglePinned
} from "./columnState.js";

const ITEM_HEIGHT = 32;
const MAX_LIST_HEIGHT = 320;

const GripIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    aria-hidden="true"
    fill="currentColor"
  >
    {[3, 8, 13].map((y) =>
      [6, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.25" />)
    )}
  </svg>
);

const PinIcon = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M10 1.5 14.5 6l-2 .5-2.5 2.5.5 3-1 1L6.5 10 2.5 14l-.5-.5 4-4-3-3 1-1 3 .5L9.5 3.5z"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  </svg>
);

const Item = ({
  index,
  style,
  order,
  byKey,
  hidden,
  pinned,
  pinnedCount,
  instanceId,
  hintId,
  actions
}) => {
  const key = order[index];
  const column = byKey.get(key);
  const label = columnLabel(column);
  const isPinned = pinned.has(key);
  const rowRef = useRef(null);
  const handleRef = useRef(null);
  const [edge, setEdge] = useState(null);
  const [dragging, setDragging] = useState(false);

  useEffect(
    () =>
      combine(
        draggable({
          element: rowRef.current,
          dragHandle: handleRef.current,
          getInitialData: () => ({ instanceId, key, index }),
          onDragStart: () => setDragging(true),
          onDrop: () => setDragging(false)
        }),
        dropTargetForElements({
          element: rowRef.current,
          canDrop: ({ source }) => source.data.instanceId === instanceId,
          getData: ({ input, element }) =>
            attachClosestEdge(
              { index },
              { input, element, allowedEdges: ["top", "bottom"] }
            ),
          onDrag: ({ self, source }) =>
            setEdge(
              source.data.key === key ? null : extractClosestEdge(self.data)
            ),
          onDragLeave: () => setEdge(null),
          onDrop: () => setEdge(null)
        })
      ),
    [instanceId, key, index]
  );

  return (
    <div
      ref={rowRef}
      style={style}
      className="vgrid-manager__item"
      data-key={key}
      data-edge={edge ?? undefined}
      data-dragging={dragging || undefined}
      data-pinned={isPinned || undefined}
      data-group-end={index === pinnedCount - 1 || undefined}
    >
      <button
        ref={handleRef}
        type="button"
        className="vgrid-manager__handle"
        aria-label={`Reorder ${label}`}
        aria-describedby={hintId}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          actions.moveBy(index, event.key === "ArrowUp" ? -1 : 1);
        }}
      >
        <GripIcon />
      </button>
      <label className="vgrid-manager__label">
        <input
          type="checkbox"
          checked={!hidden.has(key)}
          disabled={column.hideable === false}
          onChange={() => actions.toggleHidden(key)}
        />
        <span>{label}</span>
      </label>
      <button
        type="button"
        className="vgrid-manager__pin"
        aria-pressed={isPinned}
        aria-label={`${isPinned ? "Unpin" : "Pin"} ${label}`}
        title={isPinned ? "Unpin" : "Pin to the left"}
        onClick={() => actions.togglePinned(key)}
      >
        <PinIcon filled={isPinned} />
      </button>
    </div>
  );
};

const ColumnManager = ({ columns, state, onChange }) => {
  const instanceId = useId();
  const hintId = `${instanceId}-hint`;
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const [announcement, setAnnouncement] = useState("");
  const [focusKey, setFocusKey] = useState(null);

  const byKey = useMemo(
    () => new Map(columns.map((c) => [c.key, c])),
    [columns]
  );
  const hidden = useMemo(() => new Set(state.hidden), [state.hidden]);
  const pinned = useMemo(() => new Set(state.pinned), [state.pinned]);

  const move = useCallback(
    (from, to) => {
      if (to < 0 || to >= state.order.length || from === to) return;
      const key = state.order[from];
      const next = moveColumn(state, from, to);
      onChange(next);
      setAnnouncement(
        `${columnLabel(byKey.get(key))} moved to position ${to + 1} of ${next.order.length}` +
          (next.pinned.includes(key) !== state.pinned.includes(key)
            ? next.pinned.includes(key)
              ? ", pinned"
              : ", unpinned"
            : "")
      );
      return key;
    },
    [state, onChange, byKey]
  );

  const actions = useMemo(
    () => ({
      moveBy: (index, delta) => setFocusKey(move(index, index + delta) ?? null),
      toggleHidden: (key) => onChange(toggleHidden(state, key)),
      togglePinned: (key) => onChange(togglePinned(state, key))
    }),
    [move, onChange, state]
  );

  // pointer drops: one monitor for the panel; ref keeps it on the latest state
  const moveRef = useRef(move);
  moveRef.current = move;
  useEffect(
    () =>
      combine(
        monitorForElements({
          canMonitor: ({ source }) => source.data.instanceId === instanceId,
          onDrop: ({ source, location }) => {
            const target = location.current.dropTargets[0];
            if (!target) return;
            moveRef.current(
              source.data.index,
              getReorderDestinationIndex({
                startIndex: source.data.index,
                indexOfTarget: target.data.index,
                closestEdgeOfTarget: extractClosestEdge(target.data),
                axis: "vertical"
              })
            );
          }
        }),
        autoScrollForElements({
          // react-window's listRef.element is still null on first mount
          element: panelRef.current.querySelector(".vgrid-manager__list"),
          canScroll: ({ source }) => source.data.instanceId === instanceId
        })
      ),
    [instanceId]
  );

  // keep keyboard focus on the moved column's handle (rows are virtualized)
  useEffect(() => {
    if (!focusKey) return;
    listRef.current.scrollToRow({
      index: state.order.indexOf(focusKey),
      align: "auto"
    });
    const frame = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector(
          `[data-key="${CSS.escape(focusKey)}"] .vgrid-manager__handle`
        )
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusKey, state.order]);

  return (
    <div ref={panelRef} className="vgrid-manager__content">
      <p id={hintId} className="vgrid-manager__hint">
        Drag a handle to reorder, or focus one and press ↑ / ↓.
      </p>
      <List
        listRef={listRef}
        className="vgrid-manager__list"
        rowComponent={Item}
        rowCount={state.order.length}
        rowHeight={ITEM_HEIGHT}
        // keyed by column, so a moved row keeps its DOM node and drag state
        rowKey={(index, props) => props.order[index]}
        rowProps={{
          order: state.order,
          byKey,
          hidden,
          pinned,
          pinnedCount: state.pinned.length,
          instanceId,
          hintId,
          actions
        }}
        style={{
          height: Math.min(state.order.length * ITEM_HEIGHT, MAX_LIST_HEIGHT)
        }}
      />
      <div className="vgrid-manager__footer">
        <button type="button" onClick={() => onChange(showAllColumns(state))}>
          Show all
        </button>
        <button
          type="button"
          onClick={() => onChange(defaultColumnState(columns))}
        >
          Reset
        </button>
      </div>
      <div role="status" className="vgrid-manager__announcer">
        {announcement}
      </div>
    </div>
  );
};

export default ColumnManager;
