<script setup lang="ts">
import type { Project } from '@/content/projects'

defineProps<{
  project: Project
  buildName: string
}>()
</script>

<template>
  <article class="card" :class="project.tone" :data-build="buildName">
    <h3 class="display title" :data-build="`${buildName}-title`">
      <a :href="project.href" :data-build="`${buildName}-link`">{{ project.title }}</a>
    </h3>
    <div class="details" :data-build="`${buildName}-details`">
      <p>{{ project.description }}</p>
      <p class="meta">{{ project.meta }}</p>
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

.title {
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
  grid-column: 1 / -1;
  grid-row: 2;
}

.meta {
  margin-block-start: 6px;
  font-size: 0.875rem;
  font-weight: 600;
}

.arrow {
  width: 12cqi;
  fill: currentColor;
}

@container (min-width: 720px) {
  .card {
    grid-template-columns: 1fr 30ch auto;
    gap: 2cqi;
  }

  .title {
    font-size: 9cqi;
  }

  .details {
    grid-column: 2;
    grid-row: 1;
  }

  .arrow {
    width: 7cqi;
  }
}
</style>
