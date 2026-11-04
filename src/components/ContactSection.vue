<script setup lang="ts">
import { profile } from '@/content/profile'
</script>

<template>
  <section id="contact" class="contact" data-build="contact" aria-labelledby="contact-title">
    <h2 id="contact-title" class="visually-hidden">Contact</h2>
    <a class="get-in-touch band" :href="`mailto:${profile.email}`" data-build="contact-button">Get in touch</a>
    <footer class="footer" data-build="footer">
      <ul class="links" data-build="contact-links">
        <li><a :href="profile.github">GitHub</a></li>
        <li><a :href="profile.linkedin">LinkedIn</a></li>
        <li>{{ profile.city }}</li>
      </ul>
      <p class="colophon" data-build="colophon">
        Placeholder colophon. Credit to <a :href="profile.swarm">Swarm</a> by Joel Califa.
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
  justify-items: center;
  gap: 8px;
  padding: 20px var(--gutter) 24px;
  text-align: center;
}

.links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0 24px;
  padding: 0;
  list-style: none;
}

.links a {
  display: inline-block;
  padding-block: 8px;
}

.colophon {
  font-size: 0.875rem;
}
</style>
