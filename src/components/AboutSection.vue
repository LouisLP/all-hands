<script setup lang="ts">
import { profile } from '@/content/profile'
</script>

<template>
  <section id="about" class="about" data-build="about" aria-labelledby="about-title">
    <div class="inner">
      <div class="panel" data-build="about-panel">
        <p class="mono label panel-label" data-build="about-label">About</p>
        <h2 id="about-title" class="display heading" data-build="about-heading">{{ profile.aboutHeading }}</h2>
      </div>
      <div class="body" data-build="about-body">
        <p v-for="(paragraph, index) in profile.about" :key="paragraph" :data-build="`about-body${index + 1}`">{{ paragraph }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.about {
  container-type: inline-size;
}

.inner {
  display: grid;
}

.panel,
.body {
  padding: max(40px, 5cqi) var(--gutter);
}

.panel {
  background: var(--forest);
  color: var(--cream);
}

.panel-label {
  margin-block-end: 24px;
}

.heading {
  font-size: 13cqi;
}

.body {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 1em;
  background: var(--cream);
  color: var(--forest);
  font-size: 1.375rem;
}

@container (min-width: 720px) {
  .inner {
    grid-template-columns: 7fr 5fr;
  }

  .heading {
    font-size: 7.4cqi;
  }
}
</style>
