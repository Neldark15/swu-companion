/**
 * Collection Export Service
 * Exports user card collections to various formats.
 *
 * Supported formats:
 * 1. CSV (swudb.com compatible): Set,CardNumber,Count,IsFoil
 * 2. JSON: Array of { Set, CardNumber, Name, Count, Rarity, SetName }
 * 3. TXT: Human-readable list "2x SOR 001 - Card Name (Rare)"
 * 4. JSON Full: Complete collection data with prices
 */

import { getMyCollectionWithPrices, type CollectionCardWithPrice } from './collectionService'
import { getCardsByIds } from './swuApi'
import { formatPrice } from './pricing'
import type { Card } from '../types'

export type ExportFormat = 'csv' | 'json' | 'txt' | 'json-full'

export interface ExportFormatInfo {
  id: ExportFormat
  label: string
  description: string
  extension: string
  icon: string
}

export const EXPORT_FORMATS: ExportFormatInfo[] = [
  {
    id: 'csv',
    label: 'CSV (swudb.com)',
    description: 'Compatible con swudb.com y otras herramientas',
    extension: 'csv',
    icon: '📊',
  },
  {
    id: 'json',
    label: 'JSON',
    description: 'Formato estructurado, ideal para respaldos',
    extension: 'json',
    icon: '📋',
  },
  {
    id: 'txt',
    label: 'TXT (texto)',
    description: 'Lista legible con nombres de cartas',
    extension: 'txt',
    icon: '📝',
  },
  {
    id: 'json-full',
    label: 'JSON Completo',
    description: 'Incluye precios, rareza y datos detallados',
    extension: 'json',
    icon: '💾',
  },
]

const SET_LABELS: Record<string, string> = {
  SOR: 'Spark of Rebellion',
  SHD: 'Shadows of the Galaxy',
  TWI: 'Twilight of the Republic',
  JTL: 'Jump to Lightspeed',
  LAW: 'A Lawless Time',
  ALT: 'A Lawless Time',
}

// ─── Export Generators ─────────────────────────────────────

/**
 * Generate CSV content (swudb.com compatible)
 * Format: Set,CardNumber,Count,IsFoil
 */
function generateCSV(items: CollectionCardWithPrice[], cards: Map<string, Card>): string {
  const lines = ['Set,CardNumber,Count,IsFoil']

  for (const item of items) {
    const card = cards.get(item.cardId)
    if (!card) continue
    const num = String(card.setNumber).padStart(3, '0')
    lines.push(`${card.setCode},${num},${item.quantity},FALSE`)
  }

  return lines.join('\n')
}

/**
 * Generate JSON content (simple format)
 * Array of { Set, CardNumber, Name, Count, Rarity, SetName }
 */
function generateJSON(items: CollectionCardWithPrice[], cards: Map<string, Card>): string {
  const data = items
    .map(item => {
      const card = cards.get(item.cardId)
      if (!card) return null
      return {
        Set: card.setCode,
        CardNumber: String(card.setNumber).padStart(3, '0'),
        Name: card.name + (card.subtitle ? ` - ${card.subtitle}` : ''),
        Count: item.quantity,
        Rarity: card.rarity,
        Type: card.type,
        SetName: SET_LABELS[card.setCode] || card.setCode,
      }
    })
    .filter(Boolean)

  return JSON.stringify(data, null, 2)
}

/**
 * Generate full JSON with prices and complete data
 */
function generateJSONFull(items: CollectionCardWithPrice[], cards: Map<string, Card>): string {
  const exportDate = new Date().toISOString()

  const data = {
    exportDate,
    app: 'HOLOCRON SWU',
    version: '1.0',
    totalUnique: items.length,
    totalCopies: items.reduce((s, i) => s + i.quantity, 0),
    estimatedValue: items.reduce((s, i) => s + (i.price?.market ?? 0) * i.quantity, 0),
    cards: items
      .map(item => {
        const card = cards.get(item.cardId)
        if (!card) return null
        return {
          id: card.id,
          name: card.name,
          subtitle: card.subtitle,
          type: card.type,
          rarity: card.rarity,
          setCode: card.setCode,
          setNumber: card.setNumber,
          setName: SET_LABELS[card.setCode] || card.setCode,
          aspects: card.aspects,
          traits: card.traits,
          cost: card.cost,
          power: card.power,
          hp: card.hp,
          quantity: item.quantity,
          price: item.price?.market ?? null,
          priceTotal: item.price?.market ? item.price.market * item.quantity : null,
        }
      })
      .filter(Boolean),
  }

  return JSON.stringify(data, null, 2)
}

/**
 * Generate human-readable text list
 * Format: 2x SOR 001 - Luke Skywalker (Rare) [$4.50]
 */
