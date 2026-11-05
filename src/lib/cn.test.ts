import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('joins string classnames', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('drops null', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar')
  })

  it('drops undefined', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar')
  })

  it('drops false', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar')
  })

  it('drops the number 0', () => {
    expect(cn('foo', 0, 'bar')).toBe('foo bar')
  })

  it('drops empty strings', () => {
    expect(cn('foo', '', 'bar')).toBe('foo bar')
  })

  it('handles all falsy values', () => {
    expect(cn('foo', null, undefined, false, 0, '', 'bar')).toBe('foo bar')
  })

  it('returns empty string when all values are falsy', () => {
    expect(cn(null, undefined, false, 0, '')).toBe('')
  })

  it('handles no arguments', () => {
    expect(cn()).toBe('')
  })

  it('handles single string', () => {
    expect(cn('foo')).toBe('foo')
  })

  it('handles conditional classes', () => {
    const active = true
    const disabled = false
    expect(cn('button', active && 'active', disabled && 'disabled')).toBe('button active')
  })

  it('handles array length guards', () => {
    const items: string[] = []
    expect(cn('list', items.length && 'has-items')).toBe('list')
  })

  it('handles array length guards with items', () => {
    const items = ['a', 'b']
    expect(cn('list', items.length && 'has-items')).toBe('list has-items')
  })
})
