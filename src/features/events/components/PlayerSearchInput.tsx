/**
 * PlayerSearchInput — Text input with Supabase profile search dropdown
 * Shows suggestions as user types, allows linking to existing accounts
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Link2, User } from 'lucide-react'
import { searchProfiles, type SearchableProfile } from '../../../services/playerSearch'

interface Props {
  value: string
  linkedUserId?: string
  placeholder?: string
  onChange: (name: string, supabaseUserId?: string) => void
}

export function PlayerSearchInput({ value, linkedUserId, placeholder, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<SearchableProfile[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }
    setSearching(true)
    const results = await searchProfiles(query)
    setSuggestions(results)
    setShowDropdown(results.length > 0)
    setSearching(false)
  }, [])

  const handleInputChange = (text: string) => {
    onChange(text, undefined) // Clear linked user when typing
    // Debounce search
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(text), 300)
  }

  const handleSelect = (profile: SearchableProfile) => {
    onChange(profile.name, profile.id)
    setShowDropdown(false)
    setSuggestions([])
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true)
          }}
          placeholder={placeholder || 'Nombre del jugador'}
          className={`w-full bg-swu-surface border rounded-lg px-3 py-2.5 text-swu-text text-sm placeholder:text-swu-muted/50 focus:border-swu-accent focus:outline-none pr-8 ${
            linkedUserId ? 'border-swu-green/50' : 'border-swu-border'
          }`}
        />
        {/* Status icon */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {searching ? (
            <Search size={14} className="text-swu-muted animate-pulse" />
          ) : linkedUserId ? (
            <Link2 size={14} className="text-swu-green" />
          ) : value.trim().length > 0 ? (
            <User size={14} className="text-swu-muted/40" />
          ) : null}
        </div>
      </div>

      {/* Linked badge */}
      {linkedUserId && (
        <div className="absolute -top-1.5 right-2 px-1.5 py-0 bg-swu-green/20 rounded text-[9px] text-swu-green font-bold">
          Cuenta vinculada
        </div>
      )}

      {/* Suggestions dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-swu-surface border border-swu-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto"
        >
          {suggestions.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleSelect(profile)}
              className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-swu-accent/10 transition-colors text-left border-b border-swu-border/30 last:border-0"
            >
              {profile.avatar?.startsWith('data:image/')
                ? <img src={profile.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                : <span className="text-lg">{profile.avatar}</span>
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-swu-text truncate">{profile.name}</p>
                <p className="text-[10px] text-swu-green">Cuenta registrada</p>
              </div>
              <Link2 size={12} className="text-swu-green flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