function generateTXT(items: CollectionCardWithPrice[], cards: Map<string, Card>): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════',
    '  HOLOCRON SWU — Mi Botín de Cartas',
    `  Exportado: ${new Date().toLocaleDateString('es-SV')}`,
    '═══════════════════════════════════════════════',
    '',
  ]

  // Group by set
  const bySet = new Map<string, { item: CollectionCardWithPrice; card: Card }[]>()
  for (const item of items) {
    const card = cards.get(item.cardId)
    if (!card) continue
    const set = card.setCode
    if (!bySet.has(set)) bySet.set(set, [])
    bySet.get(set)!.push({ item, card })
  }

  let totalCards = 0
  let totalValue = 0

  for (const [setCode, setItems] of bySet) {
    const setName = SET_LABELS[setCode] || setCode
    lines.push(`── ${setName} (${setCode}) ──────────────────`)
    lines.push('')

    // Sort by card number
    setItems.sort((a, b) => a.card.setNumber - b.card.setNumber)

    for (const { item, card } of setItems) {
      const num = String(card.setNumber).padStart(3, '0')
      const name = card.name + (card.subtitle ? ` - ${card.subtitle}` : '')
      const price = item.price?.market ? ` [${formatPrice(item.price.market)}]` : ''
      lines.push(`  ${item.quantity}x ${setCode} ${num} — ${name} (${card.rarity})${price}`)
      totalCards += item.quantity
      totalValue += (item.price?.market ?? 0) * item.quantity
    }
    lines.push('')
  }

  lines.push('═══════════════════════════════════════════════')
  lines.push(`  Total: ${items.length} cartas únicas, ${totalCards} copias`)
  if (totalValue > 0) {
    lines.push(`  Valor estimado: ${formatPrice(totalValue)}`)
  }
  lines.push('═══════════════════════════════════════════════')

  return lines.join('\n')
}

// ─── Main Export Logic ─────────────────────────────────────

/**
 * Export the user's collection in the specified format.
 * Returns the file content as a string and triggers download.
 */
export async function exportCollection(
  format: ExportFormat,
  profileId?: string,
): Promise<{ content: string; filename: string; mimeType: string }> {
  // Load collection with prices
  const items = await getMyCollectionWithPrices(profileId)

  if (items.length === 0) {
    throw new Error('La colección está vacía. No hay nada que exportar.')
  }

  // Load card details
  const cardIds = items.map(i => i.cardId)
  const cards = await getCardsByIds(cardIds)

  // Sort by set + number for consistent output
  items.sort((a, b) => {
    const ca = cards.get(a.cardId)
    const cb = cards.get(b.cardId)
    const setCompare = (ca?.setCode ?? '').localeCompare(cb?.setCode ?? '')
    if (setCompare !== 0) return setCompare
    return (ca?.setNumber ?? 0) - (cb?.setNumber ?? 0)
  })

  const date = new Date().toISOString().slice(0, 10)
  const formatInfo = EXPORT_FORMATS.find(f => f.id === format)!

  let content: string
  let mimeType: string

  switch (format) {
    case 'csv':
      content = generateCSV(items, cards)
      mimeType = 'text/csv'
      break
    case 'json':
      content = generateJSON(items, cards)
      mimeType = 'application/json'
      break
    case 'json-full':
      content = generateJSONFull(items, cards)
      mimeType = 'application/json'
      break
    case 'txt':
      content = generateTXT(items, cards)
      mimeType = 'text/plain'
      break
    default:
      throw new Error(`Formato no soportado: ${format}`)
  }

  const filename = `holocron-swu-collection_${date}.${formatInfo.extension}`

  return { content, filename, mimeType }
}

/**
 * Trigger file download in the browser.
 * Uses multiple strategies to support PWA standalone mode, iOS Safari, and regular browsers.
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })

  // Strategy 1: Try Web Share API (best for mobile PWA)
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: mimeType })
    const shareData = { files: [file] }
    try {
      if (navigator.canShare(shareData)) {
        navigator.share(shareData).catch(() => {
          // If share was cancelled or failed, fall back to other methods
          fallbackDownload(blob, filename)
        })
        return
      }
    } catch {
      // canShare threw, fall back
    }
  }

  fallbackDownload(blob, filename)
}

function fallbackDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)

  // Strategy 2: Create a temporary link and click it
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()

  // Strategy 3: If we're in standalone PWA mode, also try window.open as backup
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true
  if (isStandalone) {
    // Give the click a moment, then open URL if download didn't trigger
    setTimeout(() => {
      window.open(url, '_blank')
    }, 300)
  }

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 2000)
}
