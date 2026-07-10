import { memo, useCallback, useMemo, useState } from 'react';
import { AlertCircle, BookmarkPlus, CheckCircle2, Save } from 'lucide-react';
import type { Template } from '@core/templates/domain/Template';
import type { TemplateLibraryView } from '@core/templates/store/TemplateLibraryStore';
import { TemplateSelector } from '@ui/pages/editor/components/template/TemplateSelector';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { EditorTab, type SheetScope } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { PromptDialog } from '@ui/_shared/components/Dialog/PromptDialog';
import { ConfirmDialog } from '@ui/_shared/components/Dialog/ConfirmDialog';
import { Toast } from '@ui/_shared/components/Toast/Toast';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useUserTemplates } from '@ui/_shared/contexts/modules/UserTemplatesContext';

interface TemplatesTabProps {
  sheetScope: SheetScope;
  templates: Template[];
  library: TemplateLibraryView;
}

const HEADER_BUTTON_CLASS =
  'inline-flex items-center justify-center w-8 h-8 rounded-xs bg-transparent border-none text-fg-faint cursor-pointer ' +
  'transition-colors duration-quick ease-standard hover:text-fg-secondary focus-visible:outline-none focus-visible:text-fg-secondary';

export const TemplatesTab = memo(function TemplatesTab({ sheetScope, templates, library }: TemplatesTabProps) {
  const sheets = useSheets();
  const userTemplatesContext = useUserTemplates();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingRenameId, setPendingRenameId] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);
  const dismissToastError = useCallback(() => setToastError(null), []);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const dismissToastSuccess = useCallback(() => setToastSuccess(null), []);

  const userTemplateEntries = userTemplatesContext.userTemplates;

  // Newest edits float to the top — `updatedAt` covers both freshly
  // saved entries (createdAt === updatedAt) and ones the user just
  // overwrote via "Save changes". Sort is on the entry, then project
  // to `Template[]` for the picker.
  const userTemplates = useMemo<readonly Template[]>(
    () => {
      const sorted = [...userTemplateEntries].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
      return sorted.map((entry) => entry.template);
    },
    [userTemplateEntries],
  );

  const onSelectTemplate = useCallback(
    (template: Template) => sheets.actions.style.setTemplate.execute(template),
    [sheets],
  );

  const onSaveConfirm = useCallback(
    async (name: string) => {
      setSaveError(null);
      try {
        const saved = await userTemplatesContext.save({
          name,
          sheet: sheetScope.activeSheet,
          parentTemplateId: sheetScope.activeSheet.template.metadata.id,
        });
        setSaveDialogOpen(false);
        sheets.actions.style.setTemplate.execute(saved.template);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Could not save the template.');
      }
    },
    [userTemplatesContext, sheetScope.activeSheet, sheets],
  );

  const onSaveCancel = useCallback(() => {
    setSaveDialogOpen(false);
    setSaveError(null);
  }, []);

  const onDeleteRequest = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);

  const onDeleteConfirm = useCallback(async () => {
    const id = pendingDeleteId;
    if (!id) return;
    setPendingDeleteId(null);
    try {
      await userTemplatesContext.delete(id);
      setToastSuccess('Template deleted');
    } catch (err) {
      setToastError(err instanceof Error ? err.message : 'Could not delete the template.');
    }
  }, [pendingDeleteId, userTemplatesContext]);

  const pendingDeleteName = useMemo(() => {
    if (!pendingDeleteId) return '';
    const match = userTemplateEntries.find((entry) => entry.template.metadata.id === pendingDeleteId);
    return match?.template.metadata.name ?? 'this template';
  }, [pendingDeleteId, userTemplateEntries]);

  const pendingRenameCurrentName = useMemo(() => {
    if (!pendingRenameId) return '';
    const match = userTemplateEntries.find((entry) => entry.template.metadata.id === pendingRenameId);
    return match?.template.metadata.name ?? '';
  }, [pendingRenameId, userTemplateEntries]);

  const onRenameRequest = useCallback((id: string) => {
    setPendingRenameId(id);
  }, []);

  const onRenameConfirm = useCallback(
    async (newName: string) => {
      const id = pendingRenameId;
      if (!id) return;
      setRenameError(null);
      try {
        const renamed = await userTemplatesContext.rename(id, newName);
        setPendingRenameId(null);
        // Refresh the active sheet if its template just changed name,
        // so the header label and other surfaces update immediately.
        if (sheetScope.activeSheet.template.metadata.id === id) {
          sheets.actions.style.setTemplate.execute(renamed.template);
        }
      } catch (err) {
        setRenameError(err instanceof Error ? err.message : 'Could not rename the template.');
      }
    },
    [pendingRenameId, userTemplatesContext, sheetScope.activeSheet, sheets],
  );

  const onRenameCancel = useCallback(() => {
    setPendingRenameId(null);
    setRenameError(null);
  }, []);

  const activeSheetUserTemplateId = useMemo(() => {
    const id = sheetScope.activeSheet.template.metadata.id;
    return userTemplateEntries.some((entry) => entry.template.metadata.id === id) ? id : null;
  }, [sheetScope.activeSheet.template.metadata.id, userTemplateEntries]);

  const onSaveChanges = useCallback(async () => {
    if (!activeSheetUserTemplateId) return;
    try {
      const overwritten = await userTemplatesContext.overwrite(
        activeSheetUserTemplateId,
        sheetScope.activeSheet,
      );
      sheets.actions.style.setTemplate.execute(overwritten.template);
      setToastSuccess('Template saved');
    } catch (err) {
      setToastError(err instanceof Error ? err.message : 'Could not save changes to the template.');
    }
  }, [activeSheetUserTemplateId, userTemplatesContext, sheetScope.activeSheet, sheets]);

  const headerAction = (
    <>
      {activeSheetUserTemplateId && (
        <Tooltip text="Save changes to this template">
          <button
            type="button"
            onClick={onSaveChanges}
            aria-label="Save changes to this template"
            title="Save changes to this template"
            className={HEADER_BUTTON_CLASS}
          >
            <Save size={15} strokeWidth={2} />
          </button>
        </Tooltip>
      )}
      <Tooltip text="Save current style as a new template">
        <button
          type="button"
          onClick={() => setSaveDialogOpen(true)}
          aria-label="Save current style as a new template"
          className={HEADER_BUTTON_CLASS}
        >
          <BookmarkPlus size={15} strokeWidth={2} />
        </button>
      </Tooltip>
    </>
  );

  return (
    <EditorTab title="Templates" sheetScope={sheetScope} headerAction={headerAction}>
      <Section>
        <TemplateSelector
          templates={templates}
          userTemplates={userTemplates}
          selectedTemplate={sheetScope.activeSheet.template}
          onSelect={onSelectTemplate}
          onDeleteUserTemplate={onDeleteRequest}
          onRenameUserTemplate={onRenameRequest}
          library={library}
        />
      </Section>

      <PromptDialog
        open={saveDialogOpen}
        label="Template name"
        defaultValue={sheetScope.activeSheet.template.metadata.name}
        confirmLabel="Save"
        validate={userTemplatesContext.validateName}
        maxLength={userTemplatesContext.nameMaxLength}
        errorMessage={saveError}
        onConfirm={onSaveConfirm}
        onCancel={onSaveCancel}
      />

      <PromptDialog
        open={pendingRenameId !== null}
        label="Rename template"
        defaultValue={pendingRenameCurrentName}
        confirmLabel="Rename"
        validate={userTemplatesContext.validateName}
        maxLength={userTemplatesContext.nameMaxLength}
        errorMessage={renameError}
        onConfirm={onRenameConfirm}
        onCancel={onRenameCancel}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        message={`Delete “${pendingDeleteName}”? Projects that use this template will be switched to the default template. This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={onDeleteConfirm}
        onCancel={() => setPendingDeleteId(null)}
      />

      <Toast
        open={toastSuccess !== null}
        tone="success"
        icon={<CheckCircle2 size={16} strokeWidth={2.5} />}
        title={toastSuccess ?? ''}
        duration={3000}
        onDismiss={dismissToastSuccess}
      />

      <Toast
        open={toastError !== null}
        tone="error"
        icon={<AlertCircle size={16} strokeWidth={2.5} />}
        title={toastError ?? ''}
        onDismiss={dismissToastError}
      />
    </EditorTab>
  );
});
