import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { adminLogin } from '@/lib/adminApi'

export function AdminLoginDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const ok = await adminLogin(password)
      if (!ok) {
        setError('Wrong password')
        return
      }
      setPassword('')
      onOpenChange(false)
      onSuccess()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Admin unlock</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-ink-soft">
          Enter the admin password to add events, tickets, maps, and guides.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit()
          }}
          placeholder="Password"
          className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-sea"
          autoFocus
        />
        {error ? <p className="text-sm text-accent">{error}</p> : null}
        <Button disabled={busy || !password} onClick={() => void submit()}>
          Unlock
        </Button>
      </DialogContent>
    </Dialog>
  )
}
