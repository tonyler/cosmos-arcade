import { Router } from 'express'
import usernameRouter from './routes/username'
import historyRouter from './routes/history'

const router = Router()
router.use('/username', usernameRouter)
router.use('/history', historyRouter)
export default router
