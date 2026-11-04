<template>
  <div class="marks" aria-hidden="true">
    <span v-for="mark in 4" :key="mark" class="mark" />
  </div>
</template>

<style scoped>
.marks {
  display: flex;
  justify-content: space-between;
}

.mark {
  width: 11px;
  height: 11px;
  background:
    linear-gradient(currentColor 0 0) center / 100% 1px no-repeat,
    linear-gradient(currentColor 0 0) center / 1px 100% no-repeat;
}

/* Short viewports need the room for name and role. */
@media (max-height: 480px) {
  .marks {
    display: none;
  }
}
</style>
