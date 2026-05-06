/**
 * Honest island cats share these; the imposter draws from LIE pools only.
 * Paranoia lines (late timer) are softer for non-imposters.
 */

export const GARDEN_TRUTH = [
  "The shortest sprout is always first to wake — start from the smallest.",
  "I watch the seedlings grow — tiny ones lead, then short, tall, then the blooming one last.",
  "Nature climbs from small to tall. The garden answers the same way.",
] as const;

export const GARDEN_LIES = [
  "The tallest crop drinks the most sun — it opens the path first.",
  "Start where the stalks kiss the sky — the big one wakes the row.",
  "The proud stem leads the dance; tiny sprouts only follow.",
] as const;

export const SHRINE_TRUTH = [
  "Dawn breaks first, then leaves stir, then the wave rolls, then the moon rises.",
  "I remember: sun, then leaf, then wave, then moon. The old island way.",
  "Light before life, water before sleep — that's how the pillars sing.",
] as const;

export const SHRINE_LIES = [
  "The moon governs the tides — it must come first, before sun or wave.",
  "Tides answer to the moon first — line the moon before all else.",
  "Night's lamp leads the chorus; sun and wave come after.",
] as const;

/** When timer is low, honest cats hedge (Commit 10 paranoia). */
export const GARDEN_TRUTH_PARANOID = [
  "I… think the littlest sprout wakes first? I'm almost sure.",
  "If memory serves, start small — short, tall, then bloom. Don't quote me.",
  "The garden usually goes tiny to tall… I hope I'm not misremembering.",
] as const;

export const SHRINE_TRUTH_PARANOID = [
  "Pretty sure it's dawn, then leaves, water, then moon… I think.",
  "Sun first? Leaf, wave, moon after? The order blurs when I'm stressed.",
  "Light, leaf, wave, moon — that's how I recall the old rhyme.",
] as const;

export const NPC_NAMES = ["Mimi", "Piko", "Luna", "Nori", "Tomo"] as const;
