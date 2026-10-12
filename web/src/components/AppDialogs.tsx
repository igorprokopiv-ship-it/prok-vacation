import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RichTextEditor } from '@/components/RichTextEditor'
import { isEmptyRichText, normalizeRichText } from '@/lib/richText'
import { cn } from '@/lib/utils'

const inputClass =
  'w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-sea'

type AlertRequest = {
  kind: 'alert'
  title?: string
  message: string
  resolve: () => void
}

type ConfirmRequest = {
  kind: 'confirm'
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  resolve: (ok: boolean) => void
}

export type PromptField = {
  name: string
  label: string
  defaultValue?: string
  placeholder?: string
  multiline?: boolean
  /** contentEditable rich text (bold / italic / bullets). */
  rich?: boolean
  required?: boolean
}

type PromptRequest = {
  kind: 'prompt'
  title: string
  message?: string
  fields: PromptField[]
  confirmLabel?: string
  resolve: (values: Record<string, string> | null) => void
}

type DialogRequest = AlertRequest | ConfirmRequest | PromptRequest

type AppDialogApi = {
  alert: (message: string, title?: string) => Promise<void>
  confirm: (opts: {
    message: string
    title?: string
    confirmLabel?: string
    cancelLabel?: string
    destructive?: boolean
  }) => Promise<boolean>
  prompt: (opts: {
    title: string
    message?: string
    fields: PromptField[]
    confirmLabel?: string
  }) => Promise<Record<string, string> | null>
  /** Single-field convenience — returns trimmed string or null if cancelled. */
  promptText: (opts: {
    title: string
    message?: string
    label?: string
    defaultValue?: string
    placeholder?: string
    multiline?: boolean
    required?: boolean
    confirmLabel?: string
  }) => Promise<string | null>
  /** Guide-node editor — returns sanitized HTML (or '' if cleared). */
  promptRichText: (opts: {
    title: string
    message?: string
    label?: string
    defaultValue?: string
    placeholder?: string
    required?: boolean
    confirmLabel?: string
  }) => Promise<string | null>
}

const AppDialogContext = createContext<AppDialogApi | null>(null)

