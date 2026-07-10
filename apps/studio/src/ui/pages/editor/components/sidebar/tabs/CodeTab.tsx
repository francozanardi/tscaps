import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { css as cssLang } from '@codemirror/lang-css';
import { xml as xmlLang } from '@codemirror/lang-xml';
import * as Tabs from '@radix-ui/react-tabs';
import type { Theme } from '@presentation/theme/controllers/ThemeController';
import { EditorTab, type SheetScope } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { TemplateSourceEditor } from '@ui/pages/editor/components/sidebar/tabs/TemplateSourceEditor';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useRendering } from '@ui/_shared/contexts/modules/RenderingContext';
import { useTheme } from '@bootstrap/ThemeContext';

const TEMPLATE_GUIDE_URL = 'https://github.com/francozanardi/tscaps/blob/main/templates/AUTHORING.md';

type CodeSubTab = 'css' | 'filters';

interface CodeTabProps {
  sheetScope: SheetScope;
}

/**
 * Editor for the active sheet's template source overrides. Two
 * sub-tabs share the panel: the template's CSS and its raw
 * `filters.svg` source. The tab-level reset clears both overrides at
 * once.
 */
export const CodeTab = memo(function CodeTab({ sheetScope }: CodeTabProps) {
  const sheets = useSheets();
  const { svgFilterDefinitionsParser } = useRendering();
  const theme = useTheme();
  const { activeSheet } = sheetScope;

  const [currentTheme, setCurrentTheme] = useState<Theme>(() => theme.getTheme());
  useEffect(() => {
    const update = () => setCurrentTheme(theme.getTheme());
    theme.addEventListener('change', update);
    update();
    return () => theme.removeEventListener('change', update);
  }, [theme]);

  const cssExtensions = useMemo(() => [cssLang()], []);
  const xmlExtensions = useMemo(() => [xmlLang()], []);

  const handleCssChange = useCallback(
    (next: string) => sheets.actions.style.updateSheetCssOverride.execute(next),
    [sheets],
  );
  const handleFiltersSvgChange = useCallback(
    (next: string) => sheets.actions.style.updateSheetFiltersSvgOverride.execute(next),
    [sheets],
  );

  const handleReset = useCallback(
    () => sheets.actions.style.resetSlice.execute('code'),
    [sheets],
  );

  const validateFiltersSvg = useCallback((source: string) => {
    if (source.trim() === '') return null;
    try {
      svgFilterDefinitionsParser.parse(source);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Invalid filters.svg source.';
    }
  }, [svgFilterDefinitionsParser]);

  const [activeSubTab, setActiveSubTab] = useState<CodeSubTab>('css');

  return (
    <EditorTab title="Code" sheetScope={sheetScope} onResetToTemplate={handleReset}>
      <Tabs.Root
        value={activeSubTab}
        onValueChange={(v) => setActiveSubTab(v as CodeSubTab)}
        className="flex flex-col gap-3 mt-2"
      >
        <Tabs.List className={SUB_TAB_LIST_CLASS} aria-label="Code editor source">
          <Tabs.Trigger value="css" className={SUB_TAB_TRIGGER_CLASS}>CSS</Tabs.Trigger>
          <Tabs.Trigger value="filters" className={SUB_TAB_TRIGGER_CLASS}>SVG Filters</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="css">
          <TemplateSourceEditor
            sheetId={activeSheet.id}
            source={activeSheet.resolveCss()}
            isOverridden={activeSheet.cssOverride !== null}
            languageExtensions={cssExtensions}
            theme={currentTheme}
            onChange={handleCssChange}
            dialogTitle="Template CSS"
            intro={
              <p className="text-xs text-fg-muted m-0">
                Edit the template's CSS for this sheet.{' '}
                <a
                  href={TEMPLATE_GUIDE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  Template reference →
                </a>
              </p>
            }
          />
        </Tabs.Content>
        <Tabs.Content value="filters">
          <TemplateSourceEditor
            sheetId={activeSheet.id}
            source={activeSheet.resolveFiltersSvg()}
            isOverridden={activeSheet.filtersSvgOverride !== null}
            languageExtensions={xmlExtensions}
            theme={currentTheme}
            onChange={handleFiltersSvgChange}
            validate={validateFiltersSvg}
            dialogTitle="Template filters.svg"
            intro={
              <p className="text-xs text-fg-muted m-0">
                Edit the template's <code className="font-mono">filters.svg</code> for this
                sheet.
              </p>
            }
          />
        </Tabs.Content>
      </Tabs.Root>
    </EditorTab>
  );
});

const SUB_TAB_LIST_CLASS =
  'flex flex-row gap-1 p-1 bg-surface-1 border border-edge-subtle rounded-xs';

const SUB_TAB_TRIGGER_CLASS =
  'flex-1 py-1.5 px-3 rounded-xs bg-transparent border-none cursor-pointer ' +
  'font-mono text-2xs uppercase tracking-[0.08em] ' +
  'transition-[color,background-color] duration-quick ease-standard outline-none ' +
  'text-fg-muted hover:text-fg-secondary ' +
  'data-[state=active]:text-accent data-[state=active]:bg-surface-3 ' +
  'focus-visible:ring-2 focus-visible:ring-accent/40';
