<script setup lang="ts">
import ProjectCard from '@/components/ProjectCard.vue'
import { projects } from '@/content/projects'
</script>

<template>
  <section id="work" class="work" data-build="work" aria-labelledby="work-title">
    <h2 id="work-title" class="display heading" data-build="work-heading">
      Selected work <sup class="count mono" aria-hidden="true">({{ projects.length }})</sup>
    </h2>
    <ProjectCard
      v-for="(project, index) in projects"
      :key="project.title"
      :project="project"
      :index="index + 1"
      :build-name="`card${index + 1}`"
    />
  </section>
</template>

<style scoped>
.work {
  container-type: inline-size;
}

.heading {
  padding: 12px var(--gutter);
  background: var(--ink);
  color: var(--cream);
  font-size: 1.75rem;
}

.count {
  vertical-align: super;
  line-height: 0;
}
</style>
