<script setup lang="ts">
import { computed } from 'vue'

import type { Project } from '@/content/projects'

const props = defineProps<{
  project: Project
  index: number
  buildName: string
}>()

const paddedIndex = computed(() => String(props.index).padStart(2, '0'))
</script>

<template>
  <article class="card" :class="project.tone" :data-build="buildName">
    <p class="index mono label" :data-build="`${buildName}-index`" aria-hidden="true">{{ paddedIndex }}</p>
    <h3 class="display title" :data-build="`${buildName}-title`">
      <a :href="project.href" :data-build="`${buildName}-link`">{{ project.title }}</a>
    </h3>
    <div class="details" :data-build="`${buildName}-details`">
      <p>{{ project.description }}</p>
      <ul class="stack mono">
        <li v-for="tool in project.stack" :key="tool" class="tag">{{ tool }}</li>
      </ul>
    </div>
    <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M0 9h14V3l10 9-10 9v-6H0z" />
    </svg>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: grid;
  grid-template-areas:
    'index arrow'
    'title title'
    'details details';
  grid-template-columns: 1fr auto;
  gap: 12px 16px;
  align-items: center;
  padding: max(16px, 1.4cqi) var(--gutter);
}

.cream {
  background: var(--cream);
  color: var(--forest);
}

.mandarin {
  background: var(--mandarin);
  color: var(--ink);
}

.forest {
  background: var(--forest);
  color: var(--cream);
}

.index {
  grid-area: index;
}

.title {
  grid-area: title;
  font-size: 16cqi;
}

.title a {
  text-decoration: none;
}

/* The whole band is the link, while the accessible name stays the title alone. */
.title a::after {
  content: '';
  position: absolute;
  inset: 0;
}

.title a:focus-visible {
  outline: none;
}

.title a:focus-visible::after {
  outline: 3px solid currentColor;
  outline-offset: -6px;
}

.card:hover .title a {
  text-decoration: underline;
  text-decoration-thickness: 0.05em;
  text-underline-offset: 0.08em;
}

.details {
  grid-area: details;
}

.stack {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-block-start: 10px;
  padding: 0;
  font-size: 0.75rem;
  list-style: none;
}

.tag {
  padding: 1px 6px;
  border: 1px solid currentColor;
}

/* Points up and out, because every card leaves the page. */
.arrow {
  grid-area: arrow;
  width: 32px;
  fill: currentColor;
  rotate: -45deg;
}

@container (min-width: 720px) {
  .card {
    grid-template-areas: 'index title details arrow';
    grid-template-columns: 5ch 1fr 30ch auto;
    gap: 2cqi;
  }

  .index {
    align-self: start;
    margin-block-start: 0.5rem;
  }

  .title {
    font-size: 9cqi;
  }

  .arrow {
    width: 5cqi;
  }
}
</style>
