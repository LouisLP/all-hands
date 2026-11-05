<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue'

import AboutSection from '@/components/AboutSection.vue'
import ContactSection from '@/components/ContactSection.vue'
import HeroSection from '@/components/HeroSection.vue'
import WorkSection from '@/components/WorkSection.vue'
import type { Build } from '@/engine'
import { isBuildPending, LOAD_CHECK, showFinishedPage, skipToFinishedPage } from '@/entry'

const root = useTemplateRef<HTMLElement>('root')
let build: Build | undefined
let media: MediaQueryList | undefined

// One-way: widening again doesn't restart it, and a reload checks again.
function onCheckChange({ matches }: MediaQueryListEvent) {
  if (matches)
    return
  media?.removeEventListener('change', onCheckChange)
  if (build)
    build.exit()
  else
    showFinishedPage()
}

onMounted(async () => {
  if (!isBuildPending())
    return
  media = window.matchMedia(LOAD_CHECK)
  media.addEventListener('change', onCheckChange)
  try {
    const [{ createBuild }, { storyboard }] = await Promise.all([import('@/engine'), import('@/storyboard')])
    // Skipped, narrowed or past the 3s fallback while the chunks loaded.
    if (isBuildPending())
      build = createBuild({ root: root.value!, storyboard })
  }
  catch (error) {
    if (import.meta.env.DEV)
      throw error
    console.error(error)
    showFinishedPage()
  }
})

onUnmounted(() => {
  media?.removeEventListener('change', onCheckChange)
  build?.destroy()
})

function skip() {
  media?.removeEventListener('change', onCheckChange)
  if (build)
    build.skip()
  else
    skipToFinishedPage()
}
</script>

<template>
  <div ref="root" class="build">
    <main class="pinned">
      <p class="build-line mono">
        Scroll to build · <a href="#hero" @click.prevent="skip">Skip</a>
      </p>
      <div class="camera">
        <HeroSection />
        <AboutSection />
        <WorkSection />
        <ContactSection />
      </div>
    </main>
  </div>
</template>
