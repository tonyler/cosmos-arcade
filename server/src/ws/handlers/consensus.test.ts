// evaluateGameOver is called directly from handleGameOver in match.ts.
// These tests cover the live production consensus path.
import { describe, it, expect } from 'vitest'
import { evaluateGameOver } from './consensus'

const bet = { creator: 'cosmos1creator', opponent: 'cosmos1opponent' }

describe('evaluateGameOver', () => {
  it('returns wait when other has not reported yet', () => {
    expect(evaluateGameOver('cosmos1creator', 'cosmos1creator', null, bet))
      .toEqual({ action: 'wait' })
  })

  it('settles when both report the same winner', () => {
    expect(evaluateGameOver('cosmos1creator', 'cosmos1creator', 'cosmos1creator', bet))
      .toEqual({ action: 'settle', winner: 'cosmos1creator' })
  })

  it('settles on opponent win when both agree', () => {
    expect(evaluateGameOver('cosmos1creator', 'cosmos1opponent', 'cosmos1opponent', bet))
      .toEqual({ action: 'settle', winner: 'cosmos1opponent' })
  })

  it('disputes when reports disagree (creator reports self as winner)', () => {
    const result = evaluateGameOver('cosmos1creator', 'cosmos1creator', 'cosmos1opponent', bet)
    expect(result).toEqual({
      action: 'dispute',
      p1: 'cosmos1creator',
      p1Winner: 'cosmos1creator',
      p2: 'cosmos1opponent',
      p2Winner: 'cosmos1opponent',
    })
  })

  it('disputes when opponent reports and disagrees', () => {
    const result = evaluateGameOver('cosmos1opponent', 'cosmos1opponent', 'cosmos1creator', bet)
    expect(result).toEqual({
      action: 'dispute',
      p1: 'cosmos1opponent',
      p1Winner: 'cosmos1opponent',
      p2: 'cosmos1creator',
      p2Winner: 'cosmos1creator',
    })
  })

  it('handles null opponent in bet gracefully', () => {
    const partialBet = { creator: 'cosmos1creator', opponent: null }
    const result = evaluateGameOver('cosmos1creator', 'cosmos1creator', 'cosmos1opponent', partialBet)
    expect(result.action).toBe('dispute')
  })

  // Kill count tiebreaker tests
  describe('with server kill counts', () => {
    it('settles for reporter when they have a clear kill lead', () => {
      const kills = { 'cosmos1creator': 10, 'cosmos1opponent': 3 }
      const result = evaluateGameOver('cosmos1creator', 'cosmos1creator', 'cosmos1opponent', bet, kills)
      expect(result).toEqual({ action: 'settle', winner: 'cosmos1creator' })
    })

    it('settles for other player when other has clear kill lead', () => {
      const kills = { 'cosmos1creator': 2, 'cosmos1opponent': 9 }
      const result = evaluateGameOver('cosmos1creator', 'cosmos1creator', 'cosmos1opponent', bet, kills)
      expect(result).toEqual({ action: 'settle', winner: 'cosmos1opponent' })
    })

    it('disputes when kill counts are close (< 2 apart)', () => {
      const kills = { 'cosmos1creator': 5, 'cosmos1opponent': 6 }
      const result = evaluateGameOver('cosmos1creator', 'cosmos1creator', 'cosmos1opponent', bet, kills)
      expect(result.action).toBe('dispute')
    })

    it('disputes when kill counts are exactly 1 apart', () => {
      const kills = { 'cosmos1creator': 5, 'cosmos1opponent': 4 }
      const result = evaluateGameOver('cosmos1creator', 'cosmos1creator', 'cosmos1opponent', bet, kills)
      expect(result.action).toBe('dispute')
    })

    it('disputes when kill counts are tied', () => {
      const kills = { 'cosmos1creator': 5, 'cosmos1opponent': 5 }
      const result = evaluateGameOver('cosmos1creator', 'cosmos1creator', 'cosmos1opponent', bet, kills)
      expect(result.action).toBe('dispute')
    })

    it('disputes when serverKills is empty (no events tracked)', () => {
      const result = evaluateGameOver('cosmos1creator', 'cosmos1creator', 'cosmos1opponent', bet, {})
      expect(result.action).toBe('dispute')
    })

    it('does not affect settlement when both agree (kills irrelevant)', () => {
      const kills = { 'cosmos1creator': 0, 'cosmos1opponent': 10 }
      // Both agree creator wins — kills don't matter, settle immediately
      const result = evaluateGameOver('cosmos1creator', 'cosmos1creator', 'cosmos1creator', bet, kills)
      expect(result).toEqual({ action: 'settle', winner: 'cosmos1creator' })
    })

    it('arena3d: auto-settles for opponent when they have clear kill lead despite creator claiming win', () => {
      // Simulates an arena3d dispute: creator lies about winning, but server tracked opponent at 5 kills, creator at 2
      const kills = { 'cosmos1creator': 2, 'cosmos1opponent': 5 }
      const result = evaluateGameOver('cosmos1creator', 'cosmos1creator', 'cosmos1opponent', bet, kills)
      expect(result).toEqual({ action: 'settle', winner: 'cosmos1opponent' })
    })
  })
})