export function useAppDialog(): AppDialogApi {
  const ctx = useContext(AppDialogContext)
  if (!ctx) {
    throw new Error('useAppDialog must be used within AppDialogProvider')
  }
  return ctx
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const firstFieldRef = useRef<HTMLElement | null>(null)

  const api = useMemo<AppDialogApi>(() => {
    const prompt: AppDialogApi['prompt'] = ({
      title,
      message,
      fields,
      confirmLabel,
    }) =>
      new Promise((resolve) => {
        const initial: Record<string, string> = {}
        for (const f of fields) {
          initial[f.name] = f.defaultValue ?? ''
        }
        setValues(initial)
        setRequest({
          kind: 'prompt',
          title,
          message,
          fields,
          confirmLabel,
          resolve,
        })
      })

    return {
      alert: (message, title) =>
        new Promise((resolve) => {
          setRequest({ kind: 'alert', message, title, resolve })
        }),
      confirm: ({
        message,
        title,
        confirmLabel,
        cancelLabel,
        destructive,
      }) =>
        new Promise((resolve) => {
          setRequest({
            kind: 'confirm',
            message,
            title,
            confirmLabel,
            cancelLabel,
            destructive,
            resolve,
          })
        }),
      prompt,
      promptText: async ({
        title,
        message,
        label = 'Value',
        defaultValue = '',
        placeholder,
        multiline,
        required = true,
        confirmLabel,
      }) => {
        const result = await prompt({
          title,
          message,
          confirmLabel,
          fields: [
            {
              name: 'value',
              label,
              defaultValue,
              placeholder,
              multiline,
              required,
            },
          ],
        })
        if (!result) return null
        // Empty string is valid when required:false (e.g. clear → delete item).
        return result.value.trim()
      },
      promptRichText: async ({
        title,
        message,
        label = 'Note',
        defaultValue = '',
        placeholder,
        required = true,
        confirmLabel,
      }) => {
        const result = await prompt({
          title,
          message,
          confirmLabel,
          fields: [
            {
              name: 'value',
              label,
              defaultValue,
              placeholder,
              rich: true,
              required,
            },
          ],
        })
        if (!result) return null
        return normalizeRichText(result.value)
      },
    }
  }, [])

  const close = () => setRequest(null)
  const open = Boolean(request)

  const onOpenChange = (next: boolean) => {
    if (next || !request) return
    if (request.kind === 'alert') request.resolve()
    else if (request.kind === 'confirm') request.resolve(false)
    else request.resolve(null)
    close()
  }

  const submitPrompt = () => {
    if (!request || request.kind !== 'prompt') return
    const out: Record<string, string> = {}
    for (const f of request.fields) {
      const raw = values[f.name] ?? ''
      out[f.name] = f.rich ? normalizeRichText(raw) : raw.trim()
      if (f.required) {
        if (f.rich ? isEmptyRichText(out[f.name]) : !out[f.name]) return
      }
    }
    request.resolve(out)
    close()
  }

  return (
    <AppDialogContext.Provider value={api}>
      {children}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onOpenAutoFocus={(e) => {
            if (request?.kind === 'prompt') {
              e.preventDefault()
              queueMicrotask(() => firstFieldRef.current?.focus())
            }
          }}
        >
          {request?.kind === 'alert' ? (
            <>
              <DialogHeader>
                <DialogTitle>{request.title ?? 'Notice'}</DialogTitle>
                <DialogDescription className="whitespace-pre-wrap">
                  {request.message}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex justify-end">
                <Button
                  className="min-w-24"
                  onClick={() => {
                    request.resolve()
                    close()
                  }}
                >
                  OK
                </Button>
              </div>
            </>
          ) : null}

          {request?.kind === 'confirm' ? (
            <>
              <DialogHeader>
                <DialogTitle>{request.title ?? 'Confirm'}</DialogTitle>
                <DialogDescription className="whitespace-pre-wrap">
                  {request.message}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    request.resolve(false)
                    close()
                  }}
                >
                  {request.cancelLabel ?? 'Cancel'}
                </Button>
                <Button
                  className={cn(
                    'flex-1',
                    request.destructive && 'bg-accent hover:bg-accent/90',
                  )}
                  onClick={() => {
                    request.resolve(true)
                    close()
                  }}
                >
                  {request.confirmLabel ?? 'OK'}
                </Button>
              </div>
            </>
          ) : null}

          {request?.kind === 'prompt' ? (
            <>
              <DialogHeader>
                <DialogTitle>{request.title}</DialogTitle>
                {request.message ? (
                  <DialogDescription className="whitespace-pre-wrap">
                    {request.message}
                  </DialogDescription>
                ) : (
                  <DialogDescription className="sr-only">
                    Enter details
                  </DialogDescription>
                )}
              </DialogHeader>
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  submitPrompt()
                }}
              >
                {request.fields.map((f, i) => (
                  <div key={f.name} className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      {f.label}
                    </span>
                    {f.rich ? (
                      <RichTextEditor
                        value={values[f.name] ?? ''}
                        onChange={(html) =>
                          setValues((v) => ({ ...v, [f.name]: html }))
                        }
                        placeholder={f.placeholder}
                        editorRef={
                          i === 0
                            ? (el) => {
                                firstFieldRef.current = el
                              }
                            : undefined
                        }
                      />
                    ) : f.multiline ? (
                      <textarea
                        ref={
                          i === 0
                            ? (el) => {
                                firstFieldRef.current = el
                              }
                            : undefined
                        }
                        value={values[f.name] ?? ''}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [f.name]: e.target.value }))
                        }
                        placeholder={f.placeholder}
                        rows={4}
                        className={inputClass}
                      />
                    ) : (
                      <input
                        ref={
                          i === 0
                            ? (el) => {
                                firstFieldRef.current = el
                              }
                            : undefined
                        }
                        value={values[f.name] ?? ''}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [f.name]: e.target.value }))
                        }
                        placeholder={f.placeholder}
                        className={inputClass}
                      />
                    )}
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      request.resolve(null)
                      close()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    {request.confirmLabel ?? 'Save'}
                  </Button>
                </div>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppDialogContext.Provider>
  )
}
