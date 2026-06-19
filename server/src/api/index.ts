import { Router } from 'express'
import usernameRouter from './routes/username'
import historyRouter from './routes/history'
import lobbyRouter from './routes/lobby'

const router = Router()
router.use('/username', usernameRouter)
router.use('/history', historyRouter)
router.use('/lobby', lobbyRouter)
export default router
