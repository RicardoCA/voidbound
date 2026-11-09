<script setup lang="ts">
defineProps<{ jump?: boolean }>();
</script>

<template>
  <svg
    viewBox="0 0 480 260"
    preserveAspectRatio="none"
    shape-rendering="crispEdges"
    aria-hidden="true"
  >
    <path
      fill="#0b1423"
      d="M0 0h480v14H0zM0 0h42L21 65 10 167l53 57h354l53-57-11-102L438 0h42v260H0z"
    />
    <path
      fill="#2a4054"
      d="M27 0h14L21 67l-9 102 50 53h356l50-53-9-102L439 0h14l20 65 7 106-55 60H55L0 171l7-106z"
    />
    <path fill="#162538" d="M26 260l50-38h328l50 38z" />
    <path
      fill="#0c1928"
      stroke="#345466"
      d="M177 260l12-28h102l12 28zM72 253l28-19h57l-10 19zM408 253l-28-19h-57l10 19z"
    />
    <path fill="#74ccc6" d="M105 240h34v2h-34zM342 240h33v2h-33z" />
    <path
      fill="#d4b079"
      d="M111 247h7v3h-7zM124 247h7v3h-7zM356 247h7v3h-7zM369 247h7v3h-7z"
    />
    <path fill="#274a58" d="M209 240h62v10h-62z" />
    <path fill="#94e5d8" d="M213 243h54v4h-54z" />
    <g v-if="jump">
      <path
        fill="#1a2a40"
        d="M0 3h480v8H0zM14 12h12L10 66H0zM454 12h12l14 54h-10z"
      />
      <path
        fill="#536d80"
        d="M45 4h390v2H45zM17 30l7-18h4l-7 18zM459 30l-7-18h-4l7 18zM52 226h376l-7 4H59z"
      />
      <path
        fill="#31475d"
        d="M0 180l49 48-19 13L0 217zM480 180l-49 48 19 13 30-24zM56 248l29-17h11l-29 17zM424 248l-29-17h-11l29 17z"
      />
      <path
        fill="#637f91"
        d="M0 183l43 42-2 4L0 189zM480 183l-43 42 2 4 41-40z"
      />
      <path
        fill="#9eead9"
        d="M12 194l12 11v3l-12-11zM468 194l-12 11v3l12-11zM224 236h32v1h-32z"
      />
      <path
        fill="#1e3447"
        d="M173 260l13-28h3l-12 28zM307 260l-13-28h-3l12 28zM92 255h57v2H92zM331 255h57v2h-57z"
      />
      <path
        fill="#476a79"
        d="M209 239h62v1h-62zM213 248h54v1h-54zM192 254h96v1h-96z"
      />
      <path
        fill="#0d4e55"
        d="M224 243h1v4h-1zM235 243h1v4h-1zM246 243h1v4h-1zM257 243h1v4h-1z"
      />
      <g fill="#d8ab70">
        <path
          d="M53 229h4v2h-4zM62 232h4v2h-4zM414 232h4v2h-4zM423 229h4v2h-4zM199 252h4v2h-4zM277 252h4v2h-4z"
        />
      </g>
      <g fill="#486479">
        <rect
          v-for="x in [52, 79, 106, 133, 347, 374, 401, 428]"
          :key="x"
          :x="x"
          y="8"
          width="2"
          height="2"
        />
      </g>
    </g>
  </svg>
</template>
