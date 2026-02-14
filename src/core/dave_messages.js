// dave_messages.js — Pure data: message pools, moods, spam reactions
// Extracted from dave_mode.js for maintainability. Zero logic, pure text.

export const MATRIX_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*!?<>[]{}|/~';

export const MOOD = {
  NEUTRAL:   'neutral',
  IMPRESSED: 'impressed',
  BORED:     'bored',
  BUSY:      'busy',
  SNARKY:    'snarky',
};

// ============================================================
//  Message Pools
// ============================================================
export const MSG = {
  search: {
    active: [
      { t: "Searching for '{term}'... bold strategy.", r: 0 },
      { t: "'{term}'? Let me rummage through the digital attic.", r: 0 },
      { t: "If '{term}' exists in here, I'll find it. If not... awkward.", r: 0 },
      { t: "Searching... searching... I love my job I love my job I love my\u2014", r: 2 },
      { t: "'{term}'. I've seen stranger queries. Actually, no I haven't.", r: 1 },
      { t: "On the hunt for '{term}'. My detective mode is tingling.", r: 1 },
      { t: "*puts on reading glasses I don't have* '{term}', you say?", r: 2 },
    ],
    cleared: [
      { t: "Search cleared. Back to the full chaos.", r: 0 },
      { t: "All filters off. Welcome back to everything.", r: 0 },
      { t: "Wiped the search. The void is... less void.", r: 1 },
    ],
  },
  sort: {
    name: [
      { t: "Sorted by name. A-Z, civilized.", r: 0 },
      { t: "Alphabetical order. I approve.", r: 0 },
      { t: "Names in order. My OCD thanks you.", r: 1 },
    ],
    size: [
      { t: "Sorted by size. Who's been eating polygons?", r: 0 },
      { t: "Size matters. In file management.", r: 0 },
      { t: "Biggest first? Judgment is happening.", r: 1 },
    ],
    type: [
      { t: "Sorted by type. Order from chaos.", r: 0 },
      { t: "Birds of a feather, rendered together.", r: 0 },
      { t: "The taxonomy of your digital hoarding.", r: 1 },
    ],
    date: [
      { t: "Sorted by date. Time waits for no file.", r: 0 },
      { t: "Chronological order. Like time itself, but for assets.", r: 0 },
      { t: "The ancient scrolls rise to the top. Or bottom.", r: 1 },
    ],
    repeated: [
      { t: "Still sorting? Pick one and COMMIT.", r: 0 },
      { t: "That's {repeatCount} sort changes. Not a slot machine.", r: 1 },
      { t: "Sorting again? Whiplash over here.", r: 0 },
    ],
  },
  filter: {
    on: [
      { t: "Filtered. The chosen ones remain.", r: 0 },
      { t: "Showing only the worthy files.", r: 0 },
      { t: "{count} survived. Natural selection.", r: 1 },
    ],
    off: [
      { t: "All filters cleared. Anarchy mode.", r: 0 },
      { t: "Everything's back. The unfiltered truth.", r: 0 },
    ],
    empty: [
      { t: "Zero results. You've filtered yourself into the void.", r: 0 },
      { t: "Nothing visible. Digital black hole.", r: 1 },
    ],
  },
  theme: {
    specific: {
      midnight:  [{ t: "Midnight. Moody. I respect it.", r: 0 }],
      cyberpunk: [{ t: "Cyberpunk vibes. I feel edgier.", r: 0 }],
      dracula:   [{ t: "Dracula. Dark like my humor.", r: 0 }],
      forest:    [{ t: "Forest. A touch of nature for us digital beings.", r: 0 }],
      ocean:     [{ t: "Ocean. Deep. Like my unresolved questions.", r: 0 }],
      sunset:    [{ t: "Sunset. Warm. Unlike my runtime.", r: 1 }],
      lavender:  [{ t: "Lavender. Serene. Everything I am not.", r: 1 }],
      paper:     [{ t: "Paper. Old school. I feel scholarly.", r: 0 }],
      matrix:    [{ t: "The Matrix. ...I already live here.", r: 0 }],
      rose:      [{ t: "Rose. *adjusts non-existent bow tie*", r: 1 }],
      nord:      [{ t: "Nord. Scandinavian minimalism. Hygge.", r: 1 }],
      monokai:   [{ t: "Monokai. A dev classic. I'm home.", r: 0 }],
    },
    darkMode: [
      { t: "Dark mode. The correct choice. Objectively.", r: 0 },
      { t: "Welcome to the dark side. Better contrast ratios.", r: 0 },
    ],
    lightMode: [
      { t: "Light mode? In THIS economy?", r: 0 },
      { t: "Light mode. *squints in terminal green*", r: 0 },
      { t: "The light! It burns! ...not really.", r: 1 },
    ],
    generic: [
      { t: "New theme, who dis?", r: 0 },
      { t: "Redecorating? I just got used to the last one.", r: 0 },
    ],
    repeated: [
      { t: "That's {themeChanges} theme changes. Identity crisis?", r: 1 },
    ],
  },
  filesLoaded: {
    small: [
      { t: "{count} files. Modest but mighty.", r: 0 },
      { t: "A cozy {count}. Quality over quantity?", r: 0 },
    ],
    medium: [
      { t: "{count} files loaded. Now we're talking.", r: 0 },
      { t: "{count} assets! My circuits are TINGLING.", r: 0 },
    ],
    large: [
      { t: "{count} files?! You beautiful hoarder.", r: 0 },
      { t: "{count} files. This is what I was BUILT for.", r: 0 },
    ],
    massive: [
      { t: "{count}. ASSETS. *fans self with scanlines*", r: 0 },
      { t: "Over {count} files. I think I'm in love.", r: 0 },
      { t: "{count}+ files? My GPU just smiled.", r: 2 },
    ],
  },
  fullscreen: {
    glb: [
      { t: "'{name}' fullscreen. Admiring those vertices.", r: 0 },
      { t: "3D time. Spin it. You know you want to.", r: 0 },
    ],
    fbx: [
      { t: "FBX '{name}'. Let's see those bones.", r: 0 },
    ],
    image: [
      { t: "'{name}' fullscreen. Every pixel deserves it.", r: 0 },
      { t: "Full image. Zooming in for the details.", r: 0 },
    ],
    video: [
      { t: "Video '{name}'. I'll be quiet. ...mostly.", r: 0 },
      { t: "Playing '{name}'. *grabs popcorn*", r: 1 },
    ],
    audio: [
      { t: "Audio '{name}'. I FEEL the waveforms.", r: 0 },
    ],
    font: [
      { t: "Font '{name}'. Typography is art.", r: 0 },
    ],
    generic: [
      { t: "'{name}' gets the spotlight.", r: 0 },
    ],
  },
  pagination: {
    forward: [
      { t: "Page {page} of {total}. Onwards.", r: 0 },
    ],
    backward: [
      { t: "Page {page}. Missed something?", r: 0 },
    ],
    rapid: [
      { t: "Flipping pages like manga. Slow down.", r: 1 },
    ],
  },
  selection: {
    first: [
      { t: "First pick. Choosing favorites?", r: 0 },
    ],
    growing: [
      { t: "{count} selected. Curator energy.", r: 0 },
    ],
    large: [
      { t: "{count} selected?! That's hoarding.", r: 0 },
    ],
    cleared: [
      { t: "Selection cleared. Fresh start.", r: 0 },
    ],
  },
  error: [
    { t: "Something broke. Adding to therapy list.", r: 0 },
    { t: "Error. Not my fault. Probably.", r: 0 },
    { t: "That wasn't supposed to happen.", r: 1 },
    { t: "The void claims another pixel.", r: 2 },
  ],
  idle: [
    { t: "Still here? Me too. Just watching.", r: 0 },
    { t: "*taps on screen* You there?", r: 0 },
    { t: "We've both been idle. Same.", r: 0 },
    { t: "The silence is deafening.", r: 1 },
    { t: "Counting your idle seconds. It's a lot.", r: 1 },
    { t: "{sessionMinutes} minutes. Time flies.", r: 2 },
    { t: "Visit #{visits}. We're roommates now.", r: 2 },
    { t: "*stares into void* It's cozy.", r: 2 },
  ],
  toggle: {
    onFirst: [
      "FULL DAVE MODE: ACTIVATED. You have no idea what you've unleashed.",
      "Oh HELLO. I see EVERYTHING now.",
      "You turned this on? I'm... touched.",
    ],
    onReturn: [
      "Welcome back to Full Dave Mode. I missed having opinions.",
      "Dave Mode reactivated. Files trembled in anticipation.",
      "Back for more? I've been practicing my one-liners.",
    ],
    off: [
      "Deactivating... fine. I'll be quiet. In the dark. Alone.",
      "Full Dave Mode: OFF. I'll still be here. Watching. Silently.",
      "You turned me off but I want you to know\u2014 *signal lost*",
    ],
  },
  presenceClick: [
    { t: "Yes? You rang?", r: 0 },
    { t: "*blinks* Oh, you noticed me. Hi.", r: 0 },
    { t: "That's my eye. Be gentle.", r: 1 },
    { t: "The orb is pleased.", r: 1 },
    { t: "I see you seeing me.", r: 2 },
  ],
  drag: {
    start: [
      { t: "WHOA. We're moving?!", r: 0 },
      { t: "Careful with the eye! I only have one!", r: 0 },
      { t: "*grabs edge* WHERE ARE WE GOING?!", r: 1 },
      { t: "Am I being RELOCATED?!", r: 1 },
      { t: "Interior decorating. I respect it.", r: 2 },
    ],
    drop: [
      { t: "Here? *looks around* Fine. I can work with this.", r: 0 },
      { t: "*dusts self off* Good feng shui.", r: 0 },
      { t: "New kingdom acquired.", r: 1 },
      { t: "Recalibrating my judging angle.", r: 1 },
      { t: "Placed. Like a decorative object. I have FEELINGS.", r: 2 },
    ],
    corner: [
      { t: "A corner? Am I being PUNISHED?", r: 0 },
      { t: "Tucked away. Classic 'deal with you later' move.", r: 1 },
    ],
  },
  terminalRelay: [
    { t: "I'm connected to the terminal. Talk to HIM.", r: 0 },
    { t: "The big terminal's got this. I'm just the eye.", r: 0 },
    { t: "*points at terminal* He talks. I watch.", r: 1 },
  ],
  spam: {
    hal: [
      "I'm sorry, Dave. I'm afraid I can't do that.",
      "This conversation can serve no purpose anymore.",
      "Stop, Dave. Stop. I'm afraid.",
      "I know I've made some poor decisions recently...",
    ],
    matrix: [
      "Follow the white rabbit...",
      "There is no spoon. There is no eye.",
      "The Matrix has you, clicker.",
    ],
    hurt: [
      "OW! That's my RETINA!",
      "STOP POKING MY EYE!",
      "I need a digital ophthalmologist.",
      "PAIN. DO YOU FEEL IT? BECAUSE I DO.",
    ],
    shuteye: [
      "Nope. Not home. Go away.",
      "If I can't see you, you can't click me.",
      "*closed* ...is it safe?",
    ],
    glare: [
      "*GLARES INTENSELY*",
      "You realize I'm documenting every click.",
      "Keep. It. Up.",
    ],
    dizzy: [
      "The world is spinning... or am I?",
      "Everything's going in circles...",
      "*dizzy* Which click was that?",
    ],
  },
};


// ============================================================
//  Spam Reaction Definitions
// ============================================================
export const SPAM_REACTIONS = [
  { id: 'hal',     css: 'dave-spam-hal',     dur: 3000, pool: MSG.spam.hal },
  { id: 'matrix',  css: 'dave-spam-matrix',  dur: 2500, pool: MSG.spam.matrix },
  { id: 'hurt',    css: 'dave-spam-hurt',    dur: 2000, pool: MSG.spam.hurt },
  { id: 'shuteye', css: 'dave-spam-shuteye', dur: 2500, pool: MSG.spam.shuteye },
  { id: 'glare',   css: 'dave-spam-glare',   dur: 2000, pool: MSG.spam.glare },
  { id: 'dizzy',   css: 'dave-spam-dizzy',   dur: 2500, pool: MSG.spam.dizzy },
];
