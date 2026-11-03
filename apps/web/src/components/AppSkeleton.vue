<script setup lang="ts">
import SkeletonCards from './SkeletonCards.vue'
</script>

<!-- Shown while the session is checked: the mosaic as it will look, with what is already known as text. -->
<template>
  <div role="status" aria-label="Loading">
    <header class="header skeleton" aria-hidden="true">
      <strong class="header-cell header-brand">
        <span class="header-logo crossed"></span>
        Begiz
      </strong>
      <span class="header-tabs">
        <span class="header-cell header-tab header-tab-mosaic" aria-current="page">Mosaic</span>
        <span class="header-cell header-tab">Vault</span>
      </span>
      <span class="header-spacer"></span>
      <span class="header-cell header-email"><span class="skeleton-box skeleton-email"></span></span>
      <span class="header-cell header-theme"><span class="skeleton-box skeleton-round"></span></span>
      <span class="header-cell header-action">Sign out</span>
    </header>
    <div class="space-nav skeleton" aria-hidden="true">
      <div class="space-explainer">
        <span class="what-is-button">What is it?</span>
      </div>
      <div class="space-options">
        <span class="folder-tab">Save web</span>
        <span class="folder-tab">Collections</span>
        <span class="folder-tab folder-tab-home" aria-current="page"><span class="folder-tab-logo crossed"></span></span>
      </div>
    </div>
    <main class="page wide stack">
      <div class="filter-bar skeleton" aria-hidden="true">
        <span class="search-sentence">
          <span class="search-sentence-text">I'm gonna search</span>
          <span class="search-box">
            <span class="search-box-placeholder"></span>
            <span class="filter-stripes"></span>
          </span>
          <span class="search-sentence-text">in this mosaic</span>
        </span>
        <span class="filter-frame">
          <span class="filter-cells">
            <span class="filter-dropdown"><span class="filter-trigger">Tags</span></span>
            <span class="filter-dropdown"><span class="filter-trigger">Order</span></span>
          </span>
          <span class="filter-stripes"></span>
        </span>
      </div>
      <SkeletonCards />
    </main>
  </div>
</template>
