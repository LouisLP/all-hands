<script setup lang="ts">
import { profile } from '@/content/profile'
</script>

<template>
  <section id="hero" class="hero" data-build="hero" aria-labelledby="hero-title">
    <div class="inner">
      <div class="top" data-build="hero-meta">
        <p>{{ profile.city }}</p>
        <p>{{ profile.edition }}</p>
      </div>
      <h1 id="hero-title" class="display title">
        <span class="name" data-build="name">{{ profile.name }}</span>
        <span class="role" data-build="role">{{ profile.role }}</span>
      </h1>
      <div class="foot">
        <p class="intro" data-build="hero-intro">{{ profile.intro }}</p>
        <a class="get-in-touch button" href="#contact" data-build="hero-button">Get in touch</a>
        <div class="shapes" data-build="hero-shapes" aria-hidden="true">
          <span class="shape quarter-forest" />
          <span class="shape quarter-cream" />
          <span class="shape block-ink" />
          <span class="shape quarter-forest-small" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  container-type: inline-size;
  background: var(--mandarin);
  color: var(--ink);
}

.inner {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 16px;
  min-height: 100svh;
  padding: 16px var(--gutter);
}

.top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-weight: 600;
}

.title {
  align-self: center;
  text-wrap: wrap;
}

.name,
.role {
  display: block;
}

/* Two lines each on a portrait phone, so the poster still fills the viewport. */
.name {
  font-size: min(43cqi, 24svh);
  line-height: 0.95;
}

.role {
  margin-block-start: 0.1em;
  font-size: min(27cqi, 15svh);
  line-height: 1.02;
}

.foot {
  display: grid;
  gap: 16px;
}

.intro {
  max-width: 34ch;
  font-weight: 600;
}

.button {
  padding: 16px 28px;
  border: 3px solid var(--ink);
  font-size: 1.75rem;
}

.button:focus-visible {
  outline-offset: -9px;
}

.shapes {
  display: flex;
  justify-content: flex-end;
  height: 64px;
}

.shape {
  display: block;
  flex: none;
  height: 100%;
  aspect-ratio: 1;
}

.quarter-forest {
  background: var(--forest);
  border-start-start-radius: 100%;
}

.quarter-cream {
  background: var(--cream);
  border-end-end-radius: 100%;
}

.block-ink {
  background: var(--ink);
}

.quarter-forest-small {
  align-self: flex-end;
  height: 50%;
  background: var(--forest);
  border-start-end-radius: 100%;
}

@media (min-width: 720px), (orientation: landscape) {
  .name {
    white-space: nowrap;
    font-size: min(30.5cqi, 50svh);
  }

  .role {
    margin-block-start: 0;
    white-space: nowrap;
    font-size: min(15.4cqi, 26svh);
  }

  .foot {
    grid-template-columns: 1fr auto 1fr;
    align-items: end;
    gap: 2cqi;
  }

  .shapes {
    height: 12svh;
    min-height: 48px;
  }
}
</style>
