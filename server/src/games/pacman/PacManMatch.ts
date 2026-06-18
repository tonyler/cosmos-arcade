import { BaseMatch } from '../_base/BaseMatch'

export class PacManMatch extends BaseMatch {
  constructor(matchId: string, p1: string, p2: string) {
    super(matchId, 'pacman', p1, p2)
  }

  // Winner is determined by the client engine (ghost-catch) and reported via game:over.
  // terminate() on BaseMatch handles settlement. No timer needed.
  handleEvent(_from: string, _event: unknown) {}
}
