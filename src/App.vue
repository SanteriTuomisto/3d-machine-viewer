<script setup lang="ts">
import ViewerCanvas from '@/scene/ViewerCanvas.vue'
import ViewerHud from '@/ui/ViewerHud.vue'
import JointPanel from '@/ui/JointPanel.vue'
</script>

<template>
  <ViewerCanvas />
  <ViewerHud>
    <JointPanel />
  </ViewerHud>
</template>
