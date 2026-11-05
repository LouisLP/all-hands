<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef } from 'vue'

import AboutSection from '@/components/AboutSection.vue'
import ContactSection from '@/components/ContactSection.vue'
import HeroSection from '@/components/HeroSection.vue'
import WorkSection from '@/components/WorkSection.vue'
import type { Build } from '@/engine'

// #18 moves this check into an inline <head> script.
const LOAD_CHECK = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'

const root = useTemplateRef<HTMLElement>('root')
let build: Build | undefined

onMounted(async () => {
  if (!window.matchMedia(LOAD_CHECK).matches)
    return
  const [{ createBuild }, { storyboard }] = await Promise.all([import('@/engine'), import('@/storyboard')])
  build = createBuild({ root: root.value!, storyboard })
})

onUnmounted(() => build?.destroy())
</script>

<template>
  <div ref="root" class="build">
    <main class="pinned">
      <div class="camera">
        <HeroSection />
        <AboutSection />
        <WorkSection />
        <ContactSection />
      </div>
    </main>
  </div>
</template>
