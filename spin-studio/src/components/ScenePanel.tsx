import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpLeft,
  ArrowUpRight,
  ImageUp,
  Palette,
  Pipette,
  Stamp,
  Trash,
  Type,
} from 'lucide-react';
import { useObjectUrl } from '../hooks/useScene';
import { BACKDROPS, backdropCss } from '../lib/backdrops';
import { DEFAULT_TEXT, prepareSceneImage, type Corner, type Scene, type SceneText } from '../lib/scene';
import { useToast } from './Toast';
import { Button, cx, Segmented, Spinner, Switch } from './ui';

interface ScenePanelProps {
  scene: Scene;
  onChange: (scene: Scene) => void;
  /** Backgrounds only show around cut-outs, so hint at background removal. */
  removeBackgrounds: boolean;
}

const PICTURE_TYPES = 'image/jpeg,image/png,image/webp';
const LOGO_TYPES = 'image/png,image/webp,image/svg+xml,image/jpeg';

const CORNERS: { value: Corner; label: ReactNode }[] = [
  { value: 'top-left', label: <ArrowUpLeft className="mx-auto h-4 w-4" aria-label="Top left" /> },
  { value: 'top-right', label: <ArrowUpRight className="mx-auto h-4 w-4" aria-label="Top right" /> },
  { value: 'bottom-left', label: <ArrowDownLeft className="mx-auto h-4 w-4" aria-label="Bottom left" /> },
  { value: 'bottom-right', label: <ArrowDownRight className="mx-auto h-4 w-4" aria-label="Bottom right" /> },
];

