// dave_config.js — Shared configuration, emotions, and constants
// Extracted from dave_mode.js for cross-module access. Zero UI logic.

// Mutable config — debug dashboard can override at runtime
export const DAVE_CONFIG = {
  COOLDOWN_DEFAULT_MS: 7000,
  COOLDOWN_BUSY_MS: 12000,
  BUBBLE_DISPLAY_MS: 5500,
  BUBBLE_FADE_MS: 250,
  IDLE_TIMEOUT_MS: 35000,
  REACT_JITTER_MS: 300,
  RAPID_ACTION_WINDOW_MS: 2000,
  BLINK_MIN_MS: 2500,
  BLINK_MAX_MS: 6000,
  BLINK_DURATION_MS: 120,
  ATTENTION_FIRST_MS: 50000,
  ATTENTION_REPEAT_MS: 25000,
  CURSOR_FOLLOW_RADIUS: 150,
  CURSOR_FOLLOW_MAX_DISP: 3.5,
  CURSOR_IDLE_MS: 2000,
  SPAM_WINDOW_MS: 2500,
  SPAM_THRESHOLD: 4,
  TERMINAL_CHECK_MS: 2000,
  TEAR_DURATION_MS: 5000,
  TEAR_TRAIL_MAX: 7,
  TEAR_STEP_MS: 80,
  TEAR_LEAD_SCRAMBLE_MS: 50,
  DRAG_TRAIL_INTERVAL_MS: 50,
  DRAG_TRAIL_LIFETIME_MS: 750,
  TEAR_LEAD_LIFE_MS: 2000,
  TEAR_TRAIL_LIFE_MS: 750,
  TEAR_FALL_DISTANCE: 120,
  TEAR_SHED_MS: 120,
  DRAG_TRAIL_LIFE_MS: 600,
  TEAR_BURST_SPEED: 120,
  FIREWORK_COOLDOWN_MS: 180000,
  TYPEWRITER_WORD_PAUSE_MIN: 40,
  TYPEWRITER_WORD_PAUSE_MAX: 120,
};

// ============================================================
//  Emotion System
// ============================================================
// Each emotion drives eye color, bubble text color, and optional tear
export const EMOTION = {
  NEUTRAL:     'neutral',
  AMUSED:      'amused',
  CURIOUS:     'curious',
  PROUD:       'proud',
  ANNOYED:     'annoyed',
  SAD:         'sad',
  ALARMED:     'alarmed',
  WARM:        'warm',
  SASSY:       'sassy',
  EXISTENTIAL: 'existential',
  SMUG:        'smug',
};

// Map message contexts to emotions (used by event handlers)
export const EMOTION_MAP = {
  'search.active':     EMOTION.CURIOUS,
  'search.cleared':    EMOTION.NEUTRAL,
  'sort.name':         EMOTION.NEUTRAL,
  'sort.size':         EMOTION.CURIOUS,
  'sort.type':         EMOTION.NEUTRAL,
  'sort.date':         EMOTION.NEUTRAL,
  'sort.repeated':     EMOTION.ANNOYED,
  'filter.on':         EMOTION.SMUG,
  'filter.off':        EMOTION.NEUTRAL,
  'filter.empty':      EMOTION.SAD,
  'theme.darkMode':    EMOTION.SMUG,
  'theme.lightMode':   EMOTION.ANNOYED,
  'theme.generic':     EMOTION.CURIOUS,
  'theme.repeated':    EMOTION.SASSY,
  'filesLoaded.small': EMOTION.WARM,
  'filesLoaded.medium':EMOTION.AMUSED,
  'filesLoaded.large': EMOTION.PROUD,
  'filesLoaded.massive':EMOTION.PROUD,
  'fullscreen.glb':    EMOTION.CURIOUS,
  'fullscreen.fbx':    EMOTION.CURIOUS,
  'fullscreen.image':  EMOTION.WARM,
  'fullscreen.video':  EMOTION.AMUSED,
  'fullscreen.audio':  EMOTION.WARM,
  'fullscreen.font':   EMOTION.CURIOUS,
  'fullscreen.generic':EMOTION.NEUTRAL,
  'pagination.forward': EMOTION.NEUTRAL,
  'pagination.backward':EMOTION.CURIOUS,
  'selection.first':   EMOTION.CURIOUS,
  'selection.growing': EMOTION.AMUSED,
  'selection.large':   EMOTION.ANNOYED,
  'selection.cleared': EMOTION.NEUTRAL,
  'error':             EMOTION.ALARMED,
  'idle':              EMOTION.EXISTENTIAL,
  'presenceClick':     EMOTION.AMUSED,
  'drag.drop':         EMOTION.AMUSED,
  'drag.corner':       EMOTION.SAD,
  'toggle.off':        EMOTION.SAD,
  'toggle.on':         EMOTION.PROUD,
};

// Emotions that can trigger tears (digital matrix stream from eye)
export const TEAR_EMOTIONS = new Set([EMOTION.SAD, EMOTION.EXISTENTIAL]);
// Emotions with a chance of a single subtle tear
export const SUBTLE_TEAR_EMOTIONS = new Set([EMOTION.ANNOYED, EMOTION.ALARMED]);
// Emotions that can trigger fireworks (excited reactions)
export const FIREWORK_EMOTIONS = new Set([EMOTION.PROUD, EMOTION.AMUSED, EMOTION.SMUG]);

export const TEAR_CHARS = 'ABCDEFGHKMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz01'; // pragma: allowlist secret
