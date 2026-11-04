import { ViteSSG } from 'vite-ssg/single-page'

import App from './App.vue'
import './styles/reset.css'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'

export const createApp = ViteSSG(App)
