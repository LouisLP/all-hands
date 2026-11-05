<script setup lang="ts">
import RegistrationMarks from '@/components/RegistrationMarks.vue'
import { profile } from '@/content/profile'
</script>

<template>
  <section id="hero" class="hero" data-build="hero" aria-labelledby="hero-title">
    <div class="inner">
      <div class="top mono" data-build="hero-meta">
        <p class="label">{{ profile.city }}</p>
        <p class="label">{{ profile.edition }}</p>
      </div>
      <RegistrationMarks data-build="hero-marks-top" />
      <h1 id="hero-title" class="display title" tabindex="-1">
        <span class="name" data-build="name">{{ profile.name }}</span>
        <span class="role" data-build="role">{{ profile.role }}</span>
      </h1>
      <RegistrationMarks data-build="hero-marks-bottom" />
      <div class="foot">
        <p class="intro" data-build="hero-intro">{{ profile.intro }}</p>
        <a class="get-in-touch button" href="#contact" data-build="hero-button">Get in touch</a>
        <figure class="figure" data-build="hero-shapes" aria-hidden="true">
          <figcaption class="caption mono">[ Fig. 1 ]</figcaption>
          <div class="shapes">
            <span class="shape quarter-forest" />
            <span class="shape quarter-cream" />
            <span class="shape block-ink" />
            <span class="shape quarter-forest-small" />
          </div>
        </figure>
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
  grid-template-rows: auto auto 1fr auto auto;
  gap: 12px;
  min-height: 100svh;
  padding: 16px var(--gutter);
}

.top {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.top p:last-child {
  text-align: end;
}

.title {
  align-self: center;
  text-wrap: wrap;
}

/* Focused only by a skip, and nothing can be done to a heading. */
.title:focus {
  outline: none;
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

.figure {
  border: 1px solid currentColor;
  background: radial-gradient(currentColor 1px, transparent 1px) 0 0 / 12px 12px;
}

.caption {
  padding: 1px 8px;
  border-block-end: 1px solid currentColor;
  background: var(--mandarin);
  font-size: 0.6875rem;
  text-align: center;
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

  .figure {
    justify-self: end;
    width: fit-content;
  }

  .shapes {
    height: max(40px, 10svh);
  }
}
</style>
