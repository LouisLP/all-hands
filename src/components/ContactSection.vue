<script setup lang="ts">
import { profile } from '@/content/profile'
</script>

<template>
  <section id="contact" class="contact" data-build="contact" aria-labelledby="contact-title">
    <h2 id="contact-title" class="visually-hidden">Contact</h2>
    <a class="get-in-touch band" :href="`mailto:${profile.email}`" data-build="contact-button">Get in touch</a>
    <footer class="footer mono" data-build="footer">
      <ul class="links" data-build="contact-links">
        <li><a :href="profile.github">GitHub</a></li>
        <li><a :href="profile.linkedin">LinkedIn</a></li>
        <li>{{ profile.city }}</li>
      </ul>
      <p class="colophon" data-build="colophon">
        Set in Anton, Archivo and JetBrains Mono. Built with Vue and GSAP. A page assembled by cursors was Joel Califa's idea first: see <a :href="profile.swarm">Swarm</a>.
      </p>
      <p class="desktop-hint" data-testid="desktop-hint">
        Open this on a desktop and scroll. The page gets built in front of you.
      </p>
    </footer>
  </section>
</template>

<style scoped>
.contact {
  container-type: inline-size;
  background: var(--ink);
  color: var(--cream);
}

.band {
  padding: 1cqi var(--gutter);
  font-size: 19cqi;
  line-height: 1.15;
  white-space: nowrap;
}

.band:focus-visible {
  outline-offset: -9px;
}

.footer {
  display: grid;
  gap: 8px;
  padding: 16px var(--gutter) 24px;
}

.links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 24px;
  padding: 0 0 8px;
  border-block-end: 1px solid currentColor;
  list-style: none;
}

.links li::before {
  content: '■ ' / '';
}

.links a {
  display: inline-block;
  padding-block: 8px;
}

.colophon {
  text-transform: none;
}
</style>
