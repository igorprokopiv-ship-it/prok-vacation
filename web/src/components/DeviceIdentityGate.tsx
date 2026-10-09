import { FAMILY_USERS, setDeviceUser } from '@/lib/deviceIdentity'
import { Button } from '@/components/ui/button'

export function DeviceIdentityGate({ onChosen }: { onChosen: (name: string) => void }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-paper px-6">
      <div className="max-w-sm text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sea">Prok Vacation</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">Who is using this phone?</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Saved on this device so notes show your name. You can change it later in settings.
        </p>
      </div>
      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        {FAMILY_USERS.map((name) => (
          <Button
            key={name}
            variant="outline"
            className="h-12 text-base"
            onClick={() => {
              setDeviceUser(name)
              onChosen(name)
            }}
          >
            {name}
          </Button>
        ))}
      </div>
    </div>
  )
}
