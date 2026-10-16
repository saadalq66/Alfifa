import { memo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, ImagePlus, RefreshCw, TriangleAlert, X } from 'lucide-react';
import type { Frame } from '../types';
import { cx, ProgressRing } from './ui';

interface FrameGridProps {
  frames: Frame[];
  currentIndex: number;
  removeBackgrounds: boolean;
  onMove: (activeId: string, overId: string) => void;
  onRemove: (id: string) => void;
  onSelect: (index: number) => void;
  onRetry: (id: string) => void;
  onAdd: () => void;
}

export function FrameGrid({
  frames,
  currentIndex,
  removeBackgrounds,
  onMove,
  onRemove,
  onSelect,
  onRetry,
  onAdd,
}: FrameGridProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [keyboardDrag, setKeyboardDrag] = useState(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long-press to pick up on touch screens, so normal swipes still scroll the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dragging = draggingId ? frames.find((f) => f.id === draggingId) : undefined;
  const position = (id: string | number) => frames.findIndex((f) => f.id === id) + 1;
  const draggingIndex = dragging ? frames.indexOf(dragging) : -1;

  const onDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    setDraggingId(String(active.id));
    setKeyboardDrag(activatorEvent instanceof KeyboardEvent);
    navigator.vibrate?.(10);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null);
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingId(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'To reorder a frame, press space or enter to pick it up, use the arrow keys to move it, then press space or enter again to drop it.',
        },
        announcements: {
          onDragStart: ({ active }) => `Picked up frame ${position(active.id)}.`,
          onDragOver: ({ active, over }) =>
            over
              ? `Frame ${position(active.id)} is over position ${position(over.id)}.`
              : `Frame ${position(active.id)} is not over a position.`,
          onDragEnd: ({ active, over }) =>
            over
              ? `Frame ${position(active.id)} was moved to position ${position(over.id)}.`
              : `Frame ${position(active.id)} was dropped.`,
          onDragCancel: ({ active }) => `Moving frame ${position(active.id)} was cancelled.`,
        },
      }}
    >
      <SortableContext items={frames.map((f) => f.id)} strategy={rectSortingStrategy}>
        <ul className="grid grid-cols-3 gap-2.5 select-none sm:grid-cols-4 sm:gap-3 md:grid-cols-6 xl:grid-cols-8">
          {frames.map((frame, index) => (
            <SortableTile
              key={frame.id}
              frame={frame}
              index={index}
              active={index === currentIndex}
              removeBackgrounds={removeBackgrounds}
              onRemove={onRemove}
              onSelect={onSelect}
              onRetry={onRetry}
            />
          ))}
          <li>
            <button
              type="button"
              onClick={onAdd}
              className="group flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-sky-400 hover:bg-sky-50/60 hover:text-sky-600 active:scale-95"
            >
              <ImagePlus className="h-6 w-6 transition-transform group-hover:-translate-y-0.5 group-hover:scale-110" />
              <span className="text-xs font-semibold">Add photos</span>
            </button>
          </li>
        </ul>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {dragging && (
          <TileFace
            frame={dragging}
            index={draggingIndex}
            removeBackgrounds={removeBackgrounds}
            // Keyboard moves are computed from the overlay's measured size, so the
            // tilted, enlarged "lifted" look is only for pointer drags.
            className={cx('cursor-grabbing shadow-2xl ring-2 ring-sky-500', !keyboardDrag && 'rotate-3 scale-105')}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface TileProps {
  frame: Frame;
  index: number;
  active: boolean;
  removeBackgrounds: boolean;
  onRemove: (id: string) => void;
  onSelect: (index: number) => void;
  onRetry: (id: string) => void;
}

const SortableTile = memo(function SortableTile({
  frame,
  index,
  active,
  removeBackgrounds,
  onRemove,
  onSelect,
  onRetry,
}: TileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: frame.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx('group/tile relative touch-manipulation', isDragging && 'z-10')}
    >
      <div
        {...attributes}
        {...listeners}
        aria-label={`Frame ${index + 1}: ${frame.name}`}
        onClick={() => onSelect(index)}
        className={cx(
          'cursor-grab rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-sky-400/50',
          isDragging && 'opacity-30',
        )}
      >
        <TileFace
          frame={frame}
          index={index}
          active={active}
          removeBackgrounds={removeBackgrounds}
          className="animate-fade-up"
        />
      </div>

      {frame.bg.status === 'error' && removeBackgrounds && (
        <button
          type="button"
          onClick={() => onRetry(frame.id)}
          className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-lg bg-white/95 py-1 text-[11px] font-semibold text-red-600 shadow-sm transition hover:bg-white"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      )}

      <button
        type="button"
        onClick={() => onRemove(frame.id)}
        aria-label={`Remove frame ${index + 1}`}
        title="Remove"
        className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white text-slate-500 opacity-100 shadow-md ring-1 ring-slate-900/10 transition hover:scale-110 hover:bg-red-50 hover:text-red-600 pointer-fine:opacity-0 pointer-fine:group-hover/tile:opacity-100 focus-visible:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
});

function TileFace({
  frame,
  index,
  active = false,
  removeBackgrounds,
  className,
}: {
  frame: Frame;
  index: number;
  active?: boolean;
  removeBackgrounds: boolean;
  className?: string;
}) {
  const showCutout = removeBackgrounds && frame.cutout;
  const { status, progress, stage } = frame.bg;
  const processing = status === 'processing';
  const queued = removeBackgrounds && !frame.cutout && status === 'idle';
  const failed = removeBackgrounds && status === 'error';

  return (
    <div
      className={cx(
        'relative aspect-square overflow-hidden rounded-2xl bg-white ring-1 transition duration-200',
        active ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-white' : 'ring-slate-900/10 hover:ring-slate-900/20',
        className,
      )}
    >
      <div className={cx('absolute inset-0', showCutout ? 'bg-checker' : 'bg-slate-100')} />
      <img
        src={showCutout ? frame.cutout!.thumbUrl : frame.thumbUrl}
        alt=""
        draggable={false}
        className={cx(
          'relative h-full w-full object-contain transition duration-300',
          (queued || processing) && 'scale-[0.97] opacity-60 blur-[0.5px]',
        )}
      />

      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white backdrop-blur">
        {String(index + 1).padStart(2, '0')}
      </span>

      {showCutout && (
        <span className="absolute left-1.5 top-1.5 grid h-5 w-5 animate-pop place-items-center rounded-full bg-emerald-500 text-white shadow-sm">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}

      {queued && (
        <span className="absolute left-1.5 top-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm">
          Queued
        </span>
      )}

      {processing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-slate-900/45 backdrop-blur-[1px]">
          <ProgressRing value={progress} size={42} />
          {stage && (
            <span className="max-w-[90%] truncate rounded-full bg-slate-900/60 px-2 py-0.5 text-[10px] font-medium text-white">
              {stage}
            </span>
          )}
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 flex items-start justify-center bg-red-500/15 pt-3">
          <TriangleAlert className="h-5 w-5 text-red-600" aria-label="Background removal failed" />
        </div>
      )}
    </div>
  );
}
