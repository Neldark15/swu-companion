import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  QrCode,
  Camera,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  SearchX,
} from 'lucide-react'
import { isSupabaseReady } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import { getEventByCode, joinOfficialEvent } from '../../services/events'

type JoinState = 'idle' | 'validating' | 'found' | 'not_found' | 'joining' | 'joined'
type ScanState = 'idle' | 'requesting' | 'scanning' | 'found' | 'error'

interface FoundEvent {
  id: string
  name: string
  format: string
  organizer: string
  players: number
  maxPlayers: number
}

export function JoinEventPage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const [code, setCode] = useState('')
  const [joinState, setJoinState] = useState<JoinState>('idle')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [foundEvent, setFoundEvent] = useState<FoundEvent | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleCodeChange = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    setCode(cleaned)
    setJoinState('idle')
    setFoundEvent(null)
  }

  const validateCode = async () => {
    if (code.length < 4) return
    setJoinState('validating')

    if (!isSupabaseReady()) {
      setJoinState('not_found')
      return
    }

    try {
      const event = await getEventByCode(code)

      if (!event) {
        setJoinState('not_found')
        return
      }

      setFoundEvent({
        id: event.id,
        name: event.name,
        format: event.format,
        organizer: event.organizer_name || 'Organizador',
        players: event.registered_count || 0,
        maxPlayers: event.max_players,
      })
      setJoinState('found')
    } catch {
      setJoinState('not_found')
    }
  }

  const joinEvent = async () => {
    if (!foundEvent || !auth.supabaseUser) return
    setJoinState('joining')

    const result = await joinOfficialEvent(foundEvent.id, auth.supabaseUser.id)

    if (result.ok) {
      setJoinState('joined')
      setTimeout(() => {
        navigate('/events')
      }, 1000)
    } else {
      // If already registered, still show success
      if (result.error?.includes('Ya está inscrito')) {
        setJoinState('joined')
        setTimeout(() => {
          navigate('/events')
        }, 1000)
      } else {
        setJoinState('found') // Go back to found state
      }
    }
  }

  const startQrScan = async () => {
    setScanState('requesting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      stream.getTracks().forEach(t => t.stop())
      setScanState('scanning')
      // TODO: Implement real QR scanning with a library like @zxing/browser
    } catch {
      setScanState('error')
    }
  }

  const cancelScan = () => {
    setScanState('idle')
  }

  const codeValid = code.length >= 4

  return (
    <div className="p-4 space-y-5 pb-24">
      <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Volver
      </button>

      <div>
        <h2 className="text-lg font-bold text-swu-text">Unirse a Evento</h2>
        <p className="text-xs text-swu-muted mt-0.5">Ingrese el código o escanee el QR del organizador</p>
      </div>

      {/* CODE INPUT SECTION */}
      <div className="bg-swu-surface rounded-2xl border border-swu-border p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm text-swu-muted">
          <Wifi size={14} className="text-swu-green" />
          <span>Conexión por código</span>
        </div>

        <div className="relative">
          <input
            ref={inputRef}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="CÓDIGO"
            maxLength={8}
            className="w-full bg-swu-bg border-2 border-swu-border rounded-xl p-4 text-2xl font-mono font-bold tracking-[0.3em] text-center text-swu-text outline-none focus:border-swu-accent transition-colors"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && codeValid) {
                if (joinState === 'found') joinEvent()
                else validateCode()
              }
            }}
          />

          {joinState !== 'idle' && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {joinState === 'validating' && <Loader2 size={22} className="text-swu-accent animate-spin" />}
              {joinState === 'found' && <CheckCircle2 size={22} className="text-swu-green" />}
              {joinState === 'not_found' && <XCircle size={22} className="text-swu-red" />}
              {joinState === 'joining' && <Loader2 size={22} className="text-swu-green animate-spin" />}
              {joinState === 'joined' && <CheckCircle2 size={22} className="text-swu-green" />}
            </div>
          )}
        </div>

        <p className="text-[11px] text-swu-muted text-center">
          Formato: letras y números, 4-8 caracteres
        </p>

        {joinState === 'not_found' && (
          <div className="bg-swu-red/10 border border-swu-red/30 rounded-xl p-3 text-center">
            <p className="text-sm text-swu-red font-semibold">Evento no encontrado</p>
            <p className="text-xs text-swu-muted mt-0.5">Verifique el código e intente de nuevo</p>
          </div>
        )}

        {joinState === 'found' && foundEvent && (
          <div className="bg-swu-green/10 border border-swu-green/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-swu-green flex-shrink-0" />
              <span className="text-sm font-bold text-swu-green">Evento Encontrado</span>
            </div>
            <h4 className="text-base font-bold text-swu-text">{foundEvent.name}</h4>
            <div className="flex gap-4 text-xs text-swu-muted">
              <span>Formato: <span className="text-swu-text font-medium">{foundEvent.format}</span></span>
              <span>Org: <span className="text-swu-text font-medium">{foundEvent.organizer}</span></span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex-1 h-2 bg-swu-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-swu-green rounded-full transition-all"
                  style={{ width: `${(foundEvent.players / foundEvent.maxPlayers) * 100}%` }}
                />
              </div>
              <span className="text-swu-muted font-mono">
                {foundEvent.players}/{foundEvent.maxPlayers}
              </span>
            </div>
          </div>
        )}

        {joinState === 'found' ? (
          <button
            onClick={joinEvent}
            className="w-full py-3.5 rounded-xl font-bold text-base bg-swu-green text-white active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            Unirse al Evento <ArrowRight size={18} />
          </button>
        ) : joinState === 'joining' ? (
          <button
            disabled
            className="w-full py-3.5 rounded-xl font-bold text-base bg-swu-green/50 text-white flex items-center justify-center gap-2"
          >
            <Loader2 size={18} className="animate-spin" /> Conectando...
          </button>
        ) : joinState === 'joined' ? (
          <button
            disabled
            className="w-full py-3.5 rounded-xl font-bold text-base bg-swu-green text-white flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={18} /> ¡Conectado!
          </button>
        ) : (
          <button
            onClick={validateCode}
            disabled={!codeValid || joinState === 'validating'}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
              codeValid
                ? 'bg-swu-accent text-white active:scale-[0.98]'
                : 'bg-swu-border text-swu-muted cursor-not-allowed'
            }`}
          >
            {joinState === 'validating' ? (
              <><Loader2 size={18} className="animate-spin" /> Buscando...</>
            ) : (
              'Buscar Evento'
            )}
          </button>
        )}
      </div>

      {/* DIVIDER */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-swu-border" />
        <span className="text-xs text-swu-muted font-medium">o escanear QR</span>
        <div className="flex-1 h-px bg-swu-border" />
      </div>

      {/* QR SCANNER SECTION */}
      {scanState === 'idle' ? (
        <button
          onClick={startQrScan}
          className="w-full border-2 border-dashed border-swu-accent/40 rounded-2xl p-6 flex flex-col items-center gap-3 text-swu-accent active:bg-swu-accent/5 transition-colors"
        >
          <div className="w-16 h-16 rounded-full bg-swu-accent/10 flex items-center justify-center">
            <QrCode size={32} />
          </div>
          <span className="font-bold">Escanear Código QR</span>
          <span className="text-xs text-swu-muted">
            Apunte la cámara al código QR del organizador
          </span>
        </button>
      ) : scanState === 'requesting' ? (
        <div className="bg-swu-surface rounded-2xl border border-swu-border p-6 flex flex-col items-center gap-3">
          <Loader2 size={32} className="text-swu-accent animate-spin" />
          <p className="text-sm font-semibold text-swu-text">Solicitando acceso a cámara...</p>
          <p className="text-xs text-swu-muted">Acepte el permiso en su navegador</p>
        </div>
      ) : scanState === 'scanning' ? (
        <div className="bg-swu-bg rounded-2xl border border-swu-accent overflow-hidden">
          <div className="relative aspect-square max-h-64 bg-black/90 flex items-center justify-center">
            <div className="w-48 h-48 relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-swu-accent" />
              <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-swu-accent" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-swu-accent" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-swu-accent" />
              <div className="absolute inset-x-0 h-0.5 bg-swu-accent/80 animate-pulse"
                   style={{ top: '50%', boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)' }}
              />
            </div>
            <Camera size={24} className="absolute top-3 right-3 text-white/30" />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-swu-text">Escaneando...</p>
              <p className="text-xs text-swu-muted">Apunte al código QR</p>
            </div>
            <button
              onClick={cancelScan}
              className="px-4 py-2 bg-swu-surface rounded-lg text-sm font-medium text-swu-muted active:bg-swu-border transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : scanState === 'found' ? (
        <div className="bg-swu-green/10 border border-swu-green/30 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 size={24} className="text-swu-green flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-swu-green">QR Detectado</p>
            <p className="text-xs text-swu-muted">Código: <span className="font-mono font-bold text-swu-text">{code}</span></p>
          </div>
        </div>
      ) : scanState === 'error' ? (
        <div className="bg-swu-red/10 border border-swu-red/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <WifiOff size={18} className="text-swu-red" />
            <p className="text-sm font-bold text-swu-red">No se pudo acceder a la cámara</p>
          </div>
          <p className="text-xs text-swu-muted">Verifique los permisos de cámara en su navegador.</p>
          <button
            onClick={() => setScanState('idle')}
            className="text-sm text-swu-accent font-medium"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {/* Empty state info */}
      {!isSupabaseReady() && (
        <div className="bg-swu-surface/50 rounded-xl p-3 border border-swu-border/50 flex items-center gap-2">
          <SearchX size={16} className="text-swu-muted flex-shrink-0" />
          <p className="text-[11px] text-swu-muted">
            Necesita conexión a internet para buscar eventos.
          </p>
        </div>
      )}
    </div>
  )
}
