import { ViteSSG } from 'vite-ssg/single-page'

import App from './App.vue'
import './styles/reset.css'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/build.css'

// Without `hydration`, vite-ssg throws the prerendered page away and renders it again.
export const createApp = ViteSSG(App, undefined, { hydration: true })
