import { decorThemePresets, type DecorThemePreset } from './conceptPlanner';
import { resolveStyle, type Project } from './model';
import { useStore } from './store';

const QUICK_THEME_IDS = ['oak-bistro', 'warm-restaurant', 'bright-canteen', 'raw-concrete'] as const;
export type QuickThemeId = typeof QUICK_THEME_IDS[number];
export type QuickLightingPreset = 'daylight' | 'warm-dining';

export const quickThemePresets: DecorThemePreset[] = QUICK_THEME_IDS.map(id => {
  const found = decorThemePresets.find(preset => preset.id === id);
  if (!found) throw Error(`Missing decor theme preset: ${id}`);
  return found;
});

export const quickLightingPresets: Array<{ id: QuickLightingPreset; label: string }> = [
  { id: 'daylight', label: '自然光' },
  { id: 'warm-dining', label: '暖光营业' },
];

export function activeQuickThemeId(project: Pick<Project, 'style'>): QuickThemeId | null {
  if (!project.style || (!project.style.floorMaterial && !project.style.wallMaterial)) {
    return 'raw-concrete';
  }
  const style = resolveStyle(project);
  const matched = quickThemePresets.find(
    preset => preset.floorMaterial === style.floorMaterial && preset.wallMaterial === style.wallMaterial,
  );
  return (matched?.id as QuickThemeId | undefined) ?? null;
}

export function applyQuickTheme(project: Project, preset: DecorThemePreset): Project {
  return {
    ...project,
    style: {
      ...resolveStyle(project),
      floorMaterial: preset.floorMaterial,
      wallMaterial: preset.wallMaterial,
      lightingPreset: preset.lightingPreset,
    },
  };
}

export function applyQuickLighting(project: Project, lightingPreset: QuickLightingPreset): Project {
  return {
    ...project,
    style: {
      ...resolveStyle(project),
      lightingPreset,
    },
  };
}

export default function StyleQuickBar({
  project,
  disabled = false,
  className = '',
}: {
  project: Project;
  disabled?: boolean;
  className?: string;
}) {
  const activeTheme = activeQuickThemeId(project);
  const lighting = resolveStyle(project).lightingPreset;

  function chooseTheme(preset: DecorThemePreset) {
    const live = useStore.getState().project;
    useStore.getState().commit(applyQuickTheme(live, preset));
  }

  function chooseLighting(preset: QuickLightingPreset) {
    const live = useStore.getState().project;
    if (resolveStyle(live).lightingPreset === preset) return;
    useStore.getState().commit(applyQuickLighting(live, preset));
  }

  return (
    <div className={`style-quick-bar ${className}`.trim()} role="group" aria-label="快捷装修风格与光照">
      <div className="style-quick-group" role="group" aria-label="装修风格">
        {quickThemePresets.map(preset => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            title={preset.subtitle}
            aria-pressed={activeTheme === preset.id}
            onClick={() => chooseTheme(preset)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="style-quick-group" role="group" aria-label="快捷光照">
        {quickLightingPresets.map(option => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            aria-pressed={lighting === option.id}
            onClick={() => chooseLighting(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
