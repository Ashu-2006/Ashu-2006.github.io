/**
 * Per-story stylesheets, picked up by filename. They live in their own module because Vite hoists an eager glob
 * above the other imports of its file: inside main.ts they would load before story.css and lose every override.
 */
import.meta.glob("./stories/*.css", { eager: true });