export function ScenePanel({ scene, onChange, removeBackgrounds }: ScenePanelProps) {
  const toast = useToast();
  const pictureInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'background' | 'logo' | null>(null);
  const [customColor, setCustomColor] = useState(
    scene.background.type === 'color' ? scene.background.color : '#0ea5e9',
  );
  const { background, logo } = scene;
  const text: SceneText = scene.text ?? DEFAULT_TEXT;
  const pictureUrl = useObjectUrl(background.type === 'image' ? background.blob : null);
  const logoUrl = useObjectUrl(logo?.blob);

  const setText = (patch: Partial<SceneText>) => onChange({ ...scene, text: { ...text, ...patch } });

  const upload = async (file: File | undefined, kind: 'background' | 'logo') => {
    if (!file) return;
    setBusy(kind);
    try {
      const blob = await prepareSceneImage(file, kind);
      if (kind === 'background') onChange({ ...scene, background: { type: 'image', blob } });
      else onChange({ ...scene, logo: { blob, corner: logo?.corner ?? 'bottom-right', scale: logo?.scale ?? 0.18 } });
    } catch {
      toast(`Couldn’t read that ${kind === 'logo' ? 'logo' : 'picture'} — try a PNG or JPEG.`, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Palette className="h-4 w-4 text-slate-400" /> Background
        </legend>
        <div className="flex flex-wrap gap-2.5">
          {BACKDROPS.map((option) => (
            <Swatch
              key={option.id}
              label={option.label}
              selected={background.type === 'preset' && background.id === option.id}
              onClick={() => onChange({ ...scene, background: { type: 'preset', id: option.id } })}
              className={option.id === 'transparent' ? 'bg-checker' : undefined}
              style={option.id === 'transparent' ? undefined : { background: backdropCss(option.id) }}
            />
          ))}

          <label
            title="Custom colour"
            className={cx(
              'relative grid h-9 w-9 cursor-pointer place-items-center rounded-full ring-1 ring-slate-900/10 transition hover:scale-110 active:scale-95 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-sky-400/50',
              background.type === 'color' && 'ring-2 ring-sky-500 ring-offset-2',
            )}
            style={{
              background:
                background.type === 'color'
                  ? background.color
                  : 'conic-gradient(#f43f5e, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #f43f5e)',
            }}
          >
            <Pipette className="h-4 w-4 text-white drop-shadow" />
            <input
              type="color"
              aria-label="Custom background colour"
              value={customColor}
              onChange={(e) => {
                const color = e.currentTarget.value;
                setCustomColor(color);
                onChange({ ...scene, background: { type: 'color', color } });
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>

          <button
            type="button"
            title="Upload a picture"
            aria-label="Upload a background picture"
            onClick={() => pictureInput.current?.click()}
            className={cx(
              'grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-slate-100 bg-cover bg-center text-slate-500 ring-1 ring-slate-900/10 transition hover:scale-110 hover:text-slate-800 active:scale-95',
              background.type === 'image' && 'ring-2 ring-sky-500 ring-offset-2',
            )}
            style={pictureUrl ? { backgroundImage: `url(${pictureUrl})` } : undefined}
          >
            {busy === 'background' ? (
              <Spinner className="h-4 w-4" />
            ) : (
              !pictureUrl && <ImageUp className="h-4 w-4" />
            )}
          </button>
        </div>
        <input
          ref={pictureInput}
          type="file"
          accept={PICTURE_TYPES}
          className="hidden"
          onChange={(e) => {
            void upload(e.currentTarget.files?.[0], 'background');
            e.currentTarget.value = '';
          }}
        />
        {background.type === 'image' && (
          <div className="mt-2 flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => pictureInput.current?.click()}>
              Change picture
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash className="h-3.5 w-3.5" />}
              className="hover:bg-red-50 hover:text-red-600"
              onClick={() => onChange({ ...scene, background: { type: 'preset', id: 'studio' } })}
            >
              Remove
            </Button>
          </div>
        )}
        {!removeBackgrounds && (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Shows around your object once backgrounds are removed.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Type className="h-4 w-4 text-slate-400" /> Text
        </legend>
        <input
          type="text"
          value={text.content}
          maxLength={60}
          placeholder="e.g. product name or price"
          aria-label="Text shown on the spin"
          onChange={(e) => setText({ content: e.currentTarget.value })}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20"
        />
        {text.content.trim() && (
          <div className="mt-3 space-y-3">
            <Segmented
              value={text.position}
              onChange={(position) => setText({ position })}
              options={[
                { value: 'top', label: 'Top' },
                { value: 'bottom', label: 'Bottom' },
              ]}
            />
            <Segmented
              value={text.size}
              onChange={(size) => setText({ size })}
              options={[
                { value: 'sm', label: 'S' },
                { value: 'md', label: 'M' },
                { value: 'lg', label: 'L' },
              ]}
            />
            <div className="flex items-center gap-3">
              <label
                title="Text colour"
                className="relative h-9 w-9 shrink-0 cursor-pointer rounded-full ring-1 ring-slate-900/10 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-sky-400/50"
                style={{ background: text.color }}
              >
                <input
                  type="color"
                  aria-label="Text colour"
                  value={text.color}
                  onChange={(e) => setText({ color: e.currentTarget.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
              <div className="min-w-0 flex-1">
                <Switch
                  id="text-label"
                  checked={text.label}
                  onChange={(label) => setText({ label })}
                  label="Label behind text"
                />
              </div>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Stamp className="h-4 w-4 text-slate-400" /> Logo
        </legend>
        <input
          ref={logoInput}
          type="file"
          accept={LOGO_TYPES}
          className="hidden"
          onChange={(e) => {
            void upload(e.currentTarget.files?.[0], 'logo');
            e.currentTarget.value = '';
          }}
        />
        {logo ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-checker p-1 ring-1 ring-slate-900/10">
                {logoUrl && <img src={logoUrl} alt="Your logo" className="h-full w-full object-contain" />}
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => logoInput.current?.click()}>
                  Change
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash className="h-3.5 w-3.5" />}
                  className="hover:bg-red-50 hover:text-red-600"
                  onClick={() => onChange({ ...scene, logo: null })}
                >
                  Remove
                </Button>
              </div>
            </div>
            <Segmented
              value={logo.corner}
              onChange={(corner) => onChange({ ...scene, logo: { ...logo, corner } })}
              options={CORNERS}
            />
            <div>
              <label htmlFor="logo-size" className="mb-1 flex justify-between text-xs font-medium text-slate-600">
                Size <span className="tabular-nums text-slate-400">{Math.round(logo.scale * 100)}%</span>
              </label>
              <input
                id="logo-size"
                type="range"
                min={0.08}
                max={0.4}
                step={0.01}
                value={logo.scale}
                onChange={(e) => onChange({ ...scene, logo: { ...logo, scale: Number(e.currentTarget.value) } })}
                className="w-full accent-sky-600"
              />
            </div>
          </div>
        ) : (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => logoInput.current?.click()}
              disabled={busy === 'logo'}
              icon={busy === 'logo' ? <Spinner className="h-3.5 w-3.5" /> : <ImageUp className="h-3.5 w-3.5" />}
            >
              Upload logo
            </Button>
            <p className="mt-2 text-xs text-slate-500">A PNG or SVG with a transparent background works best.</p>
          </>
        )}
      </fieldset>
    </div>
  );
}

function Swatch({
  label,
  selected,
  onClick,
  className,
  style,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={cx(
        'h-9 w-9 rounded-full ring-1 ring-slate-900/10 transition hover:scale-110 active:scale-95',
        className,
        selected && 'ring-2 ring-sky-500 ring-offset-2',
      )}
      style={style}
    />
  );
}
