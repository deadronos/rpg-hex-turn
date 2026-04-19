export const BOARD_RADIUS = 4;

const classDefinitions = {
  warrior: {
    role: "Warrior",
    team: "player",
    maxHp: 16,
    attack: 5,
    armor: 2,
    move: 2,
    attackRange: 1,
    initiative: 8,
    palette: {
      base: "#5cb7e8",
      detail: "#dbefff",
      trim: "#1b4255",
    },
    attackLabel: "Blade strike",
    special: {
      name: "Cleave",
      cooldown: 2,
      description: "Hit every adjacent enemy for 4 damage.",
    },
  },
  rogue: {
    role: "Rogue",
    team: "player",
    maxHp: 11,
    attack: 4,
    armor: 1,
    move: 3,
    attackRange: 1,
    initiative: 11,
    palette: {
      base: "#70d2b4",
      detail: "#effff9",
      trim: "#14342d",
    },
    attackLabel: "Twin daggers",
    special: {
      name: "Shadowstep",
      cooldown: 3,
      description:
        "Teleport up to 3 hexes, then strike an adjacent enemy for 4 damage if one is present.",
    },
  },
  mage: {
    role: "Mage",
    team: "player",
    maxHp: 9,
    attack: 3,
    armor: 0,
    move: 2,
    attackRange: 2,
    initiative: 9,
    palette: {
      base: "#cfa4ff",
      detail: "#f7eeff",
      trim: "#4f3270",
    },
    attackLabel: "Arc bolt",
    special: {
      name: "Fireball",
      cooldown: 2,
      description: "Blast a hex within 3, dealing 3 damage in a 1-hex burst.",
    },
  },
  goblin: {
    role: "Goblin",
    team: "enemy",
    maxHp: 8,
    attack: 3,
    armor: 0,
    move: 3,
    attackRange: 1,
    initiative: 10,
    palette: {
      base: "#d55f4f",
      detail: "#ffd6cb",
      trim: "#55201a",
    },
    attackLabel: "Rusty stab",
    special: {
      name: "Scurry",
      cooldown: 0,
      description: "Fast skirmisher that hunts injured targets.",
    },
  },
  orc: {
    role: "Orc",
    team: "enemy",
    maxHp: 14,
    attack: 5,
    armor: 1,
    move: 2,
    attackRange: 1,
    initiative: 7,
    palette: {
      base: "#b86a3c",
      detail: "#ffe1c1",
      trim: "#4e2310",
    },
    attackLabel: "Crushing chop",
    special: {
      name: "Sweeping blow",
      cooldown: 0,
      description: "Hits all adjacent heroes when they bunch up.",
    },
  },
  skeleton: {
    role: "Skeleton",
    team: "enemy",
    maxHp: 7,
    attack: 3,
    armor: 0,
    move: 2,
    attackRange: 3,
    initiative: 6,
    palette: {
      base: "#d7d4b8",
      detail: "#fffff3",
      trim: "#504d37",
    },
    attackLabel: "Bone arrow",
    special: {
      name: "Keepaway",
      cooldown: 0,
      description: "Prefers to fire from range and retreat from danger.",
    },
  },
};

function createUnit(type, overrides) {
  const base = classDefinitions[type];
  return {
    id: overrides.id,
    type,
    name: overrides.name,
    role: base.role,
    team: base.team,
    q: overrides.q,
    r: overrides.r,
    maxHp: base.maxHp,
    hp: base.maxHp,
    attack: base.attack,
    armor: base.armor,
    move: base.move,
    attackRange: base.attackRange,
    initiative: base.initiative,
    attackLabel: base.attackLabel,
    special: base.special,
    palette: base.palette,
    hasMoved: false,
    hasActed: false,
    specialCooldown: 0,
  };
}

export function createScenario() {
  const terrain = new Map([
    ["-1,-2", { type: "rock", label: "Boulder" }],
    ["1,-2", { type: "rock", label: "Boulder" }],
    ["2,-1", { type: "rock", label: "Boulder" }],
    ["-2,1", { type: "rock", label: "Boulder" }],
    ["0,2", { type: "rock", label: "Ruined pillar" }],
    ["2,2", { type: "rock", label: "Ruined pillar" }],
  ]);

  const units = [
    createUnit("warrior", {
      id: "warrior",
      name: "Aldric",
      q: -3,
      r: 1,
    }),
    createUnit("rogue", {
      id: "rogue",
      name: "Mira",
      q: -2,
      r: 2,
    }),
    createUnit("mage", {
      id: "mage",
      name: "Selene",
      q: -2,
      r: 0,
    }),
    createUnit("goblin", {
      id: "goblin-a",
      name: "Goblin Sneak",
      q: 3,
      r: -1,
    }),
    createUnit("goblin", {
      id: "goblin-b",
      name: "Goblin Knifer",
      q: 3,
      r: 1,
    }),
    createUnit("orc", {
      id: "orc",
      name: "Orc Ravager",
      q: 2,
      r: 0,
    }),
    createUnit("skeleton", {
      id: "skeleton",
      name: "Bone Archer",
      q: 4,
      r: -2,
    }),
  ];

  return {
    terrain,
    units,
  };
}
